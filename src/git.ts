import { spawnSync } from 'child_process';
import { gh, ghJson } from './utils/gh.js';
import type { Issue } from './intake.js';
import { createProvider } from './providers/index.js';
import { LinearProvider } from './providers/linear.js';

function slugify(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30).replace(/-$/, '');
  return slug || 'issue';
}

function getBranchPrefix(labels: string[]): string {
  const labelSet = new Set(labels.map(l => l.toLowerCase()));
  
  if (labelSet.has('bug') || labelSet.has('fix')) return 'fix';
  if (labelSet.has('docs') || labelSet.has('documentation')) return 'docs';
  if (labelSet.has('chore') || labelSet.has('maintenance')) return 'chore';
  if (labelSet.has('refactor')) return 'refactor';
  if (labelSet.has('test') || labelSet.has('testing')) return 'test';
  
  return 'feat';
}

function gitInDir(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf-8', cwd });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}

function branchExistsInDir(cwd: string, branchName: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', branchName], { encoding: 'utf-8', cwd });
  return result.status === 0;
}

function findExistingPR(branchName: string, repoRef: { owner: string; repo: string }): number | null {
  const result = ghJson<Array<{ number: number; headRefName: string }> | { pullRequests: Array<{ number: number }> }>(
    ['pr', 'list', '--head', branchName, '--state', 'open', '--json', 'number,headRefName'],
    repoRef
  );
  const prs = Array.isArray(result) ? result : result?.pullRequests || [];
  return prs.length > 0 ? prs[0].number : null;
}

export async function createBranchAndPR(issue: Issue, prDescription?: string, credits?: number, timeSeconds?: number): Promise<string> {
  if (!issue.repoConfig) {
    throw new Error('Issue missing repoConfig');
  }

  const repo = issue.repoConfig;
  const cwd = repo.path;
  const repoRef = { owner: repo.owner, repo: repo.repo };
  const isLinear = repo.provider === 'linear';
  
  // Build branch name with conventional prefix
  const prefix = getBranchPrefix(issue.labels);
  const issueId = issue.identifier || String(issue.number);
  const branchName = `${prefix}/${issueId}-${slugify(issue.title)}`;

  const git = (...args: string[]) => gitInDir(cwd, ...args);

  // Get default branch from origin/HEAD
  let defaultBranch = 'main';
  try {
    const ref = gitInDir(cwd, 'symbolic-ref', 'refs/remotes/origin/HEAD');
    defaultBranch = ref.replace('refs/remotes/origin/', '');
  } catch {
    // Fallback to main if origin/HEAD not set
  }

  // Stash all changes including untracked
  const gitStatus = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf-8', cwd });
  const hasChanges = gitStatus.stdout.trim().length > 0;
  if (hasChanges) git('stash', '--include-untracked');
  git('pull', '--rebase', 'origin', defaultBranch);
  if (hasChanges) {
    try {
      git('stash', 'pop');
    } catch {
      // Stash conflict - changes already applied
    }
  }

  // Create branch
  if (branchExistsInDir(cwd, branchName)) {
    git('checkout', defaultBranch);
    try {
      git('branch', '-D', branchName);
    } catch {
      // Branch might be in use by worktree
    }
  }
  
  // Use gh issue develop to link branch to issue (GitHub only)
  if (!isLinear) {
    const develop = gh(['issue', 'develop', String(issue.number), '--name', branchName, '--checkout'], repoRef);
    if (!develop.success) {
      try {
        git('checkout', '-b', branchName);
      } catch {
        git('checkout', branchName);
      }
    }
  } else {
    try {
      git('checkout', '-b', branchName);
    } catch {
      git('checkout', branchName);
    }
  }

  git('add', '-A');
  
  // Check if there are changes to commit
  const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf-8', cwd });
  if (!status.stdout.trim()) {
    const existingPr = findExistingPR(branchName, repoRef);
    if (existingPr) {
      git('checkout', defaultBranch);
      return `https://github.com/${repo.owner}/${repo.repo}/pull/${existingPr}`;
    }
    throw new Error('No changes were made by kiro-cli. Check if the issue was already resolved or needs clearer instructions.');
  }
  
  // Commit message with appropriate reference
  const commitRef = isLinear ? `Refs ${issue.identifier}` : `Refs #${issue.number}`;
  try {
    git('commit', '-m', `${prefix}: ${issue.title}\n\n${commitRef}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to commit changes: ${errorMsg}\n\nEnsure git user.name and user.email are configured:\n  git config --global user.name "Your Name"\n  git config --global user.email "your@email.com"`);
  }

  // Try force-with-lease first, fall back to force if stale
  try {
    git('push', '-u', 'origin', branchName, '--force-with-lease');
  } catch {
    git('push', '-u', 'origin', branchName, '--force');
  }

  // Build PR body with appropriate reference
  const creditsLine = credits !== undefined ? `\n\n---\n🤖 *Generated by VibeSprint* • Credits: ${credits} • Time: ${timeSeconds}s` : '';
  let body: string;
  if (isLinear) {
    body = prDescription || `## Summary\n\n${issue.body || 'Auto-generated from issue.'}\n\nRefs Linear: [${issue.identifier}](${issue.url})`;
  } else {
    body = prDescription || `## Summary\n\n${issue.body || 'Auto-generated from issue.'}\n\nFixes #${issue.number}`;
  }
  body += creditsLine;

  const existingPrNumber = findExistingPR(branchName, repoRef);

  let prUrl: string;
  if (existingPrNumber) {
    gh(['pr', 'edit', String(existingPrNumber), '--body', body], repoRef);
    prUrl = `https://github.com/${repo.owner}/${repo.repo}/pull/${existingPrNumber}`;
  } else {
    const prResult = gh([
      'pr', 'create',
      '--title', issue.title,
      '--body', body,
      '--head', branchName,
      '--base', defaultBranch,
    ], repoRef);
    if (!prResult.success) {
      throw new Error(`Failed to create PR: ${prResult.stderr}`);
    }
    const urlMatch = prResult.stdout.match(/https:\/\/github\.com\/[^\s]+/);
    prUrl = urlMatch ? urlMatch[0] : `https://github.com/${repo.owner}/${repo.repo}/pulls`;
  }

  // For Linear issues, attach PR and post comment
  if (isLinear) {
    try {
      const provider = createProvider(repo) as LinearProvider;
      await provider.attachPR(issue, prUrl);
      await provider.postComment(issue, `🔗 PR created: ${prUrl}`);
    } catch (err) {
      console.warn(`⚠️ Failed to update Linear issue: ${err instanceof Error ? err.message : err}`);
    }
  }

  git('checkout', defaultBranch);
  return prUrl;
}
