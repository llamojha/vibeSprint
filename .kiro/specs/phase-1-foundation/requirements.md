# Phase 1: Foundation + Polling MVP

## Goal
Ship a working tool that polls a GitHub Project board column, processes issues via kiro-cli, and opens PRs.

## User Story
As a developer, I can run `vibesprint run` and have issues in my Backlog column automatically converted to PRs.

## Scope
- CLI skeleton with `config` and `run` commands
- GitHub PAT authentication
- Project linking and column selection
- Polling mode issue intake
- Context builder (issue title/body/comments)
- Git operations (branch, commit, push, PR)
- Status updates (move issue to In Progress)

## Out of Scope
- Failure handling / retry
- Plan workflow
- Event-driven mode
- Linear integration

## Tasks

### Task 1.1: Project scaffolding
- Initialize TypeScript project
- Add dependencies: commander, @octokit/graphql, @octokit/rest
- Create CLI entry point with help output

### Task 1.2: GitHub authentication
- Read PAT from env var `GITHUB_TOKEN` or config file
- Validate token on startup
- Store in `~/.config/vibesprint/config.json`

### Task 1.3: Project linking (`config link`)
- Fetch available GitHub Projects for repo
- Interactive selection or `--project` flag
- Store project ID in config

### Task 1.4: Column selection (`config column`)
- Fetch Status field options from linked project
- Interactive selection or `--column` flag
- Store column/field ID in config

### Task 1.5: Issue intake - polling
- Query issues in target column via GraphQL
- Filter: open, no `running` label
- Order: FIFO by creation date
- `run --dry-run` lists issues without processing

### Task 1.6: Context builder
- Gather issue title, body, comments (last 10)
- Format as prompt for kiro-cli
- Log context bundle for debugging

### Task 1.7: Kiro executor (basic)
- Invoke `kiro-cli chat --no-interactive --trust-all-tools "CONTEXT"`
- Add `running` label before execution
- Capture exit code

### Task 1.8: Git operations
- Create branch `agent/<issue>-<slug>`
- Commit changes with `Refs #<issue>`
- Push to origin
- Open PR with `Fixes #<issue>` in body

### Task 1.9: Status updates
- Move issue to "In Progress" column via GraphQL
- Add `pr-opened` label
- Remove `running` label

## Acceptance Criteria
- [ ] `vibesprint --help` shows available commands
- [ ] `vibesprint config link` lists and saves project
- [ ] `vibesprint config column` lists and saves column
- [ ] `vibesprint run --dry-run` shows issues in target column
- [ ] `vibesprint run` processes first issue, opens PR, moves to In Progress
