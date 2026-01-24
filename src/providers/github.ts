import { type RepoConfig } from '../config.js';
import { gh, ghJson, ghProject, ghProjectJson } from '../utils/gh.js';
import type { IssueProvider, Issue } from './types.js';
import type { ExecutorType } from '../executors/index.js';

const REQUIRED_LABELS = [
  'running', 'retry', 'failed', 'pr-opened', 'plan-posted', 'plan', 'no-curate',
  'model:auto', 'model:claude-sonnet-4.5', 'model:claude-sonnet-4',
  'model:claude-haiku-4.5', 'model:claude-opus-4.5',
  'model:gpt-5.2-codex', 'model:gpt-5.2', 'model:gpt-5.1-codex-max', 'model:gpt-5.1-codex-mini',
  'executor:kiro', 'executor:codex',
];

interface ProjectItem {
  id: string;
  content: {
    type: string;
    number: number;
    title: string;
    body: string;
    url: string;
  };
  status: string;
  labels?: string[];
}

export class GitHubProvider implements IssueProvider {
  private repo: RepoConfig;

  constructor(repoConfig: RepoConfig) {
    this.repo = repoConfig;
  }

  private get repoRef() {
    return { owner: this.repo.owner, repo: this.repo.repo };
  }

  async getIssues(): Promise<Issue[]> {
    if (!this.repo.projectNumber) {
      return [];
    }
    
    const result = ghProjectJson<{ items: ProjectItem[] } | ProjectItem[]>([
      'item-list', String(this.repo.projectNumber),
      '--format', 'json',
    ], this.repo.owner);

    // Empty project or no items is valid - just return empty array
    if (!result) {
      return [];
    }

    const items = Array.isArray(result) ? result : result.items || [];

    return items
      .filter(item => {
        if (!item.content || item.content.type !== 'Issue') return false;
        if (item.status !== this.repo.columnName) return false;
        const labels = item.labels || [];
        if (labels.includes('running') || labels.includes('done')) return false;
        if (labels.includes('failed') && !labels.includes('retry')) return false;
        return true;
      })
      .map(item => {
        const labels = item.labels || [];
        const modelLabel = labels.find(l => l.startsWith('model:'));
        const executorLabel = labels.find(l => l.startsWith('executor:'));
        return {
          id: item.id,
          number: item.content.number,
          title: item.content.title,
          body: item.content.body,
          url: item.content.url,
          projectItemId: item.id,
          labels,
          model: modelLabel?.replace('model:', ''),
          executor: executorLabel?.replace('executor:', '') as ExecutorType | undefined,
          repoConfig: this.repo,
        };
      })
      .sort((a, b) => a.number - b.number);
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    const result = gh(['issue', 'edit', String(issue.number), '--add-label', label], this.repoRef);
    if (!result.success) {
      console.warn(`⚠️ Failed to add label '${label}': ${result.stderr}`);
    }
  }

  async removeLabel(issue: Issue, label: string): Promise<void> {
    const result = gh(['issue', 'edit', String(issue.number), '--remove-label', label], this.repoRef);
    if (!result.success && !result.stderr.includes('not found')) {
      console.warn(`⚠️ Failed to remove label '${label}': ${result.stderr}`);
    }
  }

  async postComment(issue: Issue, body: string): Promise<void> {
    const result = gh(['issue', 'comment', String(issue.number), '--body', body], this.repoRef);
    if (!result.success) {
      console.warn(`⚠️ Failed to post comment: ${result.stderr}`);
    }
  }

  async moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void> {
    const optionId = this.getColumnOptionId(column);
    if (!optionId || !this.repo.projectId || !this.repo.columnFieldId) return;

    ghProject([
      'item-edit',
      '--id', issue.projectItemId,
      '--project-id', this.repo.projectId,
      '--field-id', this.repo.columnFieldId,
      '--single-select-option-id', optionId,
    ]);
  }

  private getColumnOptionId(column: 'backlog' | 'inProgress' | 'inReview'): string | undefined {
    const map = {
      backlog: this.repo.backlogOptionId,
      inProgress: this.repo.inProgressOptionId,
      inReview: this.repo.inReviewOptionId,
    };
    return map[column];
  }

  async createSubIssue(
    parentIssue: Issue,
    title: string,
    body: string
  ): Promise<{ id: number; number: number }> {
    const fullBody = `${body}\n\n---\n*Part of #${parentIssue.number}*`;
    
    const res = gh(['issue', 'create', '--title', title, '--body', fullBody], this.repoRef);

    if (!res.success) {
      throw new Error(`Failed to create sub-issue: ${res.stderr}`);
    }

    const urlMatch = res.stdout.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/);
    if (!urlMatch) {
      throw new Error(`Failed to parse issue URL from: ${res.stdout}`);
    }
    const issueNumber = parseInt(urlMatch[1], 10);
    const issueUrl = urlMatch[0];

    ghProject(['item-add', String(this.repo.projectNumber), '--url', issueUrl], this.repo.owner);

    return { id: issueNumber, number: issueNumber };
  }

  async ensureLabelsExist(): Promise<void> {
    const result = ghJson<Array<{ name: string }> | { labels: Array<{ name: string }> }>(
      ['label', 'list', '--json', 'name'],
      this.repoRef
    );
    const labels = Array.isArray(result) ? result : result?.labels || [];
    const existingNames = new Set(labels.map(l => l.name));

    for (const label of REQUIRED_LABELS) {
      if (!existingNames.has(label)) {
        const createResult = gh(['label', 'create', label, '--color', 'ededed'], this.repoRef);
        if (createResult.success) {
          console.log(`  📌 Created label: ${label}`);
        }
      }
    }
  }
}
