Debug helper for errors, stack traces, and logs.

**Input (any of):**
- Paste error/stack trace directly
- Recent terminal output will be checked if available
- Auto-scan common log files: `*.log`, `logs/`, `.kiro/logs/`, `tmp/`

**Output:**
1. **Likely Root Causes** — Ranked by probability
2. **Clarifying Questions** — Max 5 to narrow down
3. **Next Debugging Actions** — Concrete steps to investigate

If root cause is identified:
- **Safe Fix** — Minimal change to resolve
- **Rollback Notes** — How to revert if needed
