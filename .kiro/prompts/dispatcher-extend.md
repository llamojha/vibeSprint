---
description: Extend VibeSprint with new executor
---

# Add New Executor

Guide to adding a new AI coding CLI as an executor.

## Steps

1. Create `src/executors/<name>.ts` with:
   - Command and arguments
   - Prompt passing method (stdin/arg/file)
   - Output parsing if needed

2. Add executor option to `src/config.ts`:
   - Add to Config interface
   - Add to AVAILABLE_EXECUTORS

3. Update `src/executor.ts`:
   - Import new executor
   - Add switch case for executor type

4. Update CLI:
   - Add executor selection to setup flow
   - Add `config executor` command

## Executor Interface

```typescript
interface Executor {
  execute(prompt: string, verbose?: boolean): Promise<ExecutionResult>;
}
```

## Example: Adding Aider

```typescript
// src/executors/aider.ts
export async function executeAider(context: IssueContext, verbose?: boolean): Promise<ExecutionResult> {
  const args = ['--yes', '--no-git', '--message', context.prompt];
  // spawn and handle output...
}
```