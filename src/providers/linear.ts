import { LinearClient, type IssueLabel } from '@linear/sdk';
import { getLinearApiKey, type RepoConfig } from '../config.js';
import type { IssueProvider, Issue } from './types.js';
import type { ExecutorType } from '../executors/index.js';

const VIBESPRINT_LABELS = [
  'vibesprint:running',
  'vibesprint:retry',
  'vibesprint:failed',
  'vibesprint:pr-opened',
  'vibesprint:plan-posted',
  'plan',
  'no-curate',
  'model:auto', 'model:claude-sonnet-4.5', 'model:claude-sonnet-4',
  'model:claude-haiku-4.5', 'model:claude-opus-4.5',
  'model:gpt-5.2-codex', 'model:gpt-5.2', 'model:gpt-5.1-codex-max', 'model:gpt-5.1-codex-mini',
  'executor:kiro', 'executor:codex',
];

export class LinearProvider implements IssueProvider {
  private repo: RepoConfig;
  private client: LinearClient;
  private labelCache: Map<string, string> = new Map(); // name -> id

  constructor(repoConfig: RepoConfig) {
    this.repo = repoConfig;
    
    const apiKey = getLinearApiKey();
    if (!apiKey) {
      throw new Error('Linear API key not found. Set LINEAR_API_KEY environment variable or configure via `vibesprint config add-repo --linear`');
    }
    
    this.client = new LinearClient({ apiKey });
  }

  private async getOrCreateLabel(name: string): Promise<string> {
    if (this.labelCache.has(name)) {
      return this.labelCache.get(name)!;
    }

    const team = await this.client.team(this.repo.linearTeamId!);
    const labels = await team.labels();
    
    const existing = labels.nodes.find((l: IssueLabel) => l.name === name);
    if (existing) {
      this.labelCache.set(name, existing.id);
      return existing.id;
    }

    const created = await this.client.createIssueLabel({
      name,
      teamId: this.repo.linearTeamId!,
      color: '#808080',
    });
    
    const label = await created.issueLabel;
    if (label) {
      this.labelCache.set(name, label.id);
      return label.id;
    }
    
    throw new Error(`Failed to create label: ${name}`);
  }

  async getIssues(): Promise<Issue[]> {
    if (!this.repo.linearTeamId || !this.repo.linearReadyStateId) {
      return [];
    }

    try {
      const issues = await this.client.issues({
        filter: {
          team: { id: { eq: this.repo.linearTeamId } },
          state: { id: { eq: this.repo.linearReadyStateId } },
        },
      });

      const results: Issue[] = [];
      
      for (const issue of issues.nodes) {
        const labelsConnection = await issue.labels();
        const labels = labelsConnection?.nodes.map((l: IssueLabel) => l.name) || [];
        
        // Filter by repo label if configured
        if (this.repo.linearRepoLabel && !labels.includes(this.repo.linearRepoLabel)) {
          continue;
        }
        
        // Skip issues already being processed or failed
        if (labels.includes('vibesprint:running') || labels.includes('vibesprint:done')) continue;
        if (labels.includes('vibesprint:failed') && !labels.includes('vibesprint:retry')) continue;

        const modelLabel = labels.find((l: string) => l.startsWith('model:'));
        const executorLabel = labels.find((l: string) => l.startsWith('executor:'));
        
        // Extract number from identifier (e.g., "ENG-123" -> 123)
        const numberMatch = issue.identifier.match(/\d+$/);
        const issueNumber = numberMatch ? parseInt(numberMatch[0], 10) : 0;

        results.push({
          id: issue.id,
          number: issueNumber,
          identifier: issue.identifier,
          title: issue.title,
          body: issue.description || '',
          url: issue.url,
          projectItemId: issue.id,
          labels,
          model: modelLabel?.replace('model:', ''),
          executor: executorLabel?.replace('executor:', '') as ExecutorType | undefined,
          repoConfig: this.repo,
        });
      }

      return results.sort((a, b) => a.number - b.number);
    } catch (err) {
      console.warn(`⚠️ Failed to fetch Linear issues: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    const labelName = label.startsWith('vibesprint:') ? label : `vibesprint:${label}`;
    
    // Check if label already on issue
    if (issue.labels.includes(labelName)) {
      return;
    }
    
    const labelId = await this.getOrCreateLabel(labelName);
    
    const linearIssue = await this.client.issue(issue.id);
    const currentLabels = await linearIssue.labels();
    const labelIds = currentLabels?.nodes.map((l: IssueLabel) => l.id) || [];
    
    if (!labelIds.includes(labelId)) {
      await this.client.updateIssue(issue.id, {
        labelIds: [...labelIds, labelId],
      });
    }
  }

  async removeLabel(issue: Issue, label: string): Promise<void> {
    const labelName = label.startsWith('vibesprint:') ? label : `vibesprint:${label}`;
    
    const linearIssue = await this.client.issue(issue.id);
    const currentLabels = await linearIssue.labels();
    const labelIds = currentLabels?.nodes.filter((l: IssueLabel) => l.name !== labelName).map((l: IssueLabel) => l.id) || [];
    
    await this.client.updateIssue(issue.id, { labelIds });
  }

  async postComment(issue: Issue, body: string): Promise<void> {
    await this.client.createComment({
      issueId: issue.id,
      body,
    });
  }

  async attachPR(issue: Issue, prUrl: string): Promise<void> {
    await this.client.createAttachment({
      issueId: issue.id,
      url: prUrl,
      title: 'Pull Request',
    });
  }

  async moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void> {
    const stateIdMap: Record<string, string | undefined> = {
      backlog: this.repo.linearBacklogStateId,
      inProgress: this.repo.linearInProgressStateId,
      inReview: this.repo.linearInReviewStateId,
    };
    
    const stateId = stateIdMap[column];
    if (!stateId) {
      console.warn(`⚠️ No Linear state configured for column: ${column}`);
      return;
    }
    
    await this.client.updateIssue(issue.id, { stateId });
  }

  async createSubIssue(parentIssue: Issue, title: string, body: string): Promise<{ id: number; number: number }> {
    const fullBody = `${body}\n\n---\n*Part of ${parentIssue.identifier || `#${parentIssue.number}`}*`;
    
    const result = await this.client.createIssue({
      teamId: this.repo.linearTeamId!,
      title,
      description: fullBody,
      parentId: parentIssue.id,
      stateId: this.repo.linearBacklogStateId,
    });
    
    const issue = await result.issue;
    if (!issue) {
      throw new Error('Failed to create sub-issue in Linear');
    }
    
    // Extract number from identifier
    const numberMatch = issue.identifier.match(/\d+$/);
    const issueNumber = numberMatch ? parseInt(numberMatch[0], 10) : 0;
    
    return { id: issueNumber, number: issueNumber };
  }

  async ensureLabelsExist(): Promise<void> {
    for (const label of VIBESPRINT_LABELS) {
      await this.getOrCreateLabel(label);
    }
    
    // Also create repo label if configured
    if (this.repo.linearRepoLabel) {
      await this.getOrCreateLabel(this.repo.linearRepoLabel);
    }
    
    console.log(`  ✓ Labels verified for ${this.repo.linearTeamName || this.repo.linearTeamId}`);
  }
}
