# VibeSprint

> **Turn GitHub issues into pull requests automatically** — Just add an issue to your "Ready" column and watch VibeSprint generate, commit, and open a PR for you.

A self-hosted CLI that monitors your GitHub Project board and automatically converts issues into production-ready pull requests using `kiro-cli`. No servers, no webhooks, no complexity — just `npm install` and run.

📋 **Live Project Board**: [See it in action](https://github.com/users/llamojha/projects/7) • 🎥 **Demo Video**: [Watch the workflow](https://www.youtube.com/watch?v=qomajZkC1fU)

## Quick Start

```bash
# 1. Install prerequisites
# - Node.js 18+ (https://nodejs.org)
# - kiro-cli (https://kiro.dev/docs/cli/installation)

# 2. Get GitHub token (see Setup section below)
export GITHUB_TOKEN=github_pat_xxx

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

**Kiro CLI**
- Install from [kiro.dev](https://kiro.dev/docs/cli/installation)
- Verify: `kiro-cli --version`

### 2. GitHub Personal Access Token

**Option A: Fine-grained Token (Recommended)**

1. **Go to GitHub Settings**
   - Visit [github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
   - Click "Generate new token"

2. **Configure Token**
   - **Name**: `vibesprint`
   - **Expiration**: Choose your preference (90 days recommended)
   - **Resource owner**: Select your username or organization
   - **Repository access**: Select specific repositories you want to automate

3. **Set Permissions**
   - **Issues**: Read and write
   - **Pull requests**: Read and write
   - **Contents**: Read and write
   - **Projects**: Read and write
   - **Metadata**: Read (automatically selected)

4. **Generate and Save**
   - Click "Generate token"
   - **Important**: Copy the token immediately (starts with `github_pat_`)
   - Store it securely - you won't see it again

**Option B: Classic Token (Alternative)**

If fine-grained tokens don't work for your setup:

1. **Go to GitHub Settings**
   - Visit [github.com/settings/tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"

2. **Configure Token**
   - **Name**: `vibesprint`
   - **Expiration**: Choose your preference (90 days recommended)
   - **Select scopes**:
     - `repo` (Full control of private repositories)
     - `project` (Full control of projects)

3. **Generate and Save**
   - Click "Generate token"
   - Copy the token immediately (starts with `ghp_`)
   - Store it securely

**Set Environment Variable** (for either option)
```bash
export GITHUB_TOKEN=github_pat_xxx  # or ghp_xxx for classic

# To make it permanent, add to your shell profile:
echo 'export GITHUB_TOKEN=github_pat_xxx' >> ~/.bashrc
# or ~/.zshrc if using zsh
```

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
```

Press `Ctrl+C` to stop.

## Commands

| Command | Description |
|---------|-------------|
| `vibesprint config link` | Link to a GitHub Project |
| `vibesprint config column` | Select columns to use |
| `vibesprint config show` | Show current configuration |
| `vibesprint config reset` | Reset configuration |
| `vibesprint run` | Start polling and processing |
| `vibesprint run --dry-run` | Show issues without processing |
| `vibesprint run --interval <s>` | Set polling interval (default: 60s) |
| `vibesprint run --verbose` | Show detailed output |

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
export GITHUB_TOKEN=github_pat_xxx
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
| `GITHUB_TOKEN not set` | Export token: `export GITHUB_TOKEN=github_pat_xxx` |
| `Project not configured` | Run `vibesprint config link` |
| `404 on label operations` | Ensure token has Issues: Read/Write permission |
| `Config file lost` | Add `.vibesprint` to `.gitignore` |
| `kiro-cli not found` | Install kiro-cli: https://kiro.dev/docs/cli/installation |

## Project Structure

```
src/
├── cli.ts           # CLI entry point
├── config.ts        # Configuration management
├── context.ts       # Build prompts for kiro-cli
├── executor.ts      # Invoke kiro-cli
├── git.ts           # Git operations (branch, commit, PR)
├── intake.ts        # Fetch issues from project board
├── run.ts           # Main polling loop
├── status.ts        # Labels, comments, column updates
├── utils.ts         # Utilities (ANSI stripping)
└── commands/
    ├── link.ts      # Project linking
    └── column.ts    # Column selection
```

## License

MIT
