# Multi-Repo Integration

## Goal
Enable a single VibeSprint instance to monitor and process issues across multiple repositories, reducing operational overhead for teams managing several related projects.

## User Story
As a developer managing multiple repositories (e.g., frontend, backend, shared libs), I can configure VibeSprint to monitor all of them from a single instance, processing issues from any repo and creating PRs in the appropriate repository.

## Background

### Current Limitation
VibeSprint currently operates on a single repository:
- Config stored in `.vibesprint` in project root
- `owner`/`repo` fields are singular
- Git operations assume current working directory is the target repo
- One polling loop, one project board

### Use Cases for Multi-Repo
1. **Monorepo-adjacent**: Separate repos that are logically related (frontend + backend + infra)
2. **Microservices**: Multiple service repos under one project board
3. **Shared libraries**: Core libs + consuming applications
4. **Organization-wide**: Single VibeSprint instance for entire org

### Architecture Considerations
- Issues can reference any configured repo
- Git operations must switch context per issue
- PRs created in the correct target repo
- Config complexity increases significantly

## Scope

### In Scope
- Multi-repo configuration schema
- Repo-aware issue intake (issues tagged with target repo)
- Dynamic git context switching
- Per-repo branch/PR creation
- Unified polling across repos

### Out of Scope
- Cross-repo PRs (changes spanning multiple repos)
- Automatic repo detection from issue content
- Repo-specific executor configuration
- Parallel processing across repos (sequential only)
- GitHub organization-level project boards (repo-level only)

## Technical Design

### Config Schema Extension
```typescript
export interface RepoConfig {
  owner: string;
  repo: string;
  path: string;              // Local filesystem path to repo clone
  projectId?: string;        // Optional: repo-specific project board
  columnOptionId?: string;   // Optional: repo-specific column
  defaultBranch?: string;    // e.g., 'main', 'master', 'develop'
}

export interface Config {
  // Single-repo mode (backward compatible)
  owner?: string;
  repo?: string;
  projectId?: string;
  columnOptionId?: string;
  // ... other existing fields
  
  // Multi-repo mode
  multiRepo?: boolean;
  repos?: RepoConfig[];
  
  // Shared project board (optional)
  sharedProjectId?: string;
  sharedColumnOptionId?: string;
}
```

### Issue-to-Repo Mapping

#### Option A: Label-based (Recommended)
Issues tagged with `repo:<name>` label:
```
Issue: "Add user authentication"
Labels: [repo:backend, plan]
```

VibeSprint reads the `repo:*` label to determine target repository.

#### Option B: Project Field
GitHub Projects V2 supports custom fields. Add a "Repository" single-select field:
```
Issue in Project Board:
  Status: Ready
  Repository: backend
```

#### Option C: Issue Repository
If using repo-specific project boards, the issue's repository is implicit.

**Decision**: Use Option A (labels) for simplicity and compatibility with existing label system.

### Multi-Repo Issue Interface
```typescript
export interface Issue {
  // Existing fields...
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  projectItemId: string;
  labels: string[];
  model?: string;
  
  // Multi-repo additions
  targetRepo?: string;       // Extracted from repo:* label
  repoConfig?: RepoConfig;   // Resolved config for target repo
}
```

