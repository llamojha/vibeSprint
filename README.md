hello

# VibeSprint

> **Turn GitHub issues into pull requests automatically** — Just add an issue to your "Ready" column and watch VibeSprint generate, commit, and open a PR for you.

A self-hosted CLI that monitors your GitHub Project board or Linear workspace and automatically converts issues into production-ready pull requests using `kiro-cli` or OpenAI's `codex` CLI. No servers, no webhooks, no complexity — just `npm install` and run.

📋 **Live Project Board**: [See it in action](https://github.com/users/llamojha/projects/7) • 🎥 **Demo Video**: [Watch the workflow](https://youtu.be/K3-sSUJcGT8)

![VibeSprint Dashboard](docs/assets/dashboard.gif)
<!-- To add: Record a GIF showing the TUI dashboard with repos polling and processing an issue -->

## Quick Start

```bash
# 1. Install VibeSprint
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint && npm install && npm run build && npm link

# 2. Launch the TUI
vibesprint
```

The interactive menu guides you through setup. Select **Repos → Add new repo** to configure your first repository.

## Setup

### 1. Prerequisites

**Required:**
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- GitHub CLI ([cli.github.com](https://cli.github.com))
- Kiro CLI ([kiro.dev](https://kiro.dev/docs/cli/installation))

**Optional:**
- OpenAI Codex CLI: `npm install -g @openai/codex`

### 2. Provider Authentication

VibeSprint supports two issue tracking providers: **GitHub Projects** and **Linear**.

#### GitHub Projects

```bash
gh auth login
gh auth refresh -s project  # Required for project board access
```

#### Linear

1. **Enable Linear GitHub Integration** (required for PR linking)
   - Linear Settings → Integrations → GitHub → Connect your repos

2. **Create a Linear API Key**
   - Linear Settings → Account → Security → API
   - Or visit: `https://linear.app/<your-workspace>/settings/account/security`
   - Set: `export LINEAR_API_KEY=lin_api_...`

### 3. Configure via TUI

Launch VibeSprint and follow the interactive setup:

```bash
vibesprint
```

```
VibeSprint v0.5.0
────────────────────

? What would you like to do?
❯ Start
  Repos (0 configured)
  Executor: kiro
  Model: auto
  Quit
```

#### Adding a Repository

1. Select **Repos** → **+ Add new repo**
2. Choose your issue source:
   ```
   ? Issue source:
   ❯ GitHub Projects
     Linear
   ```

**For GitHub Projects:**
- Enter repo owner and name
- Select local path to repo clone
- Choose GitHub Project board
- Map columns (Backlog, Ready, In Progress, In Review)

**For Linear:**
- Enter/confirm Linear API key
- Select Linear team
- Map workflow states to columns
- Choose if team is shared across repos (enables label filtering)
- Enter GitHub repo info (where PRs will be created)
- Select local path

#### Multi-Repo Support

Add multiple repositories with different providers:

```
? Manage repositories:
  + Add new repo
  vibesprint [GitHub] (llamojha/vibesprint)
  backend-api [Linear] (llamojha/backend-api)
  ← Back
```

Each repo can use either GitHub Projects or Linear independently.

#### Shared Linear Teams

If your Linear team manages multiple GitHub repos, use label-based filtering:

1. When adding a Linear repo, answer "Yes" to "Is this team shared across multiple GitHub repos?"
2. Enter a label (default: `repo:<reponame>`)
3. VibeSprint creates this label in Linear automatically
4. Only issues with this label are processed for this repo

### 4. Run

From the main menu, select **Start** to launch the dashboard:

```
VibeSprint v0.5.0 • Monitoring 2 repo(s)
────────────────────────────────────────

vibesprint [GitHub]     ● Ready    0 issues
backend-api [Linear]    ● Ready    2 issues

Press q to quit, r to refresh
```

Or use CLI flags:

```bash
vibesprint run              # Start polling
vibesprint run --dry-run    # Preview without processing
vibesprint run --interval 30 # Custom poll interval
vibesprint run --verbose    # Show executor commands
```

## ✨ Key Features

- **🎯 Issue → PR in minutes**: Drop an issue in your "Ready" column, get a complete PR with code, tests, and documentation
- **🧠 Smart planning**: Add a `plan` label to break complex features into manageable sub-issues automatically  
- **⚡ Parallel execution**: Uses Kiro's subagent system to handle multiple tasks simultaneously
- **🔒 Fully local**: Runs on your machine with your credentials — no cloud dependencies
- **🎨 Workflow innovation**: 30+ custom Kiro prompts for debugging, planning, and code review

## Why VibeSprint?

| Feature | VibeSprint | GitHub Copilot Workspace | Devin | Cursor |
|---------|------------|-------------------------|-------|--------|
| Self-hosted | ✅ Local CLI | ❌ Cloud | ❌ Cloud | ❌ Cloud |
| Issue-driven | ✅ GitHub/Linear | ✅ GitHub only | ❌ Chat-based | ❌ Editor-based |
| Plan workflow | ✅ Auto sub-issues | ❌ | ✅ | ❌ |
| No subscription | ✅ BYO API keys | ❌ $19/mo | ❌ $500/mo | ❌ $20/mo |
| Multi-repo | ✅ | ❌ | ✅ | ❌ |
| Custom prompts | ✅ 30+ prompts | ❌ | ❌ | Limited |

**VibeSprint is for developers who want:**
- Full control over their automation (no cloud lock-in)
- Issue-driven workflow (not chat-based)
- Transparent AI operations (see exactly what's happening)
- Flexibility to use any AI backend (Kiro, Codex, or add your own)

## How It Works

### Implement Flow (default)
1. Add an issue to your "Ready" column
2. VibeSprint picks it up, invokes `kiro-cli` to generate code
3. Creates a branch, commits changes, opens a PR
4. Moves issue to "In Review" column

### Plan Flow (for feature requests)
1. Add an issue with `plan` label to "Ready" column
2. VibeSprint generates a task breakdown and posts as comment
3. Creates sub-issues in "Backlog" column (linked to parent)
4. Moves parent to "In Progress" column
5. You move sub-issues to "Ready" one at a time to implement

## Usage

```bash
# Preview what would be processed
vibesprint run --dry-run

# Run with default 60s polling interval
vibesprint run

# Custom polling interval
vibesprint run --interval 30

# Verbose mode (show kiro-cli commands)
vibesprint run --verbose

# Use Codex CLI instead of Kiro
vibesprint run --executor codex
```

Press `Ctrl+C` to stop.

## Commands

| Command | Description |
|---------|-------------|
| `vibesprint config link` | Link to a GitHub Project |
| `vibesprint config column` | Select columns to use |
| `vibesprint config executor` | Select code generation backend (kiro or codex) |
| `vibesprint config show` | Show current configuration |
| `vibesprint config reset` | Reset configuration |
| `vibesprint run` | Start polling and processing |
| `vibesprint run --dry-run` | Show issues without processing |
| `vibesprint run --interval <s>` | Set polling interval (default: 60s) |
| `vibesprint run --verbose` | Show detailed output |
| `vibesprint run --executor <type>` | Override executor (kiro or codex) |

## Workflows

### Implement Workflow
```
Issue in Ready → [running] label → kiro-cli executes → 
PR created → [pr-opened] label → Issue moved to In Review
```

### Plan Workflow
```
Issue with [plan] label in Ready → [running] label → 
kiro-cli generates plan → Plan posted as comment → 
Sub-issues created in Backlog → [plan-posted] label → 
Parent moved to In Progress
```

## Example Workflow

```bash
# 1. Set up in your project
cd my-project
gh auth login  # If not already authenticated
echo ".vibesprint" >> .gitignore

# 2. Configure (first time only)
vibesprint config link    # Select your GitHub Project
vibesprint config column  # Select columns

# 3. Test with dry-run
vibesprint run --dry-run
# Output: 📬 Found 2 issue(s) to process [2 implement]
#   - #42: Add user authentication
#   - #43: Fix login bug

# 4. Run continuously
vibesprint run --interval 30
```

## Labels

| Label | Meaning |
|-------|---------|
| `plan` | Trigger plan workflow instead of implement |
| `running` | Currently being processed |
| `pr-opened` | PR was created successfully |
| `plan-posted` | Plan generated, sub-issues created |
| `retry` | Failed once, will retry |
| `failed` | Failed twice, needs manual intervention |

## Configuration

Configuration is stored in `.vibesprint` in your project root.

```bash
# Reconfigure project link
vibesprint config link

# Reconfigure columns
vibesprint config column
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `gh: command not found` | Install GitHub CLI: https://cli.github.com |
| `gh: not logged in` | Run: `gh auth login` |
| `Project not configured` | Run `vibesprint config link` |
| `Config file lost` | Add `.vibesprint` to `.gitignore` |
| `kiro-cli not found` | Install kiro-cli: https://kiro.dev/docs/cli/installation |
| `codex not found` | Install: `npm install -g @openai/codex` |

## Project Structure

```
src/
├── cli.ts              # CLI entry point and command routing
├── config.ts           # Configuration management (multi-repo, providers)
├── context.ts          # Build prompts for kiro-cli/codex
├── git.ts              # Git operations (branch, commit, PR)
├── intake.ts           # Issue fetching orchestration
├── run.ts              # Main polling loop
├── status.ts           # Labels, comments, column updates
├── daemon.ts           # Background daemon management
├── issue-logs.ts       # Per-issue log file management
├── commands/
│   ├── menu.ts         # TUI main menu
│   ├── add-repo.ts     # Interactive repo setup (GitHub/Linear)
│   ├── list-repos.ts   # List and remove repos
│   └── executor.ts     # Executor selection
├── providers/
│   ├── types.ts        # IssueProvider interface
│   ├── github.ts       # GitHub Projects provider
│   ├── linear.ts       # Linear provider
│   └── index.ts        # Provider factory
├── executors/
│   ├── types.ts        # Executor interface
│   ├── kiro.ts         # Kiro CLI executor
│   ├── codex.ts        # OpenAI Codex executor
│   └── index.ts        # Executor factory
├── ui/
│   └── dashboard.tsx   # Ink/React real-time dashboard
└── utils/
    └── gh.ts           # GitHub CLI wrapper
```

## License

MIT
