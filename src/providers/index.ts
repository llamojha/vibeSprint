import type { RepoConfig } from '../config.js';
import type { IssueProvider } from './types.js';
import { GitHubProvider } from './github.js';
import { LinearProvider } from './linear.js';

export function createProvider(repoConfig: RepoConfig): IssueProvider {
  const provider = repoConfig.provider || 'github';
  
  if (provider === 'linear') {
    return new LinearProvider(repoConfig);
  }
  
  return new GitHubProvider(repoConfig);
}

export { GitHubProvider } from './github.js';
export { LinearProvider } from './linear.js';
export type { IssueProvider, Issue } from './types.js';
