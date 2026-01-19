---
description: End-to-end testing of VibeSprint workflow
---

# VibeSprint E2E Test

Validate the full issue-to-PR pipeline works correctly.

## Pre-flight Checks

1. Verify config: `vibesprint config show`
2. Check token: `echo $GITHUB_TOKEN | head -c 10`
3. Confirm on correct repo and branch

## Test Procedure

### 1. Create Test Issue
Create a small, safe issue on your GitHub Project board:
- Title: `[TEST] Add comment to README`
- Body: `Add a comment at the top of README.md with today's date`
- Move to "Ready" column

### 2. Dry Run
```bash
vibesprint run --dry-run
```
Verify test issue appears in output.

### 3. Execute
```bash
vibesprint run --verbose
```

### 4. Verify Results
- [ ] `running` label added during execution
- [ ] PR created with correct branch name (`agent/<number>-...`)
- [ ] PR body contains description
- [ ] `pr-opened` label added
- [ ] Issue moved to "In Review" column
- [ ] Changes in PR match issue request

### 5. Cleanup
- Close test PR without merging
- Delete test branch
- Close test issue

## Failure Testing

To test retry logic:
1. Create issue with impossible request
2. Run VibeSprint, observe `retry` label
3. Run again, observe `failed` label and error comment

## Expected Timing
- Dry run: <5 seconds
- Full execution: 1-5 minutes (depends on kiro-cli)
