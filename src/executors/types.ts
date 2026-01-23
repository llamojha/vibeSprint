import type { IssueContext } from '../context.js';

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  credits?: number;
  timeSeconds?: number;
  tokensUsed?: number;
  cost?: number;
}

export interface ExecutorOptions {
  model?: string;
  verbose?: boolean;
  timeout?: number;
}

export interface Executor {
  name: string;
  execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult>;
  getAvailableModels(): { value: string; name: string }[];
  validateSetup(): Promise<{ valid: boolean; errors: string[] }>;
}
