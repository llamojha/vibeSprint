---
inclusion: always
---

# Project Overview: VibeSprint

## Purpose
A self-hosted tool that runs on a local machine and automatically converts GitHub issues into pull requests using `kiro-cli`.

## Core Value Proposition
- **Issue → PR automation**: Label an issue `ready-for-agent` → get a PR
- **Plan-first workflow**: Optional approval gate for complex changes
- **Full local control**: No dependency on cloud autonomous agents

## Key Workflows

### Implement Flow
`ready-for-agent` → `running` → PR opened → `in-review`

### Plan Flow
`ready-for-agent` + `type:plan` → plan posted → `needs-approval` → `approved` → `running` → PR opened → `in-review`

## Target Users
- Solo builders wanting automated issue-to-PR pipelines
- Small teams needing plan gating and audit trails
- Security-conscious devs requiring local execution

## MVP Scope
1. Issue intake and filtering (polling mode)
2. Context building from issue + repo
3. Code generation via `kiro-cli`
4. Git operations (branch, commit, push, PR)
5. Status updates via labels

## Out of Scope (MVP)
- Auto-merge
- AI code review
- Multi-org fleet management
- Linear integration (Phase 3)
