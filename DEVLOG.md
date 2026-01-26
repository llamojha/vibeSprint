# VibeSprint Development Log

## Session Timeline

| Session | Date | Duration | Credits | Summary |
|---------|------|----------|---------|---------|
| phase-1-foundation | 2026/1/11 | 180 min | 100 | Project scaffolding, CLI, core components |
| phase-2-robustness | 2026/1/12-13 | 787 min | 68.55 | Retry logic, first-run UX, model selection |
| phase-3-plan-workflow | 2026/1/13 | 108 min | 61.84 | Plan workflow, sub-issue creation |
| code-review-hackathon | 2026/1/13 | 9 min | 61.19 | Hackathon criteria review |
| ticket-curation | 2026/1/22 | 150 min | 50 | Curated prompts for issue processing |
| codex-cli-integration | 2026/1/22 | 300 min | 100 | Executor abstraction, Codex support |
| gh-migration | 2026/1/23 | 67 min | 65.69 | Migrate from Octokit to gh CLI |
| multi-repo-support | 2026/1/24 | 233 min | 169.83 | TUI dashboard, daemon mode, log capture |
| linear-integration | 2026/1/24 | 265 min | 119.36 | LinearProvider, provider factory |

**Total**: ~2100 minutes (~35 hours), 796 credits

---

## Key Decisions & Rationale

### Why Polling Over Webhooks?
**Decision**: Use polling instead of webhooks for issue monitoring.

**Why**: Webhooks require a public endpoint (ngrok, cloudflare tunnel) which conflicts with the "just npm install and run" philosophy. Polling is simpler—no infrastructure, no port forwarding, works immediately. The trade-off (slight delay) is acceptable for this use case.

### Why gh CLI Over Octokit?
**Decision**: Migrate from Octokit SDK to GitHub CLI (`gh`).

**Why**: Users already have `gh` installed and authenticated. No need to manage tokens separately. Simpler auth flow (`gh auth login`), and the CLI handles token refresh automatically. Reduced dependency footprint.

### Why Provider Abstraction?
**Decision**: Create `IssueProvider` interface with GitHubProvider and LinearProvider implementations.

**Why**: Teams use different issue trackers. Rather than forcing GitHub Projects, the provider pattern lets users choose. Same VibeSprint workflow works regardless of where issues live. Adding new providers (Jira, Asana) becomes straightforward.

### Why Curated vs Simple Prompts?
**Decision**: Two prompt modes—curated (default) and simple (`no-curate` label).

**Why**: Complex issues benefit from structured analysis (search codebase, create plan, implement, verify). Simple bug fixes don't need that overhead. The `no-curate` label lets users skip curation for straightforward tasks.

### Why Plan Workflow?
**Decision**: Add `plan` label to trigger task decomposition instead of direct implementation.

**Why**: Large features shouldn't be one giant PR. The plan workflow breaks them into PR-sized chunks, creates sub-issues in Backlog, and lets you implement incrementally. Better code review, easier rollback, clearer progress tracking.

### Why TUI Over Pure CLI?
**Decision**: Add interactive TUI menu as the default entry point.

**Why**: First-run setup has many steps (repo, project, columns). A TUI guides users through configuration without memorizing commands. The dashboard shows real-time status across multiple repos. Power users can still use `vibesprint run` directly.

### Why Daemon Mode?
**Decision**: Allow detaching the dashboard to run as a background daemon.

**Why**: Users don't want a terminal window open forever. Press `d` to detach—VibeSprint continues polling in the background. Logs go to `~/.vibesprint/daemon.log`. Re-run `vibesprint` to view status or stop the daemon.

### Why Label-Based State Machine?
**Decision**: Use GitHub/Linear labels to track issue state (`running`, `retry`, `failed`, `pr-opened`).

**Why**: Labels are visible in the UI, queryable via API, and don't require a separate database. Anyone looking at the issue knows its status. The state machine prevents duplicate processing and enables retry logic.

---

## Challenges & Solutions

### GitHub Projects GraphQL Complexity
**Problem**: Field names and schema poorly documented. Trial and error to find correct queries.

**Solution**: Used `gh api graphql` to explore schema interactively. Documented working queries in code comments.

### ANSI Escape Codes in PR Descriptions
**Problem**: kiro-cli output included terminal colors that corrupted GitHub PR bodies.

**Solution**: Added `stripAnsi()` utility to clean output before posting.

### Branch Conflicts on Re-runs
**Problem**: Same issue processed twice created git conflicts.

**Solution**: Force-delete existing branch before creating new one. Use `--force-with-lease` for push.

### Flexible Output Parsing
**Problem**: Strict markers (`---PR_DESCRIPTION_START---`) failed with varying kiro-cli output.

**Solution**: Switched to flexible regex (`-*PR_DESCRIPTION_START-*`) to handle variations.
