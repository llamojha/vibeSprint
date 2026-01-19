import { spawn } from 'child_process';
import type { IssueContext } from './context.js';
import { loadConfig } from './config.js';
import { stripAnsi } from './utils.js';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  credits?: number;
  timeSeconds?: number;
}

function parseCredits(output: string): { credits?: number; timeSeconds?: number } {
  const clean = stripAnsi(output);
  const match = clean.match(/▸\s*Credits:\s*([\d.]+)\s*•\s*Time:\s*(\d+)m?\s*(\d+)?s/);
  if (match) {
    const credits = parseFloat(match[1]);
    const timeSeconds = match[3] ? parseInt(match[2], 10) * 60 + parseInt(match[3], 10) : parseInt(match[2], 10);
    console.log(`📊 Parsed credits: ${credits}, time: ${timeSeconds}s`);
    return { credits, timeSeconds };
  }
  console.log(`⚠️ Could not parse credits from output. Last 200 chars: ${clean.slice(-200)}`);
  return {};
}

export async function executeKiro(context: IssueContext, model?: string, verbose?: boolean): Promise<ExecutionResult> {
  const config = loadConfig();
  const args = ['chat', '--no-interactive', '--trust-all-tools'];
  
  // Priority: issue label > config > auto
  const selectedModel = model || config.model;
  if (selectedModel && selectedModel !== 'auto') {
    args.push('--model', selectedModel);
  }

  if (verbose) {
    console.log(`🔧 Running: kiro-cli ${args.join(' ')}`);
  }

  return new Promise((resolve) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const child = spawn('kiro-cli', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout.push(text);
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr.push(text);
      process.stderr.write(text);
    });

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        success: false,
        exitCode: 124,
        stdout: stdout.join(''),
        stderr: stderr.join('') + '\n[TIMEOUT: Process killed after 10 minutes]',
      });
    }, TIMEOUT_MS);

    child.stdin.write(context.prompt);
    child.stdin.end();

    child.on('close', (code) => {
      clearTimeout(timeout);
      const fullOutput = stdout.join('');
      const fullStderr = stderr.join('');
      const { credits, timeSeconds } = parseCredits(fullOutput + fullStderr);
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        stdout: fullOutput,
        stderr: fullStderr,
        credits,
        timeSeconds,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        exitCode: 1,
        stdout: stdout.join(''),
        stderr: `Failed to start kiro-cli: ${err.message}`,
      });
    });
  });
}
