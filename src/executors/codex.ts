import { spawn, spawnSync } from 'child_process';
import type { IssueContext } from '../context.js';
import { stripAnsi } from '../utils.js';
import type { Executor, ExecutionResult, ExecutorOptions } from './types.js';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const CODEX_MODELS = [
  { value: 'gpt-5.2-codex', name: 'gpt-5.2-codex | Latest frontier agentic coding model' },
  { value: 'gpt-5.2', name: 'gpt-5.2 | Latest frontier model with improvements across knowledge, reasoning and coding' },
  { value: 'gpt-5.1-codex-max', name: 'gpt-5.1-codex-max | Codex-optimized flagship for deep and fast reasoning' },
  { value: 'gpt-5.1-codex-mini', name: 'gpt-5.1-codex-mini | Optimized for codex. Cheaper, faster, but less capable' },
] as const;

function parseTokens(output: string): { tokensUsed?: number; cost?: number } {
  const clean = stripAnsi(output);
  const match = clean.match(/Tokens?\s*(?:used)?:?\s*(\d[\d,]*)/i);
  if (match) {
    const tokensUsed = parseInt(match[1].replace(/,/g, ''), 10);
    return { tokensUsed };
  }
  return {};
}

export class CodexExecutor implements Executor {
  name = 'codex';

  getAvailableModels() {
    return [...CODEX_MODELS];
  }

  async validateSetup(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    const result = spawnSync('codex', ['--version'], { encoding: 'utf-8' });
    if (result.status !== 0) {
      errors.push('Codex CLI not installed. Run: npm install -g @openai/codex');
    }
    
    return { valid: errors.length === 0, errors };
  }

  async execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult> {
    const args = ['--ask-for-approval', 'never'];
    if (options?.model) {
      args.push('-m', options.model);
    }
    args.push('exec', '--sandbox', 'danger-full-access');

    if (options?.verbose) {
      console.log(`🔧 Running: codex ${args.join(' ')}`);
    }

    return new Promise((resolve) => {
      const stdout: string[] = [];
      const stderr: string[] = [];

      const child = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: options?.cwd || process.cwd(),
        env: { ...process.env },
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
        const { tokensUsed, cost } = parseTokens(fullOutput + fullStderr);
        resolve({
          success: code === 0,
          exitCode: code ?? 1,
          stdout: fullOutput,
          stderr: fullStderr,
          tokensUsed,
          cost,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          exitCode: 1,
          stdout: stdout.join(''),
          stderr: `Failed to start codex: ${err.message}`,
        });
      });
    });
  }
}
