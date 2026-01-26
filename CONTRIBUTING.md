# Contributing to VibeSprint

Thanks for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint
npm install
npm run build
npm link
```

## Running Tests

```bash
npm test
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests if applicable
4. Run `npm test` to ensure tests pass
5. Submit a pull request

## Code Style

- TypeScript with strict mode
- Use descriptive function and variable names
- Keep functions focused and small

---

## Adding a New Provider

VibeSprint uses a provider abstraction to support different issue tracking systems. Currently supported: GitHub Projects, Linear.

### Provider Interface

All providers implement `IssueProvider` from `src/providers/types.ts`:

```typescript
interface IssueProvider {
  getIssues(): Promise<Issue[]>;           // Fetch issues in "Ready" state
  addLabel(issue, label): Promise<void>;   // Add state label
  removeLabel(issue, label): Promise<void>;// Remove state label
  postComment(issue, body): Promise<void>; // Post comment
  moveToColumn(issue, column): Promise<void>; // Change workflow state
  createSubIssue(parent, title, body): Promise<{id, number}>; // For plan workflow
  ensureLabelsExist(): Promise<void>;      // Create VibeSprint labels
}
```

### Steps to Add a Provider

1. **Create provider file**: `src/providers/yourprovider.ts`

```typescript
import type { IssueProvider, Issue } from './types.js';
import type { RepoConfig } from '../config.js';

export class YourProvider implements IssueProvider {
  constructor(repoConfig: RepoConfig) {
    // Initialize API client
  }

  async getIssues(): Promise<Issue[]> {
    // Query issues in "Ready" state
    // Filter out: running, done, failed (without retry)
    // Sort by issue number (FIFO)
  }

  // ... implement other methods
}
```

2. **Extend RepoConfig** in `src/config.ts`:

```typescript
export interface RepoConfig {
  // ... existing fields
  provider?: 'github' | 'linear' | 'yourprovider';
  yourProviderField?: string;
}
```

3. **Update factory** in `src/providers/index.ts`:

```typescript
import { YourProvider } from './yourprovider.js';

export function createProvider(repoConfig: RepoConfig): IssueProvider {
  if (repoConfig.provider === 'yourprovider') {
    return new YourProvider(repoConfig);
  }
  // ... existing providers
}
```

4. **Add setup flow** in `src/commands/add-repo.ts`:
   - Add option to provider selection prompt
   - Create `addYourProviderRepo()` function for interactive setup

5. **Add tests** in `src/__tests__/yourprovider.test.ts`

### Label Conventions

- State labels should be prefixed: `vibesprint:running`, `vibesprint:failed`, etc.
- Workflow labels are unprefixed: `plan`, `no-curate`
- Model/executor labels: `model:claude-sonnet-4`, `executor:codex`

### Testing Your Provider

```bash
# Run all tests
npm test

# Test specific file
npm test -- src/__tests__/yourprovider.test.ts

# Build and test manually
npm run build
vibesprint config add-repo --yourprovider
vibesprint run --dry-run
```

---

## Reporting Issues

Open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
