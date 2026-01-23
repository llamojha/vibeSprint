# Codex CLI Integration

## Goal
Enable VibeSprint to use OpenAI's Codex CLI as an alternative code generation backend, allowing users to choose between kiro-cli and codex based on preference, cost, or capability requirements.

## User Story
As a developer, I can configure VibeSprint to use OpenAI Codex CLI instead of kiro-cli, so I can leverage different AI models and compare results across providers.

## Background

### Why Codex CLI?
- OpenAI's Codex CLI is a competing agentic coding tool
- Some users may prefer OpenAI models (GPT-4, o1, o3)
- Cost optimization - different pricing models
- Redundancy - fallback if one service is unavailable
- Model diversity - different models excel at different tasks

### Current Executor Architecture
The existing `executeKiro()` function in `src/executor.ts`:
```typescript
export async function executeKiro(context: IssueContext, model?: string, verbose?: boolean): Promise<ExecutionResult> {
  const args = ['chat', '--no-interactive', '--trust-all-tools'];
  // ... spawns kiro-cli with stdin prompt
}
```

This is tightly coupled to kiro-cli. We need an `Executor` abstraction similar to `IssueProvider`.

### Codex CLI Overview
OpenAI's Codex CLI (https://github.com/openai/codex):
- Command: `codex` or `npx @openai/codex`
- Modes: `--full-auto` for autonomous execution
- Auth: `OPENAI_API_KEY` environment variable
- Input: Accepts prompts via stdin or `--prompt` flag
- Output: Streams to stdout, exits with status code

## Scope

### In Scope
- New `Executor` interface abstracting code generation backends
- `KiroExecutor` class (refactor from current `executeKiro`)
- `CodexExecutor` class for OpenAI Codex CLI
- Config command for executor selection
- Model selection per executor
- Unified `ExecutionResult` format

### Out of Scope
- Claude CLI integration (future consideration)
- Cursor CLI integration (future consideration)
- Parallel execution across multiple executors
- Automatic fallback between executors on failure
- Cost tracking across different providers

## Technical Design

### Executor Interface
```typescript
// src/executors/types.ts
export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  credits?: number;      // kiro-specific
  timeSeconds?: number;
  tokensUsed?: number;   // OpenAI-specific
  cost?: number;         // Estimated cost in USD
}

export interface ExecutorOptions {
  model?: string;
  verbose?: boolean;
  timeout?: number;
}

export interface Executor {
  name: string;
  execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult>;
  getAvailableModels(): string[];
  validateSetup(): Promise<{ valid: boolean; errors: string[] }>;
}
```

### Config Schema Extension
```typescript
export interface Config {
  // Existing fields...
  executor?: 'kiro' | 'codex';
  
  // Kiro-specific (existing)
  model?: string;
  
  // Codex-specific
  codexModel?: string;  // gpt-4, o1, o3-mini, etc.
  codexApprovalMode?: 'full-auto' | 'suggest';
}

export const CODEX_MODELS = [
  { value: 'gpt-4.1', name: 'GPT-4.1 | Latest GPT-4 model' },
  { value: 'o4-mini', name: 'o4-mini | Fast reasoning model' },
  { value: 'o3', name: 'o3 | Advanced reasoning' },
  { value: 'gpt-4.1-mini', name: 'GPT-4.1-mini | Cost-effective' },
] as const;
```

### KiroExecutor Implementation
```typescript
// src/executors/kiro.ts
export class KiroExecutor implements Executor {
  name = 'kiro';

  async execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult> {
    // Refactored from current executeKiro()
    const args = ['chat', '--no-interactive', '--trust-all-tools'];
    if (options?.model && options.model !== 'auto') {
      args.push('--model', options.model);
    }
    // ... spawn process, capture output
  }

  getAvailableModels(): string[] {
    return AVAILABLE_MODELS.map(m => m.value);
  }

  async validateSetup(): Promise<{ valid: boolean; errors: string[] }> {
    // Check kiro-cli is installed
    // Check authentication
  }
}
```

### CodexExecutor Implementation
```typescript
// src/executors/codex.ts
export class CodexExecutor implements Executor {
  name = 'codex';

  async execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult> {
    const args = [
      '--full-auto',           // Autonomous mode
      '--quiet',               // Reduce noise
      '--model', options?.model || 'gpt-4.1',
    ];

    return new Promise((resolve) => {
      const child = spawn('codex', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        },
      });

      child.stdin.write(context.prompt);
      child.stdin.end();

      // ... capture output, parse tokens/cost from response
    });
  }

  getAvailableModels(): string[] {
    return CODEX_MODELS.map(m => m.value);
  }

  async validateSetup(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check codex is installed
    const result = spawnSync('codex', ['--version'], { encoding: 'utf-8' });
    if (result.status !== 0) {
      errors.push('Codex CLI not installed. Run: npm install -g @openai/codex');
    }
    
    // Check OPENAI_API_KEY
    if (!process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY environment variable not set');
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

### Executor Factory
```typescript
// src/executors/index.ts
export function createExecutor(): Executor {
  const config = loadConfig();
  switch (config.executor) {
    case 'codex':
      return new CodexExecutor();
    case 'kiro':
    default:
      return new KiroExecutor();
  }
}
```

### Prompt Adaptation
Different executors may need slightly different prompt formats:

```typescript
// src/context.ts
export function buildContext(issue: Issue, executor: 'kiro' | 'codex'): IssueContext {
  const basePrompt = `...`;
  
  if (executor === 'codex') {
    // Codex-specific instructions
    return {
      ...base,
      prompt: `${basePrompt}\n\nIMPORTANT: Save all changes to disk. Do not ask for confirmation.`,
    };
  }
  
  return base;
}
```

### CLI Commands

#### `vibesprint config executor`
```bash
$ vibesprint config executor
? Select code generation backend:
  ❯ kiro (default) - Kiro CLI with Claude models
    codex - OpenAI Codex CLI with GPT/o-series models
