import { describe, it, expect } from 'vitest';
import { parsePRDescription, parsePlanOutput } from '../context.js';

describe('context', () => {
  describe('parsePRDescription', () => {
    it('extracts PR description from output', () => {
      const output = `
Some kiro output here
---PR_DESCRIPTION_START---
This PR adds a new feature.

- Added foo
- Fixed bar
---PR_DESCRIPTION_END---
More output
`;
      const result = parsePRDescription(output);
      expect(result).toContain('This PR adds a new feature');
      expect(result).toContain('Added foo');
    });

    it('returns undefined when no markers found', () => {
      const output = 'Just some regular output without markers';
      const result = parsePRDescription(output);
      expect(result).toBeUndefined();
    });

    it('handles flexible marker format with extra dashes', () => {
      const output = `
------PR_DESCRIPTION_START------
Description here
------PR_DESCRIPTION_END------
`;
      const result = parsePRDescription(output);
      expect(result).toBe('Description here');
    });
  });

  describe('parsePlanOutput', () => {
    it('extracts tasks from plan output', () => {
      const output = `
---PLAN_START---
## Task 1: Add authentication
Implement OAuth2 flow

## Task 2: Create user model
Add User table with fields
---PLAN_END---
`;
      const tasks = parsePlanOutput(output);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].title).toBe('Add authentication');
      expect(tasks[0].body).toContain('OAuth2');
      expect(tasks[1].title).toBe('Create user model');
    });

    it('returns empty array when no plan markers', () => {
      const output = 'No plan here';
      const tasks = parsePlanOutput(output);
      expect(tasks).toEqual([]);
    });

    it('handles single task', () => {
      const output = `
---PLAN_START---
## Task 1: Single task
Just one thing to do
---PLAN_END---
`;
      const tasks = parsePlanOutput(output);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Single task');
    });
  });
});
