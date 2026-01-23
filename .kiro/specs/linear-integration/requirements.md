# Linear Integration

## Goal
Enable VibeSprint to monitor Linear issues as an alternative to GitHub Projects, allowing teams using Linear for project management to automate issue-to-PR workflows.

## User Story
As a developer using Linear for project management, I can configure VibeSprint to monitor a Linear project/status and automatically convert issues into GitHub PRs when they reach a "Ready" state.

## Background

### Why Linear?
- Many teams prefer Linear's UX over GitHub Projects
- Linear has better sprint planning, cycles, and roadmap features
- Teams want to keep issue tracking in Linear but code in GitHub
- Linear's API is well-documented and GraphQL-based (similar to GitHub)

### Architecture Fit
The existing `IssueProvider` interface in `src/providers/types.ts` already abstracts issue sources:
```typescript
export interface IssueProvider {
  getIssues(): Promise<Issue[]>;
  addLabel(issue: Issue, label: string): Promise<void>;
  removeLabel(issue: Issue, label: string): Promise<void>;
  postComment(issue: Issue, body: string): Promise<void>;
  moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void>;
  createSubIssue(parentIssue: Issue, title: string, body: string): Promise<{ id: number; number: number }>;
  ensureLabelsExist(): Promise<void>;
}
```

A `LinearProvider` implementing this interface slots in cleanly.

## Scope

### In Scope
- New `LinearProvider` class implementing `IssueProvider`
- Linear API authentication via API key
- Config commands for Linear setup (`vibesprint config linear`)
- Mapping Linear workflow states to VibeSprint columns
- Bidirectional status sync (Linear state ↔ VibeSprint labels)
- PR linking back to Linear issues via comments

### Out of Scope
- Linear webhooks (polling only, consistent with GitHub approach)
- Linear-to-Linear sub-issue creation (sub-issues stay in Linear manually)
- Syncing GitHub PR status back to Linear automatically
- Multi-workspace Linear support (single workspace per config)

## Technical Design

### Config Schema Extension
```typescript
export interface Config {
  // Existing fields...
  provider?: 'github' | 'linear';
  
  // Linear-specific
  linearApiKey?: string;
  linearTeamId?: string;
  linearProjectId?: string;
  linearReadyStateId?: string;      // "Ready" workflow state
  linearInProgressStateId?: string;
  linearInReviewStateId?: string;
  linearBacklogStateId?: string;
  
  // GitHub repo for PRs (required even with Linear)
  githubOwner?: string;
  githubRepo?: string;
}
```

### Linear API Integration

#### Authentication
- Linear API key stored in `LINEAR_API_KEY` env var or config
- GraphQL endpoint: `https://api.linear.app/graphql`

#### Key Queries
```graphql
# Fetch issues in a workflow state
query IssuesInState($teamId: String!, $stateId: String!) {
  issues(filter: { 
    team: { id: { eq: $teamId } }
    state: { id: { eq: $stateId } }
  }) {
    nodes {
      id
      identifier  # e.g., "ENG-123"
      title
      description
      url
      labels { nodes { name } }
      comments { nodes { body user { name } } }
    }
  }
}

# Update issue state
mutation UpdateIssueState($issueId: String!, $stateId: String!) {
  issueUpdate(id: $issueId, input: { stateId: $stateId }) {
    issue { id state { name } }
  }
}

# Add comment to issue
mutation AddComment($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) {
    comment { id }
  }
}
```

### LinearProvider Implementation

```typescript
// src/providers/linear.ts
export class LinearProvider implements IssueProvider {
  private config: Config;
  private client: LinearClient;

  async getIssues(): Promise<Issue[]> {
    // Query issues in "Ready" state
    // Filter out issues with "running" label
    // Map to Issue interface
  }

  async addLabel(issue: Issue, label: string): Promise<void> {
    // Linear uses labels differently - create if not exists, then attach
  }

  async removeLabel(issue: Issue, label: string): Promise<void> {
    // Detach label from issue
  }

  async postComment(issue: Issue, body: string): Promise<void> {
    // Add comment via GraphQL mutation
  }

  async moveToColumn(issue: Issue, column: 'backlog' | 'inProgress' | 'inReview'): Promise<void> {
    // Update workflow state via mutation
  }

  async createSubIssue(parentIssue: Issue, title: string, body: string): Promise<{ id: number; number: number }> {
    // Create sub-issue in Linear, link to parent
    // Note: Linear has native sub-issue support
  }

  async ensureLabelsExist(): Promise<void> {
    // Create VibeSprint labels in Linear team if missing
  }
}
```