```

#### `vibesprint config executor codex`
Direct selection:
```bash
$ vibesprint config executor codex
✓ Executor set to: codex
? Select default model:
  ❯ gpt-4.1
    o4-mini
    o3
    gpt-4.1-mini
```

#### `vibesprint run --executor`
Override per-run:
```bash
$ vibesprint run --executor codex --model o3
```

### Output Parsing

#### Kiro Output
Current parsing extracts credits/time:
```
▸ Credits: 1.3 • Time: 2m 15s
```

#### Codex Output
Parse token usage and estimate cost:
```typescript
function parseCodexOutput(output: string): { tokensUsed?: number; cost?: number } {
  // Codex outputs token counts in verbose mode
  const match = output.match(/Tokens used: (\d+)/);
  if (match) {
    const tokens = parseInt(match[1], 10);
    const cost = estimateCost(tokens, model);
    return { tokensUsed: tokens, cost };
  }
  return {};
}
```

### PR Description Extraction
Both executors need to output PR descriptions in a parseable format. Update prompts to request:
```
---PR_DESCRIPTION_START---
<description>
---PR_DESCRIPTION_END---
```

This format is executor-agnostic.

## Tasks

### Task 1: Executor Interface Definition
- Create `src/executors/types.ts` with `Executor` interface
- Define `ExecutionResult` with unified fields
- Define `ExecutorOptions` for common parameters

### Task 2: Refactor KiroExecutor
- Create `src/executors/kiro.ts`
- Move logic from `executeKiro()` to `KiroExecutor.execute()`
- Implement `validateSetup()` for kiro-cli check
- Implement `getAvailableModels()`

### Task 3: CodexExecutor Implementation
- Create `src/executors/codex.ts`
- Implement `execute()` with `--full-auto` mode
- Implement `validateSetup()` for codex + API key check
- Implement `getAvailableModels()` with OpenAI models

### Task 4: Executor Factory
- Create `src/executors/index.ts` with `createExecutor()`
- Update imports throughout codebase

### Task 5: Config Schema Extension
- Add `executor` field to `Config` interface
- Add `codexModel` field
- Add `CODEX_MODELS` constant

### Task 6: Config Command - Executor Selection
- Implement `vibesprint config executor` command
- Interactive executor selection
- Model selection per executor
- Validation before saving

### Task 7: Run Command Updates
- Add `--executor` flag to `vibesprint run`
- Add `--model` flag override
- Use executor factory in run loop
- Validate executor setup before processing

### Task 8: Context Builder Updates
- Add executor parameter to `buildContext()`
- Adjust prompts for executor-specific requirements
- Ensure PR description format works for both

### Task 9: Output Parsing
- Implement Codex output parsing for tokens/cost
- Unify result format across executors
- Update PR body template with executor-specific metrics

### Task 10: Documentation
- Update README with Codex setup instructions
- Document model options for each executor
- Add troubleshooting for common Codex issues

## Acceptance Criteria
- [ ] `vibesprint config executor` shows available executors
- [ ] `vibesprint config executor codex` configures Codex with model selection
- [ ] `vibesprint run` uses configured executor
- [ ] `vibesprint run --executor codex` overrides config
- [ ] Codex executor successfully processes issues and creates PRs
- [ ] Token usage displayed for Codex runs
- [ ] Validation errors shown if Codex CLI not installed
- [ ] Validation errors shown if OPENAI_API_KEY not set
- [ ] Both executors produce compatible PR descriptions

## Dependencies
- OpenAI Codex CLI: `npm install -g @openai/codex`
- Environment: `OPENAI_API_KEY` for Codex

## Security Considerations
- `OPENAI_API_KEY` stored in env var only, never in config file
- No API keys logged or included in PR descriptions
- Codex runs with same filesystem permissions as VibeSprint

## Future Considerations
- **Claude CLI**: When Anthropic releases a CLI, add `ClaudeExecutor`
- **Cursor CLI**: If Cursor exposes CLI, add `CursorExecutor`
- **Fallback Chain**: Configure primary + fallback executor
- **A/B Testing**: Run same issue through multiple executors, compare results
- **Cost Tracking**: Aggregate costs across runs, set budgets
