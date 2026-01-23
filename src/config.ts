import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ExecutorType } from './executors/index.js';

export interface Config {
  owner?: string;
  repo?: string;
  projectId?: string;
  projectNumber?: number;
  columnFieldId?: string;
  columnOptionId?: string;
  columnName?: string;
  backlogOptionId?: string;
  backlogColumnName?: string;
  inProgressOptionId?: string;
  inProgressColumnName?: string;
  inReviewOptionId?: string;
  inReviewColumnName?: string;
  interval?: number;
  model?: string;
  provider?: 'github';
  executor?: ExecutorType;
  codexModel?: string;
}

export { KIRO_MODELS as AVAILABLE_MODELS, CODEX_MODELS } from './executors/index.js';

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

export function isConfigComplete(): boolean {
  const config = loadConfig();
  return !!(config.projectNumber && config.columnName && config.backlogColumnName && config.inProgressColumnName && config.inReviewColumnName);
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const config = loadConfig();
  const errors: string[] = [];
  
  if (!config.owner) errors.push('Missing owner - run `vibesprint config link`');
  if (!config.repo) errors.push('Missing repo - run `vibesprint config link`');
  if (!config.projectNumber) errors.push('Missing project - run `vibesprint config link`');
  if (!config.columnName) errors.push('Missing column - run `vibesprint config column`');
  if (!config.backlogColumnName) errors.push('Missing Backlog column - run `vibesprint config column`');
  if (!config.inProgressColumnName) errors.push('Missing In Progress column - run `vibesprint config column`');
  if (!config.inReviewColumnName) errors.push('Missing In Review column - run `vibesprint config column`');
  
  return { valid: errors.length === 0, errors };
}