### GitHubProvider Updates
```typescript
// src/providers/github.ts
export class GitHubProvider implements IssueProvider {
  async getIssues(): Promise<Issue[]> {
    const issues = await this.fetchIssuesFromProject();
    
    if (this.config.multiRepo) {
      return issues.map(issue => {
        const repoLabel = issue.labels.find(l => l.startsWith('repo:'));
        const targetRepo = repoLabel?.replace('repo:', '');
        const repoConfig = this.config.repos?.find(r => r.repo === targetRepo);
        
        if (!repoConfig) {
          console.warn(`⚠️ Issue #${issue.number} has unknown repo label: ${repoLabel}`);
          return null;
        }
        
        return { ...issue, targetRepo, repoConfig };
      }).filter(Boolean);
    }
    
    return issues;
  }
}
```

### Git Operations Updates
```typescript
// src/git.ts
export async function createBranchAndPR(
  issue: Issue, 
  prDescription?: string,
  credits?: number,
  timeSeconds?: number
): Promise<string> {
  const repoPath = issue.repoConfig?.path || process.cwd();
  const owner = issue.repoConfig?.owner || config.owner;
  const repo = issue.repoConfig?.repo || config.repo;
  
  // Change to target repo directory
  const originalCwd = process.cwd();
  process.chdir(repoPath);
  
  try {
    // Existing git operations...
    const branchName = `agent/${issue.number}-${slugify(issue.title)}`;
    git('checkout', issue.repoConfig?.defaultBranch || 'main');
    git('pull', '--rebase', 'origin', issue.repoConfig?.defaultBranch || 'main');
    git('checkout', '-b', branchName);
    
    // ... commit, push, create PR
    
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: issue.title,
      body,
      head: branchName,
      base: issue.repoConfig?.defaultBranch || 'main',
    });
    
    return pr.html_url;
  } finally {
    // Always restore original directory
    process.chdir(originalCwd);
  }
}
```

### Executor Context
The executor needs to run in the correct repo directory:
```typescript
// src/executor.ts
export async function executeKiro(
  context: IssueContext, 
  model?: string, 
  verbose?: boolean,
  repoPath?: string
): Promise<ExecutionResult> {
  const cwd = repoPath || process.cwd();
  
  const child = spawn('kiro-cli', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd,  // Execute in target repo
  });
  
  // ...
}
```

### CLI Commands

#### `vibesprint config repos`
Manage repository list:
```bash
$ vibesprint config repos
Current repositories:
  1. frontend (~/projects/myapp-frontend)
  2. backend (~/projects/myapp-backend)

? Action:
  ❯ Add repository
    Remove repository
    Edit repository
    Done
