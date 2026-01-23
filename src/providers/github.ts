import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { loadConfig, getToken, type Config } from '../config.js';
import type { IssueProvider, Issue } from './types.js';
import type { ExecutorType } from '../executors/index.js';

const REQUIRED_LABELS = [
  'running', 'retry', 'failed', 'pr-opened', 'plan-posted', 'plan', 'no-curate',
  'model:auto', 'model:claude-sonnet-4.5', 'model:claude-sonnet-4',
  'model:claude-haiku-4.5', 'model:claude-opus-4.5',
  'model:gpt-5.2-codex', 'model:gpt-5.2', 'model:gpt-5.1-codex-max', 'model:gpt-5.1-codex-mini',
  'executor:kiro', 'executor:codex',
];

export class GitHubProvider implements IssueProvider {
  private config: Config;
  private octokit: Octokit;
  private gql: typeof graphql;

  constructor() {
    this.config = loadConfig();
    const token = getToken();
    this.octokit = new Octokit({ auth: token });
    this.gql = graphql.defaults({ headers: { authorization: `token ${token}` } });
  }

  async getIssues(): Promise<Issue[]> {
    if (!this.config.projectId || !this.config.columnOptionId) {
      console.error('Error: Project not configured. Run `vibesprint config link` and `vibesprint config column`.');
      process.exit(1);
    }

    const { node } = await this.gql<{
      node: {
        items: {
          nodes: Array<{
            id: string;
            fieldValueByName: { optionId: string } | null;
            content: {
              __typename: string;
              id: string;
              number: number;
              title: string;
              body: string;
              url: string;
              state: string;
              labels: { nodes: Array<{ name: string }> };
            } | null;
          }>;
        };
      };
    }>(`
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100) {
              nodes {
                id
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue { optionId }
                }
                content {
                  __typename
                  ... on Issue {
                    id number title body url state
                    labels(first: 10) { nodes { name } }
                  }
                }
              }
            }
          }
        }
      }
    `, { projectId: this.config.projectId });

    return node.items.nodes
      .filter(item => {
        if (!item.content || item.content.__typename !== 'Issue') return false;
        if (item.content.state !== 'OPEN') return false;
        if (item.fieldValueByName?.optionId !== this.config.columnOptionId) return false;
        const labels = item.content.labels.nodes.map(l => l.name);
        if (labels.includes('running') || labels.includes('done')) return false;
        if (labels.includes('failed') && !labels.includes('retry')) return false;
        return true;
      })
      .map(item => {
        const labels = item.content!.labels.nodes.map(l => l.name);
        const modelLabel = labels.find(l => l.startsWith('model:'));
        const executorLabel = labels.find(l => l.startsWith('executor:'));
        return {
          id: item.content!.id,
          number: item.content!.number,
          title: item.content!.title,
          body: item.content!.body,
          url: item.content!.url,
          projectItemId: item.id,
          labels,
          model: modelLabel?.replace('model:', ''),
          executor: executorLabel?.replace('executor:', '') as ExecutorType | undefined,
        };
      })
      .sort((a, b) => a.number - b.number);
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    try {
      await this.octokit.issues.addLabels({
        owner: this.config.owner!,
        repo: this.config.repo!,
        issue_number: issue.number,
        labels: [label],
      });
    } catch (err) {
      console.warn(`⚠️ Failed to add label '${label}': ${this.formatError(err)}`);
    }
  }

  async removeLabel(issue: Issue, label: string): Promise<void> {
    try {
      await this.octokit.issues.removeLabel({
        owner: this.config.owner!,
        repo: this.config.repo!,
        issue_number: issue.number,
        name: label,
      });
    } catch {
      // Label might not exist - this is expected
    }
  }

  async postComment(issue: Issue, body: string): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.config.owner!,
      repo: this.config.repo!,
      issue_number: issue.number,
      body,
    });
  }

  async moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void> {
    const optionIdMap = {
      backlog: this.config.backlogOptionId,
      inProgress: this.config.inProgressOptionId,
      inReview: this.config.inReviewOptionId,
    };

    const optionId = optionIdMap[column];
    if (!optionId || !this.config.columnFieldId) return;

    await this.gql(`
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }) { projectV2Item { id } }
      }
    `, {
      projectId: this.config.projectId,
      itemId: issue.projectItemId,
      fieldId: this.config.columnFieldId,
      optionId,
    });
  }

  async createSubIssue(
    parentIssue: Issue,
    title: string,
    body: string
  ): Promise<{ id: number; number: number }> {
    const { data: newIssue } = await this.octokit.issues.create({
      owner: this.config.owner!,
      repo: this.config.repo!,
      title,
      body: `${body}\n\n---\n*Part of #${parentIssue.number}*`,
    });

    try {
      await this.octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues', {
        owner: this.config.owner!,
        repo: this.config.repo!,
        issue_number: parentIssue.number,
        sub_issue_id: newIssue.id,
      });
    } catch {
      console.warn(`  ⚠️ Could not link as sub-issue (feature may not be available)`);
    }

    const { addProjectV2ItemById } = await this.gql<{
      addProjectV2ItemById: { item: { id: string } };
    }>(`
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item { id }
        }
      }
    `, {
      projectId: this.config.projectId,
      contentId: newIssue.node_id,
    });

    if (this.config.backlogOptionId && this.config.columnFieldId) {
      await this.gql(`
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { singleSelectOptionId: $optionId }
          }) { projectV2Item { id } }
        }
      `, {
        projectId: this.config.projectId,
        itemId: addProjectV2ItemById.item.id,
        fieldId: this.config.columnFieldId,
        optionId: this.config.backlogOptionId,
      });
    }

    return { id: newIssue.id, number: newIssue.number };
  }

  async ensureLabelsExist(): Promise<void> {
    const { data: existingLabels } = await this.octokit.issues.listLabelsForRepo({
      owner: this.config.owner!,
      repo: this.config.repo!,
    });
    const existingNames = new Set(existingLabels.map(l => l.name));

    for (const label of REQUIRED_LABELS) {
      if (!existingNames.has(label)) {
        try {
          await this.octokit.issues.createLabel({
            owner: this.config.owner!,
            repo: this.config.repo!,
            name: label,
            color: 'ededed',
          });
          console.log(`  📌 Created label: ${label}`);
        } catch {
          // Label might have been created by another process
        }
      }
    }
  }

  private formatError(err: unknown): string {
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status;
      if (status === 404) return 'Not found - check owner/repo and permissions';
      if (status === 403) return 'Forbidden - token may lack required permissions';
      if (status === 401) return 'Unauthorized - check GITHUB_TOKEN is valid';
    }
    return err instanceof Error ? err.message : String(err);
  }
}
