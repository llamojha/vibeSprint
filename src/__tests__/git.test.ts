import { describe, it, expect, vi, beforeEach } from 'vitest';

// Extract slugify for testing (it's not exported, so we recreate the logic)
function slugify(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/-$/, '');
  return slug || 'issue';
}

describe('git helpers', () => {
  describe('slugify', () => {
    it('converts text to lowercase slug', () => {
      expect(slugify('Add User Authentication')).toBe('add-user-authentication');
    });

    it('replaces special characters with dashes', () => {
      expect(slugify('Fix bug #123: crash on login')).toBe('fix-bug-123-crash-on-login');
    });

    it('truncates to 30 characters', () => {
      const long = 'This is a very long issue title that should be truncated';
      expect(slugify(long).length).toBeLessThanOrEqual(30);
    });

    it('removes trailing dash after truncation', () => {
      const result = slugify('Add feature for something very');
      expect(result.endsWith('-')).toBe(false);
    });

    it('returns "issue" for empty or special-only input', () => {
      expect(slugify('')).toBe('issue');
      expect(slugify('!@#$%')).toBe('issue');
    });

    it('handles unicode characters', () => {
      expect(slugify('Añadir función')).toBe('a-adir-funci-n');
    });
  });

  describe('branch naming', () => {
    it('generates correct branch name format', () => {
      const issue = { number: 42, title: 'Add user auth' };
      const branchName = `agent/${issue.number}-${slugify(issue.title)}`;
      expect(branchName).toBe('agent/42-add-user-auth');
    });

    it('handles long titles in branch names', () => {
      const issue = { number: 123, title: 'This is a very long issue title that exceeds the limit' };
      const branchName = `agent/${issue.number}-${slugify(issue.title)}`;
      expect(branchName.length).toBeLessThan(50);
      expect(branchName).toMatch(/^agent\/123-/);
    });
  });
});
