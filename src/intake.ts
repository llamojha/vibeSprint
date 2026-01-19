import { GitHubProvider } from './providers/github.js';
import type { IssueProvider, Issue } from './providers/types.js';

export type { Issue };

export async function getIssuesInColumn(): Promise<Issue[]> {
  const provider: IssueProvider = new GitHubProvider();
  return provider.getIssues();
}
