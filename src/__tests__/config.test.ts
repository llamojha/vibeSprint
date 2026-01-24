import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_CONFIG_DIR = join(homedir(), '.vibesprint');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'config.json');

function cleanup() {
  if (existsSync(TEST_CONFIG_PATH)) {
    unlinkSync(TEST_CONFIG_PATH);
  }
}

describe('config', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  describe('loadConfig', () => {
    it('returns empty repos array when config file does not exist', async () => {
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      expect(config.repos).toEqual([]);
    });

    it('loads valid config file', async () => {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
      const testConfig = { repos: [{ name: 'test', owner: 'test-owner', repo: 'test-repo', path: '/tmp/test' }] };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
      
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      expect(config.repos.length).toBe(1);
      expect(config.repos[0].owner).toBe('test-owner');
    });

    it('returns empty repos for corrupted config', async () => {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
      writeFileSync(TEST_CONFIG_PATH, 'not valid json {{{');
      
      const { loadConfig } = await import('../config.js');
      const config = loadConfig();
      expect(config.repos).toEqual([]);
    });
  });

  describe('isConfigComplete', () => {
    it('returns false when repos is empty', async () => {
      const { isConfigComplete } = await import('../config.js');
      expect(isConfigComplete()).toBe(false);
    });

    it('returns true when repos has entries', async () => {
      mkdirSync(TEST_CONFIG_DIR, { recursive: true });
      const config = {
        repos: [{
          name: 'test',
          owner: 'owner',
          repo: 'repo',
          path: '/tmp',
          projectId: 'proj-1',
          projectNumber: 1,
          columnFieldId: 'field-1',
          columnOptionId: 'col-1',
          columnName: 'Ready',
          backlogOptionId: 'back-1',
          backlogColumnName: 'Backlog',
          inProgressOptionId: 'prog-1',
          inProgressColumnName: 'In Progress',
          inReviewOptionId: 'rev-1',
          inReviewColumnName: 'In Review',
        }]
      };
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(config));
      
      const { isConfigComplete } = await import('../config.js');
      expect(isConfigComplete()).toBe(true);
    });
  });
});
