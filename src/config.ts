import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ExecutorType } from './executors/index.js';

export interface RepoConfig {
  name: string;
  owner: string;
  repo: string;
  path: string;
  projectId: string;
  projectNumber: number;
  columnFieldId: string;
  columnOptionId: string;
  columnName: string;
  backlogOptionId: string;
  backlogColumnName: string;
  inProgressOptionId: string;
  inProgressColumnName: string;
  inReviewOptionId: string;
  inReviewColumnName: string;
  labelsChecked?: boolean;
}

export interface Config {
  repos: RepoConfig[];
  interval?: number;
  model?: string;
  executor?: ExecutorType;
  codexModel?: string;
}

export { KIRO_MODELS as AVAILABLE_MODELS, CODEX_MODELS } from './executors/index.js';

const CONFIG_DIR = join(homedir(), '.vibesprint');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return { repos: [] };
  }
  try {
    const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    return { repos: [], ...data };
  } catch {
    console.warn('Warning: Config file corrupted, using defaults.');
    return { repos: [] };
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getRepoByName(name: string): RepoConfig | undefined {
  const config = loadConfig();
  return config.repos.find(r => r.name === name || r.repo === name);
}

export function addRepo(repo: RepoConfig): void {
  const config = loadConfig();
  const existing = config.repos.findIndex(r => r.name === repo.name);
  if (existing >= 0) {
    config.repos[existing] = repo;
  } else {
    config.repos.push(repo);
  }
  saveConfig(config);
}

export function removeRepo(name: string): boolean {
  const config = loadConfig();
  const idx = config.repos.findIndex(r => r.name === name || r.repo === name);
  if (idx >= 0) {
    config.repos.splice(idx, 1);
    saveConfig(config);
    return true;
  }
  return false;
}

export function isConfigComplete(): boolean {
  const config = loadConfig();
  return config.repos.length > 0;
}

export function validateConfig(): { valid: boolean; errors: string[] } {
  const config = loadConfig();
  const errors: string[] = [];
  
  if (config.repos.length === 0) {
    errors.push('No repositories configured - run `vibesprint config add-repo`');
    return { valid: false, errors };
  }
  
  for (const repo of config.repos) {
    if (!repo.projectNumber) errors.push(`${repo.name}: Missing project`);
    if (!repo.columnName) errors.push(`${repo.name}: Missing column`);
    if (!existsSync(repo.path)) errors.push(`${repo.name}: Path not found: ${repo.path}`);
  }
  
  return { valid: errors.length === 0, errors };
}