```

#### `vibesprint config repos add`
```bash
$ vibesprint config repos add
? Repository owner: myorg
? Repository name: myapp-backend
? Local path: ~/projects/myapp-backend
? Default branch (main): main
✓ Added repository: myorg/myapp-backend
```

#### `vibesprint config repos remove`
```bash
$ vibesprint config repos remove backend
✓ Removed repository: backend
```

### Label Management
Auto-create `repo:*` labels for each configured repo:
```typescript
async ensureLabelsExist(): Promise<void> {
  // Existing labels...
  
  if (this.config.multiRepo && this.config.repos) {
    for (const repo of this.config.repos) {
      await this.createLabelIfMissing(`repo:${repo.repo}`, 'c5def5');
    }
  }
}
```

### Validation
```typescript
export function validateMultiRepoConfig(): { valid: boolean; errors: string[] } {
  const config = loadConfig();
  const errors: string[] = [];
  
  if (!config.multiRepo) return { valid: true, errors: [] };
  
  if (!config.repos || config.repos.length === 0) {
    errors.push('Multi-repo enabled but no repositories configured');
  }
  
  for (const repo of config.repos || []) {
    if (!existsSync(repo.path)) {
      errors.push(`Repository path not found: ${repo.path}`);
    }
    if (!existsSync(join(repo.path, '.git'))) {
      errors.push(`Not a git repository: ${repo.path}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Run Loop Updates
```typescript
// src/run.ts
async function processIssue(config: Config, issue: Issue, isRetry: boolean, verbose?: boolean): Promise<void> {
  const repoPath = issue.repoConfig?.path;
  
  if (config.multiRepo && !repoPath) {
    console.error(`❌ Issue #${issue.number} missing repo label`);
    await addLabel(config, issue, 'failed');
    await postErrorComment(config, issue, runId, 1, '', 'Missing repo:* label for multi-repo mode');
    return;
  }
  
  console.log(`\n🚀 Processing issue #${issue.number} in ${issue.targetRepo || 'default repo'}`);
  
  // Execute in target repo context
  const result = await executeKiro(context, issue.model, verbose, repoPath);
  
  // Create PR in target repo
  const prUrl = await createBranchAndPR(issue, prDescription, result.credits, result.timeSeconds);
  
  // ...
}
```

## Tasks

### Task 1: Config Schema Extension
- Add `multiRepo` boolean flag
- Add `repos` array with `RepoConfig` interface
- Add `sharedProjectId` for cross-repo project boards
- Maintain backward compatibility with single-repo config

### Task 2: Multi-Repo Config Commands
- Implement `vibesprint config repos` interactive menu
- Implement `vibesprint config repos add` with validation
- Implement `vibesprint config repos remove`
- Implement `vibesprint config repos list`

### Task 3: Issue Interface Extension
- Add `targetRepo` field to `Issue` interface
- Add `repoConfig` field for resolved configuration
- Update issue mapping in `GitHubProvider.getIssues()`

### Task 4: Repo Label Extraction
- Parse `repo:*` labels from issues
- Match to configured repositories
- Warn on unknown repo labels
- Filter out issues without valid repo labels in multi-repo mode

### Task 5: Git Operations - Context Switching
- Update `createBranchAndPR()` to accept repo path
- Implement directory switching with cleanup
- Handle default branch per repo
- Update PR creation with correct owner/repo

### Task 6: Executor - Repo Context
- Update `executeKiro()` to accept `cwd` parameter
- Pass repo path from run loop
- Ensure kiro-cli operates in correct directory

### Task 7: Label Management
- Auto-create `repo:*` labels for configured repos
- Use consistent color coding for repo labels
- Update `ensureLabelsExist()` for multi-repo

### Task 8: Validation
- Implement `validateMultiRepoConfig()`
- Check repo paths exist and are git repos
- Validate at startup before polling
- Clear error messages for misconfiguration

### Task 9: Run Loop Updates
- Check for repo label in multi-repo mode
- Pass repo context through processing pipeline
- Handle missing repo labels gracefully
- Log which repo each issue targets

### Task 10: Documentation
- Update README with multi-repo setup guide
- Document repo label convention
- Add examples for common multi-repo setups
- Troubleshooting for path/permission issues

## Acceptance Criteria
- [ ] `vibesprint config repos add` successfully adds a repository
- [ ] `vibesprint config repos list` shows all configured repos
- [ ] `vibesprint config repos remove` removes a repository
- [ ] Issues with `repo:backend` label processed in backend repo
- [ ] Issues with `repo:frontend` label processed in frontend repo
- [ ] PRs created in correct repository
- [ ] Validation fails if repo path doesn't exist
- [ ] Validation fails if repo path isn't a git repo
- [ ] Issues without repo label skipped with warning in multi-repo mode
- [ ] Single-repo mode continues to work unchanged

## Migration Path

### Enabling Multi-Repo
```bash
# Existing single-repo users
$ vibesprint config repos add
? Enable multi-repo mode? Yes
? Repository owner: myorg
? Repository name: myapp-backend
? Local path: /path/to/backend
✓ Multi-repo mode enabled
✓ Added repository: myorg/myapp-backend

# Add more repos
$ vibesprint config repos add
...
```

### Disabling Multi-Repo
```bash
$ vibesprint config repos disable
? Disable multi-repo mode and use current directory? Yes
✓ Multi-repo mode disabled
```

## Security Considerations
- Repo paths must be on local filesystem (no remote paths)
- Each repo uses same GitHub token (must have access to all repos)
- No cross-repo credential leakage
- Validate paths don't escape expected directories

## Limitations
- Sequential processing only (one issue at a time across all repos)
- Same GitHub token for all repos (must have permissions)
- No cross-repo changes (single PR per repo)
- Repo must be cloned locally before configuration

## Future Considerations
- **Parallel Processing**: Process issues from different repos simultaneously
- **Auto-Clone**: Clone repos automatically if not present locally
- **Org-Level Projects**: Support GitHub organization project boards
- **Repo Groups**: Group repos for batch operations
- **Per-Repo Executors**: Different AI backends per repository
