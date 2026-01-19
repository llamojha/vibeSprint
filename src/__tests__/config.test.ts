import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

// Test helpers
const TEST_CONFIG_PATH = join(process.cwd(), '.vibesprint');

function cleanup() {
  if (existsSync(TEST_CONFIG_PATH)) {
    unlinkSync(TEST_CONFIG_PATH);
  }
}

describe('config', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  describe('loadConfig', () => {
    it('returns empty object when config file does not exist', async () => {
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('loads valid config file', async () => {
      const testConfig = { owner: 'test-owner', repo: 'test-repo' };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
      
      // Re-import to get fresh module
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      expect(config.owner).toBe('test-owner');
      expect(config.repo).toBe('test-repo');
    });

    it('returns empty object for corrupted config', async () => {
      writeFileSync(TEST_CONFIG_PATH, 'not valid json {{{');
      
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      expect(config).toEqual({});
    });
  });

  describe('isConfigComplete', () => {
    it('returns false when config is empty', async () => {
      const { isConfigComplete } = await import('../config.js');
      expect(isConfigComplete()).toBe(false);
    });

    it('returns false when config is partial', async () => {
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify({ projectId: 'test' }));
      
      const { isConfigComplete } = await import('../config.js');
      expect(isConfigComplete()).toBe(false);
    });

    it('returns true when all required fields present', async () => {
      const completeConfig = {
        projectId: 'proj-1',
        columnOptionId: 'col-1',
        backlogOptionId: 'back-1',
        inProgressOptionId: 'prog-1',
        inReviewOptionId: 'rev-1',
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(completeConfig));
      
      const { isConfigComplete } = await import('../config.js');
      expect(isConfigComplete()).toBe(true);
    });
  });
});
