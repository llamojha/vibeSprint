# VibeSprint Technical Documentation

> **Developer guide for understanding VibeSprint's architecture, contributing code, and extending functionality.**

## Architecture Overview

VibeSprint is a polling-based automation system that converts GitHub issues into pull requests using AI code generation. The architecture follows a modular design with clear separation of concerns.

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub API    │    │   Config Store  │    │  Local Git Repo │
│   (Projects)    │    │  (~/.vibesprint)│    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VibeSprint CLI                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Issue Intake  │  Context Builder │      Status Manager         │
│   (polling)     │  (prompts)      │   (labels, comments)        │
├─────────────────┼─────────────────┼─────────────────────────────┤
│   Executors     │   Git Operations │      Provider System        │
│ (kiro/codex)    │ (branch, PR)    │     (GitHub)                │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Data Flow

1. **Polling Loop**: Monitor GitHub Project board for issues in "Ready" column
2. **Issue Processing**: Extract issue context, comments, and repository state
3. **Code Generation**: Execute AI models (Kiro CLI or Codex) with curated prompts
4. **Git Operations**: Create branch, commit changes, open pull request
5. **Status Updates**: Move issues between columns, update labels, post comments

### Design Principles

- **Local-First**: No cloud dependencies, runs entirely on user's machine
- **Polling Over Webhooks**: Simpler setup, no server infrastructure required
- **Modular Executors**: Pluggable AI backends (Kiro CLI, OpenAI Codex)
- **Provider Pattern**: Extensible issue tracking integration (GitHub Projects)
- **Idempotent Operations**: Safe to restart, handles partial failures gracefully

## Code Structure

```
src/
├── cli.ts                 # CLI entry point and command routing
├── run.ts                 # Main polling loop and issue processing
├── config.ts              # Configuration management (~/.vibesprint)
├── intake.ts              # Issue fetching and filtering
├── context.ts             # Prompt building and context curation
├── git.ts                 # Git operations (branch, commit, PR)
├── status.ts              # Issue status updates (labels, comments)
├── utils.ts               # Utility functions
├── commands/              # CLI command implementations
│   ├── add-repo.ts        # Repository configuration
│   ├── list-repos.ts      # Repository management
│   ├── menu.ts            # Interactive menus
│   └── executor.ts        # Executor selection
├── executors/             # AI code generation backends
│   ├── types.ts           # Executor interface definitions
│   ├── kiro.ts            # Kiro CLI integration
│   ├── codex.ts           # OpenAI Codex integration
│   └── index.ts           # Executor factory
├── providers/             # Issue tracking integrations
│   ├── types.ts           # Provider interface definitions
│   ├── github.ts          # GitHub Projects integration
│   └── index.ts           # Provider factory
├── ui/                    # Terminal UI components
│   └── dashboard.tsx      # Real-time dashboard (React/Ink)
├── utils/                 # Utility modules
│   └── gh.ts              # GitHub CLI wrapper
└── __tests__/             # Unit tests
    ├── config.test.ts
    ├── git.test.ts
    ├── context.test.ts
    └── intake.test.ts
```

### Key Modules

#### Core Processing (`run.ts`)
- `run()`: Main polling loop with configurable interval
- `processIssue()`: Route issues to implement or plan workflows
- `processImplementIssue()`: Generate code and create PR
- `processPlanIssue()`: Break down complex issues into sub-tasks

#### Configuration (`config.ts`)
- `RepoConfig`: Repository and project board configuration
- `loadConfig()` / `saveConfig()`: Persistent configuration management
- `validateConfig()`: Configuration validation and error reporting

#### Context Building (`context.ts`)
- `buildContext()`: Curate prompts from issue content and repository state
- `buildSimplePrompt()` / `buildCuratedPrompt()`: Different prompt strategies
- `parsePRDescription()`: Extract PR metadata from AI output

#### Executors (`executors/`)
- `Executor` interface: Standardized AI backend integration
- `KiroExecutor`: Kiro CLI integration with model selection
- `CodexExecutor`: OpenAI Codex CLI integration
- `ExecutionResult`: Standardized output format with metrics

