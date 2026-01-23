import { spawn, spawnSync } from 'child_process';
import type { IssueContext } from '../context.js';
import { stripAnsi } from '../utils.js';
import type { Executor, ExecutionResult, ExecutorOptions } from './types.js';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const KIRO_MODELS = [
  { value: 'auto', name: 'Auto | 1x credit | Models chosen by task for optimal usage' },
  { value: 'claude-sonnet-4.5', name: 'claude-sonnet-4.5 | 1.3x credit | The latest Claude Sonnet model' },
  { value: 'claude-sonnet-4', name: 'claude-sonnet-4 | 1.3x credit | Hybrid reasoning and coding' },
  { value: 'claude-haiku-4.5', name: 'claude-haiku-4.5 | 0.4x credit | The latest Claude Haiku model' },
  { value: 'claude-opus-4.5', name: 'claude-opus-4.5 | 2.2x credit | The latest Claude Opus model' },
] as const;

function parseCredits(output: string): { credits?: number; timeSeconds?: number } {
  const clean = stripAnsi(output);
  const match = clean.match(/▸\s*Credits:\s*([\d.]+)\s*•\s*Time:\s*(\d+)m?\s*(\d+)?s/);
  if (match) {
    const credits = parseFloat(match[1]);
    const timeSeconds = match[3] ? parseInt(match[2], 10) * 60 + parseInt(match[3], 10) : parseInt(match[2], 10);
    return { credits, timeSeconds };
  }
  return {};
}

export class KiroExecutor implements Executor {
  name = 'kiro';

  getAvailableModels() {
    return [...KIRO_MODELS];
  }

  async validateSetup(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const result = spawnSync('kiro-cli', ['--version'], { encoding: 'utf-8' });
    if (result.status !== 0) {
      errors.push('kiro-cli not installed. See: https://kiro.dev/docs/cli/installation');
    }
    return { valid: errors.length === 0, errors };
  }

  async execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult> {
    const args = ['chat', '--no-interactive', '--trust-all-tools'];
    
    if (options?.model && options.model !== 'auto') {
      args.push('--model', options.model);
    }

    if (options?.verbose) {
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
      }, options?.timeout || TIMEOUT_MS);

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
}
