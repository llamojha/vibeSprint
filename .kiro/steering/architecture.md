---
inclusion: always
---

# Architecture: VibeSprint

## Trigger Model: GitHub Project Board

VibeSprint monitors a GitHub Project board column (e.g., "Ready"). When an issue appears in the monitored column, it gets processed.

### Primary Trigger: Project Board Column
- Issues in target column (Status field value) are picked up for processing
- After PR opens, issue moves to "In Review" column
- Column/field selection configured via CLI

## Technical Approach: Polling

Local CLI polls GitHub Projects API on interval.
- Pros: Simple, no server needed, works immediately
- Cons: Slight delay (polling interval), API rate limits

This fits the "self-hosted local CLI" goal — just `npx` or `npm link` and run.

## Why Polling Over Webhooks

- Webhooks require public endpoint or tunnel (ngrok, cloudflare)
- Conflicts with "just npx and run" local CLI goal
- Polling is simpler: no infrastructure, works immediately
- No server setup, port forwarding, or tunnel management
- Trade-off: slight delay (polling interval) acceptable for this use case
- Decision: removed webhook support entirely to keep scope focused

## Core Components

### 1. Issue Intake
- Monitor GitHub Project board column via GraphQL API
- Filter: open issues, not already `running`/`done`
- Order: FIFO by issue number
- CLI config: link project, select column to monitor

### 2. Context Builder
- Gather: issue title/body, comments (latest N), relevant repo files
- Produce task context bundle for `kiro-cli`

### 3. Kiro Executor
- Headless invocation: `kiro-cli chat --no-interactive --trust-all-tools`
- Run in plan mode or implement mode based on issue type

### 4. Git Operations
- Branch naming: `agent/<issue-number>-<slug>`
- Commit with issue reference
- Create PR with "Fixes #N" or "Refs #N"

### 5. Status Manager
- Move issue to "In Review" column after PR opens
- Update labels on state transitions

## Idempotency & Locking
- Add unique run marker (`run-id:<uuid>` label or comment)
- If branch exists, update PR instead of creating new one
- Prevent duplicate runs via state checks

## Security Constraints
- Credentials via environment variable (GITHUB_TOKEN)
- Least privilege tokens
- Secrets never posted to issues/PRs

## Authentication
- GitHub Fine-grained Personal Access Token (PAT)
- Required permissions:
  - `Issues: Read/Write`
  - `Pull requests: Read/Write`
  - `Contents: Read/Write`
  - `Projects: Read/Write`
- Scope to single target repository

## Design Constraints
- One issue → one PR (always)
- Single repo per instance
- Users can run multiple instances for multiple repos
