import { spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DAEMON_DIR = join(homedir(), '.vibesprint');
const PID_FILE = join(DAEMON_DIR, 'daemon.pid');
const LOG_FILE = join(DAEMON_DIR, 'daemon.log');

export function isDaemonRunning(): boolean {
  if (!existsSync(PID_FILE)) return false;
  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
  try {
    process.kill(pid, 0); // Check if process exists
    return true;
  } catch {
    unlinkSync(PID_FILE); // Stale PID file
    return false;
  }
}

export function getDaemonPid(): number | null {
  if (!existsSync(PID_FILE)) return null;
  return parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
}

export function startDaemon(interval: number): void {
  // Clear old log
  writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Daemon started\n`);

  const child = spawn(process.execPath, [process.argv[1], 'run', '--interval', String(interval)], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, VIBESPRINT_DAEMON: '1' },
  });

  child.stdout?.on('data', (data) => {
    appendFileSync(LOG_FILE, data.toString());
  });

  child.stderr?.on('data', (data) => {
    appendFileSync(LOG_FILE, data.toString());
  });

  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`✓ Daemon started (PID: ${child.pid})`);
  console.log(`  Logs: ${LOG_FILE}`);
}

export function stopDaemon(): boolean {
  const pid = getDaemonPid();
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    unlinkSync(PID_FILE);
    return true;
  } catch {
    return false;
  }
}

export function getLogFile(): string {
  return LOG_FILE;
}

export function tailLog(lines = 20): string[] {
  if (!existsSync(LOG_FILE)) return [];
  const content = readFileSync(LOG_FILE, 'utf-8');
  return content.split('\n').slice(-lines);
}
