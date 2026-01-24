import { spawnSync } from 'child_process';
import { loadConfig } from '../config.js';

export interface GhResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export function gh(args: string[]): GhResult {
  const config = loadConfig();
  const repoArgs = config.owner && config.repo ? ['-R', `${config.owner}/${config.repo}`] : [];
  const result = spawnSync('gh', [...repoArgs, ...args], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export function ghJson<T>(args: string[]): T | null {
  const result = gh(args);
  if (!result.success) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export function ghProject(args: string[], includeOwner = true): GhResult {
  const config = loadConfig();
  const ownerArgs = includeOwner && config.owner ? ['--owner', config.owner] : [];
  const result = spawnSync('gh', ['project', ...args, ...ownerArgs], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export function ghProjectJson<T>(args: string[]): T | null {
  const result = ghProject(args);
  if (!result.success) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}
