import { describe, it, expect } from 'vitest';

// Recreate filter logic from intake.ts for unit testing
function shouldProcessIssue(item: {
  content: { __typename: string; state: string; labels: { nodes: { name: string }[] } } | null;
  fieldValueByName: { optionId: string } | null;
}, targetColumnId: string): boolean {
  if (!item.content || item.content.__typename !== 'Issue') return false;
  if (item.content.state !== 'OPEN') return false;
  if (item.fieldValueByName?.optionId !== targetColumnId) return false;
  
  const labels = item.content.labels.nodes.map(l => l.name);
  if (labels.includes('running') || labels.includes('done')) return false;
  if (labels.includes('failed') && !labels.includes('retry')) return false;
  
  return true;
}

describe('intake filtering', () => {
  const targetColumn = 'ready-col-id';

  const makeItem = (overrides: {
    typename?: string;
    state?: string;
    labels?: string[];
    columnId?: string;
  } = {}) => ({
    content: {
      __typename: overrides.typename ?? 'Issue',
      state: overrides.state ?? 'OPEN',
      labels: { nodes: (overrides.labels ?? []).map(name => ({ name })) },
    },
    fieldValueByName: { optionId: overrides.columnId ?? targetColumn },
  });

  it('accepts open issue in target column', () => {
    expect(shouldProcessIssue(makeItem(), targetColumn)).toBe(true);
  });

  it('rejects non-Issue content types', () => {
    expect(shouldProcessIssue(makeItem({ typename: 'PullRequest' }), targetColumn)).toBe(false);
  });

  it('rejects closed issues', () => {
    expect(shouldProcessIssue(makeItem({ state: 'CLOSED' }), targetColumn)).toBe(false);
  });

  it('rejects issues in wrong column', () => {
    expect(shouldProcessIssue(makeItem({ columnId: 'other-col' }), targetColumn)).toBe(false);
  });

  it('rejects issues with running label', () => {
    expect(shouldProcessIssue(makeItem({ labels: ['running'] }), targetColumn)).toBe(false);
  });

  it('rejects issues with done label', () => {
    expect(shouldProcessIssue(makeItem({ labels: ['done'] }), targetColumn)).toBe(false);
  });

  it('rejects failed issues without retry label', () => {
    expect(shouldProcessIssue(makeItem({ labels: ['failed'] }), targetColumn)).toBe(false);
  });

  it('accepts failed issues with retry label', () => {
    expect(shouldProcessIssue(makeItem({ labels: ['failed', 'retry'] }), targetColumn)).toBe(true);
  });

  it('accepts issues with plan label', () => {
    expect(shouldProcessIssue(makeItem({ labels: ['plan'] }), targetColumn)).toBe(true);
  });

  it('rejects null content', () => {
    const item = { content: null, fieldValueByName: { optionId: targetColumn } };
    expect(shouldProcessIssue(item as any, targetColumn)).toBe(false);
  });
});

describe('issue sorting', () => {
  it('sorts issues by number (FIFO)', () => {
    const issues = [
      { number: 45, title: 'Third' },
      { number: 42, title: 'First' },
      { number: 43, title: 'Second' },
    ];
    const sorted = [...issues].sort((a, b) => a.number - b.number);
    expect(sorted.map(i => i.number)).toEqual([42, 43, 45]);
  });
});
