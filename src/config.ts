import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Config {
  token?: string;
  owner?: string;
  repo?: string;
  projectId?: string;
  projectNumber?: number;
  columnFieldId?: string;
  columnOptionId?: string;
  columnName?: string;
  backlogOptionId?: string;
  inProgressOptionId?: string;
  inReviewOptionId?: string;
  interval?: number;
  model?: string;
  provider?: 'github';
}

export const AVAILABLE_MODELS = [
  { value: 'auto', name: 'Auto | 1x credit | Models chosen by task for optimal usage' },
  { value: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5 | 1.3x credit | The latest Claude Sonnet model' },
  { value: 'claude-sonnet-4', name: 'claude-sonnet-4 | 1.3x credit | Hybrid reasoning and coding' },
  { value: 'claude-haiku-4.5', name: 'claude-haiku-4.5 | 0.4x credit | The latest Claude Haiku model' },
  { value: 'claude-opus-4.5', name: 'claude-opus-4.5 | 2.2x credit | The latest Claude Opus model' },
] as const;

const CONFIG_FILE = '.vibesprint';
const CONFIG_PATH = join(process.cwd(), CONFIG_FILE);

function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): Config {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.warn('Warning: Config file corrupted, using defaults.');
    return {};
  }
}

export function saveConfig(config: Config): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

export function getToken(): string {
  const config = loadConfig();
  const token = process.env.GITHUB_TOKEN || config.token;
  if (!token) {
    console.error('Error: GITHUB_TOKEN not set. Export it or run config first.');
    process.exit(1);
  }
  return token;
}

export function isConfigComplete(): boolean {
  const config = loadConfig();
  return !!(config.projectId && config.columnOptionId && config.backlogOptionId && config.inProgressOptionId && config.inReviewOptionId);
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const config = loadConfig();
  const errors: string[] = [];
  
  if (!config.owner) errors.push('Missing owner - run `vibesprint config link`');
  if (!config.repo) errors.push('Missing repo - run `vibesprint config link`');
  if (!config.projectId) errors.push('Missing projectId - run `vibesprint config link`');
  if (!config.columnOptionId) errors.push('Missing column - run `vibesprint config column`');
  if (!config.backlogOptionId) errors.push('Missing Backlog column - run `vibesprint config column`');
  if (!config.inProgressOptionId) errors.push('Missing In Progress column - run `vibesprint config column`');
  if (!config.inReviewOptionId) errors.push('Missing In Review column - run `vibesprint config column`');
  
  return { valid: errors.length === 0, errors };
}
