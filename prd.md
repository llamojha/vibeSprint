# PRD: VibeSprint (Self-Hosted "Issue → PR" Agent)

## 1) Summary
Build a self-hosted tool that runs on a user's home PC (or any private machine) and continuously turns work items into code changes:
- Watches GitHub issues for a trigger state
- Supports a plan-first path for "plan" issues, requiring explicit approval
- Runs `kiro-cli` headless (or semi-headless with a controlled approval gate)
- Pushes a branch, opens a PR referencing the issue, and updates issue/project status to **In review**

This explicitly avoids relying on Kiro's cloud "autonomous agent" availability and provides full local control.

## 2) Problem
Even with codegen agents, the operational loop is the bottleneck:
- Consistent triggering (without manually running commands)
- Capturing context safely (repo state + issue discussion)
- Enforcing guardrails (approval gates, command allowlists, secrets hygiene)
- Avoiding duplicate runs / race conditions
- Converting agent output into a clean PR + workflow state changes

## 3) Goals and Non-goals

### Goals
- **G1:** From a GitHub issue, automatically produce a PR within a target SLA (e.g., <10 minutes for small tasks; configurable).
- **G2:** Support two workflows:
  - **Implement issues:** go straight to code generation
  - **Plan issues:** generate plan → wait for approval → then code generation
- **G3:** Update workflow state automatically:
  - Add labels like `in-review` (and/or move GitHub Project item field) when PR opens
- **G4:** Be safe-by-default:
  - No arbitrary command execution without explicit allowlist / policy
  - Secrets never posted to issues/PRs

### Non-goals (MVP)
- Auto-merge
- Full AI code review
- Multi-org / large-scale fleet management
- Perfect handling of ambiguous issues

## 4) Users / Personas
- **Solo builder / indie dev:** wants "open an issue → get a PR" with minimal ops.
- **Small team lead:** wants plan gating + an audit trail in GitHub.
- **Security-conscious dev:** wants local execution + tight permissions and guardrails.

## 5) Key User Stories
1. As a dev, when I label an issue `ready-for-agent`, a PR is created that references the issue.
2. As a dev, when I label an issue `type:plan`, the system posts a plan to the issue, then waits.
3. As a dev, when I comment `/approve` (or label `approved`), the system generates code and opens a PR.
4. As a dev, when a PR is opened, the issue is labeled `in-review` (and optionally moved in a GitHub Project).
5. As a dev, if the run fails, I see a failure status + a pointer to logs, and can retry safely.

## 6) Workflow Design (State Machine)

### Labels (example)
- Intake: `ready-for-agent` OR comment command `/run`
- Type: `type:plan` OR `type:implement`
- Plan: `plan-posted`, `needs-approval`, `approved`
- Execution: `running`, `failed`, `pr-opened`, `in-review`, `done`

### Transitions
#### Implement
- `ready-for-agent` + not `type:plan` → `running` → PR opened → `in-review`

#### Plan
- `ready-for-agent` + `type:plan` → run plan → comment plan → `needs-approval`
- `approved` (label or `/approve`) → `running` → PR opened → `in-review`

### Idempotency / Locking (critical)
- Add a unique run marker (e.g., `run-id:<uuid>` label or an issue comment) so reruns don't create duplicate PRs.
- Use a branch naming convention: `agent/<issue-number>-<slug>`; if branch exists, update the PR instead of creating a new one.

## 7) Functional Requirements

### FR1: Issue intake + filtering
- Support:
  - Polling mode (chosen for simplicity and local-first approach)
- Filter by:
  - repo allowlist
  - issue is open
  - trigger label/comment present
  - not already `running`/`done` unless retry requested

### FR2: Context builder
- Gather:
  - issue title/body
  - issue comments (latest N)
  - relevant repo files (optional; config/heuristics)
- Produce a "task context bundle" stored locally and referenced in logs.

### FR3: Plan generation (`type:plan`)
- Run `kiro-cli` in plan mode
- Post plan summary back to the issue as a comment
- Apply `needs-approval`

### FR4: Approval gate
- Accept approval via:
  - label `approved` OR comment command `/approve`
- Optional: require approval only from users with write access

### FR5: Code generation + implementation
- Run `kiro-cli` to implement
- Enforce a tool/command allowlist policy (configurable)

### FR6: Git operations
- Create branch, commit with a message referencing issue
- Push to origin
- Create PR with body including:
  - "Fixes #123" or "Refs #123" (configurable)
  - Link to plan if applicable

### FR7: Status updates
- On PR created:
  - add `pr-opened`, remove `running`, add `in-review`
  - optionally update GitHub Project field (Status = "In review")

### FR8: Retry / failure handling
- On failure:
  - label `failed`
  - comment a short failure summary + run id
- Retry via label `retry` or command `/retry`:
  - clears `failed`, re-enters queue

## 8) Non-functional Requirements
- **NFR1 Security:** credentials stored locally (OS keychain or encrypted file); least privilege tokens.
- **NFR2 Observability:** structured logs per run; include run id; redact secrets.
- **NFR3 Reliability:** safe restarts; durable queue; no duplicate PRs.
- **NFR4 Rate limits:** configurable polling interval + backoff for GitHub API compliance.
- **NFR5 Performance:** handle at least 1–3 concurrent issues (configurable worker pool).

## 9) Technical Approach (MVP)

### Option A (recommended): GitHub self-hosted runner
- GitHub Actions triggers on:
  - issue labeled `ready-for-agent`
  - issue comment contains `/run` or `/approve`
- Jobs execute on a home PC runner.
- Pros: no polling, clean eventing, fewer API calls
- Cons: runner setup + permissions

### Option B: Always-on local daemon (polling)
- Local service polls GitHub Issues API on interval.
- Pros: simple, GitHub-agnostic, no infrastructure setup
- Cons: slight delay (polling interval), API rate limits

**Chosen approach:** Polling-based local daemon for simplicity and zero-config user experience.

## 10) Metrics / Success Criteria (KPIs)
- Time-to-PR (median / p95) from trigger to PR opened
- Completion rate: % runs producing a PR without manual intervention
- Retry rate: % issues requiring retry
- Duplicate PR rate: target ~0
- Plan approval conversion: % plan issues that reach approval and generate PR

## 11) Risks and Mitigations
- **R1: `kiro-cli` not truly headless (approval prompts, permissions).**
  - Mitigation: default to "plan → approve → execute"; add explicit allowlist config; fail fast with clear messaging.
- **R2: Prompt injection / malicious issue instructions.**
  - Mitigation: strict tool/command allowlist; restrict triggers to trusted users; sanitize context; never execute arbitrary shell.
- **R3: Low quality output / flaky PRs.**
  - Mitigation: narrow initial scope; require tests; require human review; no auto-merge.
- **R4: Home PC offline → missed triggers.**
  - Mitigation: clear offline status; rerunnable triggers; optional VPS runner.

## 12) Rollout Plan
- **Phase 0:** Dry-run mode (context + plan only, no git push)
- **Phase 1 (MVP):** Implement issues → PR creation + `in-review` labeling
- **Phase 2:** Plan issues

## 13) Open Questions
- What exact headless/CI-friendly interface is available for your current `kiro-cli` (auto-approve? config file? env flags)?
- One issue → one PR always, or allow batching?
- Multiple repos or single repo first?
- Preferred approval signal: label, `/approve`, or reviewer approval?
