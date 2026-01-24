import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOGS_DIR = join(homedir(), '.vibesprint', 'logs');

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getLogPath(repoName: string, issueNumber: number): string {
  return join(LOGS_DIR, `${repoName}-${issueNumber}.log`);
}

export function startIssueLog(repoName: string, issueNumber: number, title: string): void {
  ensureLogsDir();
  const path = getLogPath(repoName, issueNumber);
  writeFileSync(path, `=== Issue #${issueNumber}: ${title} ===\n${new Date().toISOString()}\n\n`);
}

export function appendIssueLog(repoName: string, issueNumber: number, text: string): void {
  const path = getLogPath(repoName, issueNumber);
  if (existsSync(path)) {
    appendFileSync(path, text);
  }
}

export function readIssueLog(repoName: string, issueNumber: number): string {
  const path = getLogPath(repoName, issueNumber);
  if (!existsSync(path)) return 'No log found';
  return readFileSync(path, 'utf-8');
}

export function issueLogExists(repoName: string, issueNumber: number): boolean {
  return existsSync(getLogPath(repoName, issueNumber));
}
