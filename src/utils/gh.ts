import { spawnSync } from 'child_process';

export interface GhResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export interface RepoRef {
  owner: string;
  repo: string;
}

export function gh(args: string[], repoRef?: RepoRef): GhResult {
  const repoArgs = repoRef ? ['-R', `${repoRef.owner}/${repoRef.repo}`] : [];
  const result = spawnSync('gh', [...repoArgs, ...args], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export function ghJson<T>(args: string[], repoRef?: RepoRef): T | null {
  const result = gh(args, repoRef);
  if (!result.success) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export function ghProject(args: string[], owner?: string): GhResult {
  const ownerArgs = owner ? ['--owner', owner] : [];
  const result = spawnSync('gh', ['project', ...args, ...ownerArgs], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  return {
    success: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

export function ghProjectJson<T>(args: string[], owner?: string): T | null {
  const result = ghProject(args, owner);
  if (!result.success) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}