#### Providers (`providers/`)
- `IssueProvider` interface: Issue tracking system integration
- `GitHubProvider`: GitHub Projects API integration
- Label management and column operations

## Development Setup

### Prerequisites

```bash
# Node.js 18+
node --version  # Should be 18.0.0+

# GitHub CLI (authenticated)
gh auth login

# AI Backend (choose one)
# Option 1: Kiro CLI
curl -fsSL https://kiro.dev/install.sh | sh

# Option 2: OpenAI Codex CLI
npm install -g @openai/codex
codex login
```

### Installation

```bash
# Clone and setup
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint
npm install

# Build TypeScript
npm run build

# Link for global usage (optional)
npm link

# Run tests
npm test
```

### Development Workflow

```bash
# Development mode (TypeScript compilation)
npm run dev

# Watch mode for tests
npm run test:watch

# Build for production
npm run build

# Run built version
npm start
```

### Testing

VibeSprint uses Vitest for unit testing. Tests are located in `src/__tests__/`.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Test specific file
npx vitest src/__tests__/config.test.ts
```

**Test Coverage Areas:**
- Configuration loading/saving
- Git operations and branch naming
- Context building and prompt curation
- Issue filtering and processing logic

## API Documentation

### Core Interfaces

#### `Executor` Interface
```typescript
interface Executor {
  name: string;
  execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult>;
  getAvailableModels(): { value: string; name: string }[];
  validateSetup(): Promise<{ valid: boolean; errors: string[] }>;
}
```

#### `IssueProvider` Interface
```typescript
interface IssueProvider {
  getIssues(): Promise<Issue[]>;
  addLabel(issueNumber: number, label: string): Promise<void>;
  removeLabel(issueNumber: number, label: string): Promise<void>;
  postComment(issueNumber: number, body: string): Promise<void>;
  moveToColumn(issueNumber: number, columnId: string): Promise<void>;
  createSubIssue(title: string, body: string, parentNumber: number): Promise<number>;
}
```

#### `IssueContext` Interface
```typescript
interface IssueContext {
  issue: Issue;
  comments: string[];
  prompt: string;
}
```

### Configuration Schema

```typescript
interface RepoConfig {
  name: string;                    // Display name
  owner: string;                   // GitHub owner
  repo: string;                    // Repository name
  path: string;                    // Local repository path
  projectId: string;               // GitHub Project ID
  projectNumber: number;           // GitHub Project number
  columnFieldId: string;           // Status field ID
  columnOptionId: string;          // "Ready" column option ID
  columnName: string;              // "Ready" column name
  backlogOptionId: string;         // "Backlog" column option ID
  inProgressOptionId: string;      // "In Progress" column option ID
  inReviewOptionId: string;        // "In Review" column option ID
}
```

## Extension Points

### Adding New Executors

1. **Create executor class** implementing `Executor` interface:

```typescript
// src/executors/my-executor.ts
export class MyExecutor implements Executor {
  name = 'my-executor';
  
  async execute(context: IssueContext, options?: ExecutorOptions): Promise<ExecutionResult> {
    // Implementation
  }
  
  getAvailableModels() {
    return [{ value: 'model-1', name: 'My Model 1' }];
  }
  
  async validateSetup() {
    // Check if executor is properly configured
  }
}
```

2. **Register in executor factory** (`src/executors/index.ts`):

```typescript
export function createExecutor(type: ExecutorType): Executor {
  switch (type) {
    case 'my-executor': return new MyExecutor();
    // ... existing cases
  }
}
```

3. **Add to type definitions**:

```typescript
export type ExecutorType = 'kiro' | 'codex' | 'my-executor';
```

### Adding New Providers

1. **Create provider class** implementing `IssueProvider` interface:

```typescript
// src/providers/linear.ts
export class LinearProvider implements IssueProvider {
  async getIssues(): Promise<Issue[]> {
    // Fetch issues from Linear API
  }
  
