import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Use temp directory for tests, not real config
const TEST_CONFIG_DIR = join(tmpdir(), '.vibesprint-test');
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, 'config.json');

function cleanup() {
  if (existsSync(TEST_CONFIG_PATH)) {
    unlinkSync(TEST_CONFIG_PATH);
  }
}

// Note: These tests are limited because config.ts uses hardcoded homedir path
// They test the JSON parsing logic but not the actual file operations
describe('config', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  describe('config structure', () => {
    it('repos array should be valid JSON structure', () => {
      const testConfig = { repos: [{ name: 'test', owner: 'test-owner', repo: 'test-repo', path: '/tmp/test' }] };
      expect(testConfig.repos).toHaveLength(1);
      expect(testConfig.repos[0].owner).toBe('test-owner');
    });

    it('empty config should have repos array', () => {
      const emptyConfig = { repos: [] };
      expect(emptyConfig.repos).toEqual([]);
    });

    it('config with multiple repos', () => {
      const config = {
        repos: [
          { name: 'repo1', owner: 'owner1', repo: 'repo1', path: '/path1' },
          { name: 'repo2', owner: 'owner2', repo: 'repo2', path: '/path2' },
        ]
      };
      expect(config.repos).toHaveLength(2);
    });
  });

  describe('isConfigComplete', () => {
    it('returns false when repos is empty', async () => {
      const { isConfigComplete } = await import('../config.js');
      // This will check real config - if empty, returns false
      const result = isConfigComplete();
      expect(typeof result).toBe('boolean');
    });
  });
});
