# Phase 3: Plan Workflow

## Goal
Support plan-first workflow where complex issues get a plan posted for approval before implementation.

## User Story
As a developer, I can label an issue `type:plan` and VibeSprint will post a plan for my review before generating code.

## Scope
- `type:plan` label detection
- Plan mode execution
- Plan comment posting
- `/approve` command support
- Transition from plan to implementation

## Out of Scope
- Event-driven mode
- Linear integration

## Dependencies
- Phase 1 complete
- Phase 2 recommended

## Tasks

### Task 3.1: Plan label detection
- Check for `type:plan` label on issue
- Default to `type:implement` if no type label

### Task 3.2: Plan mode execution
- Run kiro-cli in plan-only mode
- Capture plan output

### Task 3.3: Plan comment posting
- Post plan as formatted comment on issue
- Add `plan-posted` label
- Add `needs-approval` label

### Task 3.4: Approval detection
- Poll for `/approve` comment
- Require commenter has write access (configurable)
- Add `approved` label when detected

### Task 3.5: Implementation after approval
- On approval, run kiro-cli in implement mode
- Follow normal PR flow from Phase 1
- Remove `needs-approval`, add `running`

## Acceptance Criteria
- [ ] `type:plan` issue gets plan posted as comment
- [ ] Issue shows `needs-approval` label after plan
- [ ] `/approve` comment triggers implementation
- [ ] PR opened after approval, issue moves to In Progress
