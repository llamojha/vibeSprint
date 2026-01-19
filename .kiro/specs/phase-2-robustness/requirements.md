# Phase 2: Robustness

## Goal
Add failure handling and retry capabilities for reliable operation.

## User Story
As a developer, when kiro-cli fails, I see a clear error on the issue and can retry with `/retry`.

## Scope
- Proper kiro executor with output capture
- Failure detection and labeling
- Error summary comments on issues
- `/retry` command support
- Idempotency markers

## Out of Scope
- Plan workflow
- Event-driven mode
- Linear integration

## Dependencies
- Phase 1 complete

## Tasks

### Task 2.1: Enhanced kiro executor
- Capture stdout/stderr from kiro-cli
- Detect success/failure from exit code
- Timeout handling (configurable)

### Task 2.2: Failure labeling
- On failure: add `failed` label
- Remove `running` label
- Do not move to In Progress

### Task 2.3: Error comments
- Post error summary to issue
- Include run ID for debugging
- Truncate long errors (max 1000 chars)

### Task 2.4: Retry support
- Detect `/retry` comment on failed issues
- Clear `failed` label
- Re-queue issue for processing

### Task 2.5: Idempotency
- Add `run-id:<uuid>` label on start
- Check for existing branch before creating
- Update existing PR instead of creating duplicate

## Acceptance Criteria
- [ ] Failed run adds `failed` label and error comment
- [ ] `/retry` comment clears failure and reprocesses
- [ ] Duplicate runs don't create duplicate PRs
- [ ] Run ID visible in issue labels
