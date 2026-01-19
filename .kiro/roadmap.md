# Roadmap: VibeSprint

## Overview
Self-hosted tool that monitors GitHub Project boards and converts issues to PRs using kiro-cli.

## Phases

### Phase 1: Foundation + Polling MVP ✅
**Goal:** Working end-to-end flow with polling
**Deliverable:** `vibesprint run` polls Ready column, runs kiro-cli, opens PR, moves issue
**Spec:** `.kiro/specs/phase-1-foundation/requirements.md`

Key features:
- CLI with `config` and `run` commands
- GitHub PAT authentication
- Project linking and column selection (4 columns)
- Polling mode issue intake
- Context builder
- Git operations (branch, commit, PR)
- Status updates (labels, column moves)

### Phase 2: Robustness ✅
**Goal:** Reliable operation with failure recovery
**Deliverable:** Failed runs labeled, error comments posted, retry works
**Spec:** `.kiro/specs/phase-2-robustness/requirements.md`
**Depends on:** Phase 1

Key features:
- Enhanced kiro executor with output capture
- Failure labeling (retry → failed escalation)
- Error comments posted to issues
- Idempotency markers (run-id)
- Model selection
- Verbose mode
- ANSI stripping from output

### Phase 3: Plan Workflow ✅
**Goal:** Plan-first workflow for complex issues
**Deliverable:** `plan` labeled issues get broken down into sub-issues
**Spec:** `.kiro/specs/phase-3-plan-workflow/requirements.md`
**Depends on:** Phase 1

Key features:
- `plan` label detection (case-insensitive)
- Plan generation via kiro-cli
- Plan posted as comment on parent issue
- Sub-issues created via GitHub sub-issues API
- Sub-issues placed in Backlog column
- Parent moved to In Progress

### Phase 4: Event-Driven Mode - REMOVED
**Goal:** Real-time triggering via webhooks
**Status:** Removed - polling-only approach fits self-hosted CLI goal
**Spec:** `.kiro/specs/phase-4-event-driven/requirements.md`
**Depends on:** Phase 1

Key features:
- Webhook receiver HTTP server
- `projects_v2_item` event handling
- Hybrid mode (webhook + polling)

## Dependency Graph

```
Phase 1 (Foundation)
    ├── Phase 2 (Robustness)
    └── Phase 3 (Plan Workflow)
```

Phases 2 and 3 can be developed in parallel after Phase 1 is complete.

## Current Status
- [x] PRD complete
- [x] Architecture defined
- [x] Steering docs created
- [x] Phase specs created
- [x] Phase 1 implementation
- [x] Phase 2 implementation
- [x] Phase 3 implementation
- [ ] Phase 4 implementation (REMOVED)
