hello

# VibeSprint

> **Turn GitHub issues into pull requests automatically** — Just add an issue to your "Ready" column and watch VibeSprint generate, commit, and open a PR for you.

A self-hosted CLI that monitors your GitHub Project board and automatically converts issues into production-ready pull requests using `kiro-cli` or OpenAI's `codex` CLI. No servers, no webhooks, no complexity — just `npm install` and run.

📋 **Live Project Board**: [See it in action](https://github.com/users/llamojha/projects/7) • 🎥 **Demo Video**: [Watch the workflow](https://www.youtube.com/watch?v=qomajZkC1fU)

## Quick Start

```bash
# 1. Install prerequisites
# - Node.js 18+ (https://nodejs.org)
# - GitHub CLI (https://cli.github.com)
# - kiro-cli (https://kiro.dev/docs/cli/installation)

# 2. Authenticate with GitHub CLI
gh auth login

# 3. Install VibeSprint
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint && npm install && npm run build && npm link

# 4. Setup in your project
cd /path/to/your/project
echo ".vibesprint" >> .gitignore

# 5. Run (first time will prompt for project/column setup)
vibesprint run
```

**That's it!** Add issues to your "Ready" column and watch them become PRs automatically.

## Setup

### 1. Prerequisites

**Node.js 18+**
- Download from [nodejs.org](https://nodejs.org)
- Verify: `node --version` (should be 18.0.0 or higher)

**GitHub CLI**
- Install from [cli.github.com](https://cli.github.com)
- Verify: `gh --version`
- Authenticate: `gh auth login`

**Kiro CLI**
- Install from [kiro.dev](https://kiro.dev/docs/cli/installation)
- Verify: `kiro-cli --version`

**OpenAI Codex CLI (Optional)**
- Install: `npm install -g @openai/codex`
- Verify: `codex --version`
- Authenticate: `codex login`

### 2. GitHub Authentication

VibeSprint uses the GitHub CLI (`gh`) for all GitHub operations. Just run:

```bash
gh auth login
```

Follow the prompts to authenticate. That's it - no tokens to manage!

### 3. GitHub Project Board Setup

Create a GitHub Project board with these columns:

1. **Go to your repository**
2. **Click "Projects" tab → "New project"**
3. **Choose "Board" template**
4. **Create 4 columns** (in this order):
   - `Backlog` - For sub-issues (not monitored)
   - `Ready` - Issues here get processed automatically
   - `In Progress` - Issues being worked on
   - `In Review` - Issues with open PRs

### 4. Installation

```bash
# Clone and install
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint
npm install
npm run build
npm link
```

### 5. Project Configuration

Navigate to your target repository and run the setup:

```bash
cd /path/to/your/project

# Add config file to gitignore
echo ".vibesprint" >> .gitignore

# First run will prompt for configuration
vibesprint run
```

The CLI will ask you to:
1. **Link to a GitHub Project** - Select from your available projects
2. **Choose columns** - Map your board columns to workflow states
3. **Set polling interval** - How often to check for new issues (default: 60s)

### 6. Test the Setup

1. **Create a test issue** in your repository
2. **Add it to your "Ready" column**
3. **Watch the logs** - it should pick up the issue within your polling interval
4. **Check for the PR** - a new branch and PR should be created automatically

## ✨ Key Features

- **🎯 Issue → PR in minutes**: Drop an issue in your "Ready" column, get a complete PR with code, tests, and documentation
- **🧠 Smart planning**: Add a `plan` label to break complex features into manageable sub-issues automatically  
- **⚡ Parallel execution**: Uses Kiro's subagent system to handle multiple tasks simultaneously
- **🔒 Fully local**: Runs on your machine with your credentials — no cloud dependencies
- **🎨 Workflow innovation**: 30+ custom Kiro prompts for debugging, planning, and code review

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
├── cli.ts           # CLI entry point
├── config.ts        # Configuration management
├── context.ts       # Build prompts for kiro-cli
├── git.ts           # Git operations (branch, commit, PR)
├── intake.ts        # Fetch issues from project board
├── run.ts           # Main polling loop
├── status.ts        # Labels, comments, column updates
├── utils.ts         # Utilities (ANSI stripping)
├── commands/
│   ├── link.ts      # Project linking
│   ├── column.ts    # Column selection
│   └── executor.ts  # Executor selection
└── executors/
    ├── types.ts     # Executor interface
    ├── kiro.ts      # Kiro CLI executor
    ├── codex.ts     # OpenAI Codex executor
    └── index.ts     # Factory and exports
```

## License

MIT
