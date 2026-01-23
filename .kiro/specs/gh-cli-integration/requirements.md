---
inclusion: always
---

# GitHub CLI Integration

## Goal
Replace `@octokit/rest` and `@octokit/graphql` with `gh api` commands to simplify user setup - users already authenticated via `gh auth login` don't need a separate `GITHUB_TOKEN`.

## User Story
As a developer with GitHub CLI installed, I can run VibeSprint without configuring a separate token, using my existing `gh` authentication.

## Background

### Current Approach
- Uses `@octokit/rest` and `@octokit/graphql` npm packages
- Requires `GITHUB_TOKEN` environment variable
- User must create PAT with specific permissions

### Proposed Approach
- Shell out to `gh api` for REST calls
- Shell out to `gh api graphql` for GraphQL queries
- Falls back to token-based auth if `gh` not available

## Benefits
- Zero token setup if user has `gh auth login` done
- Simpler onboarding
- Leverages existing GitHub CLI authentication

## Scope

### In Scope
- Replace Octokit REST calls with `gh api`
- Replace Octokit GraphQL calls with `gh api graphql`
- Fallback to `GITHUB_TOKEN` if `gh` not installed
- Update README with simplified setup

### Out of Scope
- Removing Octokit entirely (keep as fallback)
- Changing any business logic

## Tasks

1. Create `GitHubCLIProvider` implementing `IssueProvider`
2. Detect if `gh` is installed and authenticated
3. Implement REST calls via `gh api`
4. Implement GraphQL calls via `gh api graphql`
5. Auto-select provider based on availability
6. Update README with `gh` setup option

## Acceptance Criteria
- [ ] VibeSprint works with just `gh auth login` (no GITHUB_TOKEN)
- [ ] Falls back to GITHUB_TOKEN if gh not available
- [ ] All existing functionality preserved
