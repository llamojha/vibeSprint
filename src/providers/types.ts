import type { ExecutorType } from '../executors/index.js';
import type { RepoConfig } from '../config.js';

export interface Issue {
  id: string;
  number: number;
  identifier?: string; // Linear identifier (e.g., "ENG-123")
  title: string;
  body: string;
  url: string;
  projectItemId: string;
  labels: string[];
  model?: string;
  executor?: ExecutorType;
  repoConfig?: RepoConfig;
}

export interface IssueProvider {
  getIssues(): Promise<Issue[]>;
  addLabel(issue: Issue, label: string): Promise<void>;
  removeLabel(issue: Issue, label: string): Promise<void>;
  postComment(issue: Issue, body: string): Promise<void>;
  moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void>;
  createSubIssue(parentIssue: Issue, title: string, body: string): Promise<{ id: number; number: number }>;
  ensureLabelsExist(): Promise<void>;
}
