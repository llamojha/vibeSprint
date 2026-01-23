import { KiroExecutor, KIRO_MODELS } from './kiro.js';
import { CodexExecutor, CODEX_MODELS } from './codex.js';
import type { Executor } from './types.js';

export type ExecutorType = 'kiro' | 'codex';

export function createExecutor(type: ExecutorType = 'kiro'): Executor {
  switch (type) {
    case 'codex':
      return new CodexExecutor();
    case 'kiro':
    default:
      return new KiroExecutor();
  }
}

export { KiroExecutor, KIRO_MODELS } from './kiro.js';
export { CodexExecutor, CODEX_MODELS } from './codex.js';
export type { Executor, ExecutionResult, ExecutorOptions } from './types.js';
