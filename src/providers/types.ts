import type { ExecutorType } from '../executors/index.js';
import type { RepoConfig } from '../config.js';

/**
 * Represents an issue from GitHub Projects or Linear.
 */
export interface Issue {
  /** Unique identifier (GitHub node ID or Linear issue ID) */
  id: string;
  /** Issue number (GitHub) or numeric part of identifier (Linear) */
  number: number;
  /** Linear-specific identifier (e.g., "ENG-123"), undefined for GitHub */
  identifier?: string;
  /** Issue title */
  title: string;
  /** Issue body/description */
  body: string;
  /** URL to the issue */
  url: string;
  /** Project item ID for column operations */
  projectItemId: string;
  /** Labels attached to the issue */
  labels: string[];
  /** Model override from issue labels (e.g., "claude-sonnet-4") */
  model?: string;
  /** Executor override from issue labels */
  executor?: ExecutorType;
  /** Reference to the repo configuration this issue belongs to */
  repoConfig?: RepoConfig;
}

/**
 * Provider interface for issue tracking systems.
 * Implementations: GitHubProvider (GitHub Projects), LinearProvider (Linear)
 */
export interface IssueProvider {
  /**
   * Fetch issues in the "Ready" column/state that are eligible for processing.
   * Filters out issues already running, failed, or done.
   */
  getIssues(): Promise<Issue[]>;

  /**
   * Add a label to an issue.
   * @param issue - The issue to label
   * @param label - Label name (provider may prefix, e.g., "vibesprint:" for Linear)
   */
  addLabel(issue: Issue, label: string): Promise<void>;

  /**
   * Remove a label from an issue.
   * @param issue - The issue to update
   * @param label - Label name to remove
   */
  removeLabel(issue: Issue, label: string): Promise<void>;

  /**
   * Post a comment on an issue.
   * @param issue - The issue to comment on
   * @param body - Comment body (markdown supported)
   */
  postComment(issue: Issue, body: string): Promise<void>;

  /**
   * Move an issue to a different column/workflow state.
   * @param issue - The issue to move
   * @param column - Target column: 'backlog', 'inProgress', or 'inReview'
   */
  moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void>;

  /**
   * Create a sub-issue linked to a parent issue.
   * Used by the plan workflow to break features into tasks.
   * @param parentIssue - The parent issue
   * @param title - Sub-issue title
   * @param body - Sub-issue body
   * @returns The created issue's id and number
   */
  createSubIssue(parentIssue: Issue, title: string, body: string): Promise<{ id: number; number: number }>;

  /**
   * Ensure all VibeSprint labels exist in the project/team.
   * Creates labels like 'running', 'pr-opened', 'plan', 'failed', etc.
   */
  ensureLabelsExist(): Promise<void>;
}