  // Implement other interface methods
}
```

2. **Register in provider factory** (`src/providers/index.ts`):

```typescript
export function createProvider(type: ProviderType, config: any): IssueProvider {
  switch (type) {
    case 'linear': return new LinearProvider(config);
    // ... existing cases
  }
}
```

### Custom Prompt Strategies

Extend context building in `src/context.ts`:

```typescript
export async function buildCustomContext(issue: Issue): Promise<IssueContext> {
  // Custom prompt curation logic
  return {
    issue,
    comments: fetchComments(issue.number),
    prompt: customPromptBuilder(issue)
  };
}
```

### Adding CLI Commands

1. **Create command file** in `src/commands/`:

```typescript
// src/commands/my-command.ts
export async function myCommand(options: any) {
  // Command implementation
}
```

2. **Register in CLI** (`src/cli.ts`):

```typescript
program
  .command('my-command')
  .description('My custom command')
  .action(myCommand);
```

## Performance Considerations

### Polling Efficiency

- **Default interval**: 60 seconds (configurable via `--interval`)
- **Rate limiting**: GitHub API has 5000 requests/hour for authenticated users
- **Optimization**: Only fetch issues when project board changes (not implemented)

### Memory Usage

- **Context size**: Limited to last 10 comments per issue
- **Concurrent processing**: Single-threaded, processes one issue at a time
- **Git operations**: Performed in separate working directory

### Scalability Limits

- **Single repository**: One VibeSprint instance per repository
- **Sequential processing**: Issues processed one at a time (by design)
- **Local execution**: Limited by local machine resources

## Known Limitations

### Technical Constraints

1. **Polling delay**: 60-second default interval means issues aren't processed immediately
2. **Single-threaded**: No parallel issue processing (prevents conflicts)
3. **Local dependencies**: Requires GitHub CLI, Git, and AI backend locally
4. **No auto-merge**: PRs require manual review and merge
5. **Limited retry logic**: Failed issues retry once, then require manual intervention

### GitHub API Limitations

1. **Rate limits**: 5000 requests/hour for authenticated users
2. **Project board access**: Requires repository or organization permissions
3. **Label management**: Limited to predefined label set
4. **Comment size**: GitHub has limits on comment body size

### AI Backend Limitations

1. **Context window**: Limited by underlying AI model context size
2. **Code quality**: Generated code requires human review
3. **Repository understanding**: Limited to provided context
4. **Cost considerations**: AI API usage costs (for Codex)

### Operational Constraints

1. **Network dependency**: Requires internet connection for GitHub API and AI backends
2. **Credential management**: Relies on GitHub CLI authentication
3. **Repository state**: Assumes clean working directory
4. **Branch conflicts**: No automatic conflict resolution

## Troubleshooting

### Common Issues

1. **Configuration errors**: Run `vibesprint config show` to verify setup
2. **GitHub authentication**: Ensure `gh auth status` shows valid authentication
3. **AI backend issues**: Verify executor setup with `vibesprint config executor`
4. **Git conflicts**: Ensure clean working directory before processing
5. **Rate limiting**: Reduce polling frequency if hitting GitHub API limits

### Debug Mode

Enable verbose logging:

```bash
vibesprint run --verbose
```

This shows:
- GitHub API requests and responses
- AI executor commands and output
- Git operations and results
- Detailed error messages

### Log Analysis

VibeSprint outputs structured logs for debugging:
- `📬 Found N issue(s) to process` - Issue intake results
- `🏃 Processing issue #N` - Issue processing start
- `✅ Created PR #N` - Successful PR creation
- `❌ Failed to process issue #N` - Processing failures

## Contributing

### Code Style

- **TypeScript**: Strict mode enabled
- **ESM modules**: Use `.js` extensions in imports
- **Error handling**: Prefer explicit error types over generic catches
- **Async/await**: Preferred over Promise chains

### Pull Request Process

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Update documentation if needed
6. Submit pull request with clear description

### Testing Guidelines

- **Unit tests**: Test individual functions and classes
- **Integration tests**: Test component interactions
- **Mock external dependencies**: GitHub API, AI backends, file system
- **Test edge cases**: Error conditions, invalid inputs, network failures