### Provider Factory
```typescript
// src/providers/index.ts
export function createProvider(): IssueProvider {
  const config = loadConfig();
  if (config.provider === 'linear') {
    return new LinearProvider();
  }
  return new GitHubProvider();
}
```

### CLI Commands

#### `vibesprint config linear`
Interactive setup:
1. Prompt for Linear API key (or read from `LINEAR_API_KEY`)
2. Fetch and list available teams
3. Fetch and list workflow states for selected team
4. Map states to VibeSprint columns (Ready, In Progress, In Review, Backlog)
5. Prompt for GitHub repo (for PR creation)
6. Save to `.vibesprint` config

#### `vibesprint config provider`
Switch between providers:
```bash
vibesprint config provider github
vibesprint config provider linear
```

### Issue ID Mapping
Linear issues have identifiers like `ENG-123`. For branch naming and PR references:
- Branch: `agent/ENG-123-add-user-auth`
- PR body: `Refs Linear: ENG-123` with link
- Comment on Linear issue with PR URL after creation

### Label Handling
Linear labels work differently than GitHub:
- Labels are team-scoped, not repo-scoped
- Must create labels via API if they don't exist
- Label IDs are UUIDs, not names

Required labels to create:
- `vibesprint:running`
- `vibesprint:retry`
- `vibesprint:failed`
- `vibesprint:pr-opened`
- `vibesprint:plan-posted`

Prefix with `vibesprint:` to avoid conflicts with existing team labels.

## Tasks

### Task 1: Linear API Client Setup
- Add `@linear/sdk` dependency
- Create `src/providers/linear.ts` skeleton
- Implement authentication with API key
- Add basic query for teams/projects

### Task 2: Config Schema Extension
- Extend `Config` interface with Linear fields
- Add `provider` field to switch between GitHub/Linear
- Update `loadConfig`/`saveConfig` for new fields

### Task 3: Linear Config Command
- Implement `vibesprint config linear` command
- Interactive team selection
- Workflow state mapping to columns
- GitHub repo configuration for PRs

### Task 4: LinearProvider - getIssues
- Query issues in "Ready" workflow state
- Filter by labels (exclude running/done)
- Map Linear issue format to `Issue` interface

### Task 5: LinearProvider - Label Operations
- Implement `addLabel` with label creation if needed
- Implement `removeLabel`
- Implement `ensureLabelsExist` for VibeSprint labels

### Task 6: LinearProvider - State Transitions
- Implement `moveToColumn` via state mutation
- Map column names to configured state IDs

### Task 7: LinearProvider - Comments
- Implement `postComment` for error/success messages
- Include PR links in completion comments

### Task 8: LinearProvider - Sub-Issues
- Implement `createSubIssue` for plan workflow
- Use Linear's native parent-child relationship

### Task 9: Provider Factory
- Create `createProvider()` factory function
- Update `intake.ts` to use factory
- Update `run.ts` to use factory for status operations

### Task 10: Git Operations Update
- Update branch naming for Linear identifiers (ENG-123)
- Update PR body template for Linear references
- Add Linear issue link to PR description

### Task 11: Documentation
- Update README with Linear setup instructions
- Add Linear-specific troubleshooting section
- Document required Linear permissions

## Acceptance Criteria
- [ ] `vibesprint config linear` successfully configures Linear integration
- [ ] `vibesprint config provider linear` switches to Linear mode
- [ ] `vibesprint run --dry-run` lists issues from Linear "Ready" state
- [ ] `vibesprint run` processes Linear issue and creates GitHub PR
- [ ] Linear issue moves to "In Review" state after PR creation
- [ ] PR body contains link to Linear issue
- [ ] Comment posted on Linear issue with PR URL
- [ ] Labels correctly applied/removed on Linear issues
- [ ] Plan workflow creates sub-issues in Linear

## Dependencies
- `@linear/sdk` - Official Linear SDK
- Existing: `@octokit/rest`, `@octokit/graphql` (still needed for GitHub PRs)

## Security Considerations
- Linear API key stored in env var, not committed
- API key requires only necessary scopes (issues:read, issues:write, comments:write)
- No cross-workspace data access

## Migration Path
Existing GitHub-only users are unaffected:
- Default `provider` is `github` if not specified
- All existing config fields remain valid
- No breaking changes to current workflows
