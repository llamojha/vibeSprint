import { describe, it, expect } from 'vitest';

/**
 * Tests for Linear issue filtering logic.
 * Mirrors the filtering in LinearProvider.getIssues()
 */

function shouldProcessLinearIssue(
  labels: string[],
  repoLabel?: string,
  issueLabels?: string[]
): boolean {
  const labelList = issueLabels ?? labels;
  
  // Filter by repo label if configured
  if (repoLabel && !labelList.includes(repoLabel)) {
    return false;
  }
  
  // Skip issues already being processed or done
  if (labelList.includes('vibesprint:running') || labelList.includes('vibesprint:done')) {
    return false;
  }
  
  // Skip failed issues unless they have retry label
  if (labelList.includes('vibesprint:failed') && !labelList.includes('vibesprint:retry')) {
    return false;
  }
  
  return true;
}

function extractIssueNumber(identifier: string): number {
  const match = identifier.match(/\d+$/);
  return match ? parseInt(match[0], 10) : 0;
}

function extractModel(labels: string[]): string | undefined {
  const modelLabel = labels.find(l => l.startsWith('model:'));
  return modelLabel?.replace('model:', '');
}

function extractExecutor(labels: string[]): string | undefined {
  const executorLabel = labels.find(l => l.startsWith('executor:'));
  return executorLabel?.replace('executor:', '');
}

describe('Linear issue filtering', () => {
  it('accepts issue with no special labels', () => {
    expect(shouldProcessLinearIssue([])).toBe(true);
  });

  it('rejects issue with vibesprint:running label', () => {
    expect(shouldProcessLinearIssue(['vibesprint:running'])).toBe(false);
  });

  it('rejects issue with vibesprint:done label', () => {
    expect(shouldProcessLinearIssue(['vibesprint:done'])).toBe(false);
  });

  it('rejects failed issue without retry label', () => {
    expect(shouldProcessLinearIssue(['vibesprint:failed'])).toBe(false);
  });

  it('accepts failed issue with retry label', () => {
    expect(shouldProcessLinearIssue(['vibesprint:failed', 'vibesprint:retry'])).toBe(true);
  });

  it('accepts issue with plan label', () => {
    expect(shouldProcessLinearIssue(['plan'])).toBe(true);
  });

  it('accepts issue with no-curate label', () => {
    expect(shouldProcessLinearIssue(['no-curate'])).toBe(true);
  });
});

describe('Linear repo label filtering', () => {
  it('accepts issue with matching repo label', () => {
    expect(shouldProcessLinearIssue([], 'repo:myapp', ['repo:myapp'])).toBe(true);
  });

  it('rejects issue without repo label when required', () => {
    expect(shouldProcessLinearIssue([], 'repo:myapp', [])).toBe(false);
  });

  it('rejects issue with different repo label', () => {
    expect(shouldProcessLinearIssue([], 'repo:myapp', ['repo:other'])).toBe(false);
  });

  it('accepts any issue when no repo label configured', () => {
    expect(shouldProcessLinearIssue([], undefined, ['some-label'])).toBe(true);
  });
});

describe('Linear identifier parsing', () => {
  it('extracts number from standard identifier', () => {
    expect(extractIssueNumber('ENG-123')).toBe(123);
  });

  it('extracts number from different team prefix', () => {
    expect(extractIssueNumber('PROJ-456')).toBe(456);
  });

  it('extracts number from single letter prefix', () => {
    expect(extractIssueNumber('A-1')).toBe(1);
  });

  it('returns 0 for invalid identifier', () => {
    expect(extractIssueNumber('invalid')).toBe(0);
  });

  it('extracts large numbers', () => {
    expect(extractIssueNumber('TEAM-99999')).toBe(99999);
  });
});

describe('Linear label extraction', () => {
  it('extracts model from labels', () => {
    expect(extractModel(['model:claude-sonnet-4', 'other'])).toBe('claude-sonnet-4');
  });

  it('returns undefined when no model label', () => {
    expect(extractModel(['plan', 'bug'])).toBeUndefined();
  });

  it('extracts executor from labels', () => {
    expect(extractExecutor(['executor:codex', 'other'])).toBe('codex');
  });

  it('returns undefined when no executor label', () => {
    expect(extractExecutor(['plan', 'bug'])).toBeUndefined();
  });

  it('handles multiple model labels (returns first)', () => {
    expect(extractModel(['model:auto', 'model:claude-sonnet-4'])).toBe('auto');
  });
});

describe('Linear issue sorting', () => {
  it('sorts issues by number (FIFO)', () => {
    const issues = [
      { identifier: 'ENG-45', number: 45 },
      { identifier: 'ENG-42', number: 42 },
      { identifier: 'ENG-43', number: 43 },
    ];
    const sorted = [...issues].sort((a, b) => a.number - b.number);
    expect(sorted.map(i => i.number)).toEqual([42, 43, 45]);
  });
});
