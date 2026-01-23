---
inclusion: always
---

# NPM Publishing

## Goal
Publish VibeSprint to npm registry so users can run it via `npx vibesprint` without cloning the repo.

## User Story
As a developer, I can run `npx vibesprint` in any project to start automating issues without manual installation.

## Background

### Current Installation
```bash
git clone https://github.com/amllamojha/vibesprint.git
cd vibesprint && npm install && npm run build && npm link
```

### Proposed Installation
```bash
npx vibesprint run
# or
npm install -g vibesprint
vibesprint run
```

## Scope

### In Scope
- Configure package.json for npm publishing
- Set up `bin` entry point
- Add `files` field to include only necessary files
- Publish to npm registry
- Update README with npx usage

### Out of Scope
- Scoped package (@org/vibesprint)
- Automated publishing via CI

## Tasks

1. Verify package.json `bin` field is correct
2. Add `files` field to package.json (include dist, exclude src)
3. Add `prepublishOnly` script to build before publish
4. Test with `npm pack` locally
5. Publish to npm: `npm publish`
6. Update README with `npx vibesprint` instructions

## Package.json Changes
```json
{
  "bin": {
    "vibesprint": "./dist/cli.js"
  },
  "files": [
    "dist",
    "package.json",
    "README.md"
  ],
  "prepublishOnly": "npm run build"
}
```

## Acceptance Criteria
- [ ] `npx vibesprint --version` works
- [ ] `npx vibesprint run --dry-run` works
- [ ] Package size is reasonable (no src, node_modules)
- [ ] README shows npx as primary install method
