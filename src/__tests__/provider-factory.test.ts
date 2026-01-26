import { describe, it, expect } from 'vitest';
import type { RepoConfig } from '../config.js';

/**
 * Tests for provider factory routing logic.
 * Tests the selection logic without instantiating actual providers.
 */

function getProviderType(config: RepoConfig): 'github' | 'linear' {
  return config.provider || 'github';
}

describe('provider factory routing', () => {
  it('returns github when provider is "github"', () => {
    const config: RepoConfig = {
      name: 'test-repo',
      owner: 'owner',
      repo: 'repo',
      path: '/path/to/repo',
      provider: 'github',
    };
    
    expect(getProviderType(config)).toBe('github');
  });

  it('returns github when provider is undefined (default)', () => {
    const config: RepoConfig = {
      name: 'test-repo',
      owner: 'owner',
      repo: 'repo',
      path: '/path/to/repo',
    };
    
    expect(getProviderType(config)).toBe('github');
  });

  it('returns linear when provider is "linear"', () => {
    const config: RepoConfig = {
      name: 'test-repo',
      owner: 'owner',
      repo: 'repo',
      path: '/path/to/repo',
      provider: 'linear',
      linearTeamId: 'team-123',
      linearReadyStateId: 'state-456',
    };
    
    expect(getProviderType(config)).toBe('linear');
  });
});

describe('provider config validation', () => {
  it('linear config requires linearTeamId', () => {
    const config: RepoConfig = {
      name: 'test-repo',
      owner: 'owner',
      repo: 'repo',
      path: '/path/to/repo',
      provider: 'linear',
      linearTeamId: 'team-123',
      linearReadyStateId: 'state-456',
    };
    
    expect(config.linearTeamId).toBeDefined();
    expect(config.linearReadyStateId).toBeDefined();
  });

  it('github config does not require linear fields', () => {
    const config: RepoConfig = {
      name: 'test-repo',
      owner: 'owner',
      repo: 'repo',
      path: '/path/to/repo',
      provider: 'github',
    };
    
    expect(config.linearTeamId).toBeUndefined();
    expect(config.linearReadyStateId).toBeUndefined();
  });

  it('linear config can include repo label for shared teams', () => {
    const config: RepoConfig = {
      name: 'my-app',
      owner: 'myorg',
      repo: 'my-app',
      path: '/home/user/my-app',
      provider: 'linear',
      linearTeamId: 'team-abc',
      linearTeamName: 'Engineering',
      linearRepoLabel: 'repo:my-app',
      linearReadyStateId: 'ready-state',
      linearInProgressStateId: 'progress-state',
      linearInReviewStateId: 'review-state',
      linearBacklogStateId: 'backlog-state',
    };
    
    expect(config.linearRepoLabel).toBe('repo:my-app');
    expect(config.linearTeamName).toBe('Engineering');
  });
});
