---
description: Debug VibeSprint issues
---

# VibeSprint Debug Helper

Help diagnose issues with VibeSprint.

## Common Issues

1. **Config not found**: Check `.vibesprint` exists in project root
2. **Labels failing**: Ensure GitHub token has Issues: Read/Write permission
3. **PR creation fails**: Check Contents: Read/Write and Pull requests: Read/Write permissions
4. **Project not found**: Verify project is linked with `vibesprint config link`

## Debug Steps

1. Run `vibesprint config show` to verify configuration
2. Check GITHUB_TOKEN is exported: `echo $GITHUB_TOKEN | head -c 10`
3. Test with dry-run: `vibesprint run --dry-run`
4. Check verbose output: `vibesprint run --verbose --once`

## Log Analysis

Look for these error patterns:
- `404` - Resource not found (wrong owner/repo or missing permissions)
- `403` - Forbidden (token lacks permissions)
- `401` - Unauthorized (invalid token)