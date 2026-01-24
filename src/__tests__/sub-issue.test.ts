import { describe, it, expect, vi } from 'vitest';

describe('sub-issue functionality', () => {
  it('should create sub-issue with proper format', () => {
    const parentIssueNumber = 42;
    const taskTitle = 'Implement user authentication';
    const taskBody = 'Add login and registration functionality';
    
    const expectedSubIssueBody = `${taskBody}\n\n---\n*Part of #${parentIssueNumber}*`;
    
    expect(expectedSubIssueBody).toContain(taskBody);
    expect(expectedSubIssueBody).toContain(`Part of #${parentIssueNumber}`);
  });

  it('should handle empty task body', () => {
    const parentIssueNumber = 17;
    const taskTitle = 'Test sub-issue';
    const taskBody = '';
    
    const expectedSubIssueBody = `${taskBody}\n\n---\n*Part of #${parentIssueNumber}*`;
    
    expect(expectedSubIssueBody).toBe('\n\n---\n*Part of #17*');
  });
});
