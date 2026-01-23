import { loadConfig, type Config } from '../config.js';
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
    state: string;
    labels: string[];
  };
  status: string;
}

export class GitHubProvider implements IssueProvider {
  private config: Config;

  constructor() {
    this.config = loadConfig();
  }

  async getIssues(): Promise<Issue[]> {
    if (!this.config.projectNumber || !this.config.columnName) {
      console.error('Error: Project not configured. Run `vibesprint config link` and `vibesprint config column`.');
      process.exit(1);
    }

    const result = ghProjectJson<{ items: ProjectItem[] } | ProjectItem[]>([
      'item-list', String(this.config.projectNumber),
      '--format', 'json',
    ]);

    if (!result) {
      console.error('Error: Failed to fetch project items');
      return [];
    }

    // Handle both { items: [...] } and direct array formats
    const items = Array.isArray(result) ? result : result.items || [];

    return items
      .filter(item => {
        if (!item.content || item.content.type !== 'Issue') return false;
        if (item.content.state !== 'OPEN') return false;
        if (item.status !== this.config.columnName) return false;
        const labels = item.content.labels || [];
        if (labels.includes('running') || labels.includes('done')) return false;
        if (labels.includes('failed') && !labels.includes('retry')) return false;
        return true;
      })
      .map(item => {
        const labels = item.content.labels || [];
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
        };
      })
      .sort((a, b) => a.number - b.number);
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    const result = gh(['issue', 'edit', String(issue.number), '--add-label', label]);
    if (!result.success) {
      console.warn(`⚠️ Failed to add label '${label}': ${result.stderr}`);
    }
  }

  async removeLabel(issue: Issue, label: string): Promise<void> {
    const result = gh(['issue', 'edit', String(issue.number), '--remove-label', label]);
    if (!result.success && !result.stderr.includes('not found')) {
      console.warn(`⚠️ Failed to remove label '${label}': ${result.stderr}`);
    }
  }

  async postComment(issue: Issue, body: string): Promise<void> {
    const result = gh(['issue', 'comment', String(issue.number), '--body', body]);
    if (!result.success) {
      console.warn(`⚠️ Failed to post comment: ${result.stderr}`);
    }
  }

  async moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void> {
    const columnNameMap = {
      backlog: this.config.backlogColumnName,
      inProgress: this.config.inProgressColumnName,
      inReview: this.config.inReviewColumnName,
    };

    const columnName = columnNameMap[column];
    if (!columnName || !this.config.projectId) return;

    ghProject([
      'item-edit',
      '--id', issue.projectItemId,
      '--project-id', this.config.projectId,
      '--field-id', this.config.columnFieldId!,
      '--single-select-option-id', this.getColumnOptionId(column)!,
    ]);
  }

  private getColumnOptionId(column: 'backlog' | 'inProgress' | 'inReview'): string | undefined {
    const map = {
      backlog: this.config.backlogOptionId,
      inProgress: this.config.inProgressOptionId,
      inReview: this.config.inReviewOptionId,
    };
    return map[column];
  }

  async createSubIssue(
    parentIssue: Issue,
    title: string,
    body: string
  ): Promise<{ id: number; number: number }> {
    const fullBody = `${body}\n\n---\n*Part of #${parentIssue.number}*`;
    
    const result = ghJson<{ number: number; id: number; url: string }>([
      'issue', 'create',
      '--title', title,
      '--body', fullBody,
      '--json', 'number,id,url',
    ]);

    if (!result) {
      throw new Error('Failed to create sub-issue');
    }

    // Add to project
    if (this.config.projectNumber) {
      ghProject([
        'item-add', String(this.config.projectNumber),
        '--url', result.url,
      ]);
    }

    return { id: result.id, number: result.number };
  }

  async ensureLabelsExist(): Promise<void> {
    const result = ghJson<Array<{ name: string }> | { labels: Array<{ name: string }> }>(['label', 'list', '--json', 'name']);
    const labels = Array.isArray(result) ? result : result?.labels || [];
    const existingNames = new Set(labels.map(l => l.name));

    for (const label of REQUIRED_LABELS) {
      if (!existingNames.has(label)) {
        const createResult = gh(['label', 'create', label, '--color', 'ededed']);
        if (createResult.success) {
          console.log(`  📌 Created label: ${label}`);
        }
      }
    }
  }
}
