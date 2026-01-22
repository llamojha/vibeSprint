# Ticket Curation

## Goal
Automatically enhance sparse issue descriptions into well-structured, implementation-ready tickets before code generation begins, improving AI output quality and reducing failed implementations.

## User Story
As a developer, when I create a brief issue like "Add dark mode support", VibeSprint automatically expands it into a detailed specification with acceptance criteria, technical approach, and testing guidance before attempting implementation.

## Background

### The Problem
Many issues are created with minimal descriptions:
- "Fix login bug"
- "Add user settings page"
- "Improve performance"

When kiro-cli receives these sparse prompts, it often:
- Makes incorrect assumptions about requirements
- Implements the wrong solution
- Misses edge cases
- Produces code that doesn't match expectations

### The Solution
Add a "curation" phase before implementation:
1. Issue enters "Ready" column
2. VibeSprint detects sparse description
3. AI generates detailed spec/plan
4. Spec posted as comment for review
5. After approval, implementation proceeds

This is similar to the existing "plan" workflow but focused on enriching the ticket itself rather than breaking it into sub-tasks.

### Comparison with Plan Workflow
| Aspect | Plan Workflow | Curation Workflow |
|--------|---------------|-------------------|
| Trigger | `plan` label | `curate` label or auto-detect |
| Output | Sub-issues in Backlog | Enhanced description as comment |
| Purpose | Break down large features | Clarify vague requirements |
| Next Step | Move sub-issues to Ready | Implement the curated ticket |

## Scope

### In Scope
- New `curate` label to trigger curation workflow
- Auto-detection of sparse issues (optional)
- AI-powered spec generation from brief descriptions
- Spec posted as issue comment
- Approval gate before implementation
- Integration with existing implement workflow

### Out of Scope
- Automatic issue description editing (comments only)
- Multi-round curation refinement
- User feedback incorporation into curation
- Curation for plan workflow (plan already generates detailed tasks)
- Custom curation templates per repository

## Technical Design

### Workflow States

```
Issue in Ready with [curate] label
  → [running] label added
  → AI generates detailed spec
  → Spec posted as comment
  → [running] removed, [curated] added
  → Issue stays in Ready (awaiting approval)

User reviews and approves (removes [curate], adds [approved] or just removes [curate])
  → Next poll picks up issue (no curate label)
  → Normal implement workflow proceeds
```

### Label Taxonomy Extension
```
Existing:
- plan          → Trigger plan workflow
- running       → Currently processing
- pr-opened     → PR created
- plan-posted   → Plan generated

New:
- curate        → Trigger curation workflow
- curated       → Curation complete, awaiting approval
- approved      → (Optional) Explicit approval for curated issues
```

### Sparse Issue Detection (Optional)
Auto-detect issues that need curation:
```typescript
function needsCuration(issue: Issue): boolean {
  // Explicit label takes precedence
  if (issue.labels.includes('curate')) return true;
  if (issue.labels.includes('curated')) return false;
  if (issue.labels.includes('no-curate')) return false;
  
  // Auto-detection heuristics
  const bodyLength = (issue.body || '').trim().length;
  const hasAcceptanceCriteria = /acceptance criteria|AC:|requirements:/i.test(issue.body || '');
  const hasCodeBlocks = /```/.test(issue.body || '');
  
  // Sparse if: short body, no AC, no code examples
  return bodyLength < 200 && !hasAcceptanceCriteria && !hasCodeBlocks;
}
```

### Config Extension
```typescript
export interface Config {
  // Existing fields...
  
  // Curation settings
  autoCurate?: boolean;           // Auto-detect sparse issues
  curationMinLength?: number;     // Minimum body length to skip curation (default: 200)
  curationApprovalRequired?: boolean;  // Require explicit approval after curation
}
```

### Curation Prompt
```typescript
// src/context.ts
export async function buildCurationContext(issue: Issue): Promise<IssueContext> {
  const prompt = `
You are a technical product manager helping to refine a GitHub issue into a well-structured specification.

## Original Issue
**Title**: ${issue.title}
**Description**: ${issue.body || 'No description provided.'}

## Your Task
Transform this brief issue into a detailed, implementation-ready specification. Include:

1. **Summary**: Clear one-paragraph description of what needs to be done
2. **Background**: Why this change is needed (infer from context if not stated)
3. **Requirements**: Specific, measurable requirements
4. **Acceptance Criteria**: Checkboxes for what defines "done"
5. **Technical Approach**: Suggested implementation strategy
6. **Testing**: How to verify the implementation works
7. **Edge Cases**: Potential edge cases to handle
8. **Out of Scope**: What this issue explicitly does NOT cover

## Output Format
Output your specification in the following format:

---CURATION_START---
## Summary
<one paragraph summary>

## Background
<context and motivation>

## Requirements
- <requirement 1>
- <requirement 2>
- <requirement 3>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Technical Approach
<suggested implementation>

## Testing
<how to test>

## Edge Cases
- <edge case 1>
- <edge case 2>

## Out of Scope
- <exclusion 1>
- <exclusion 2>
---CURATION_END---

Be specific and actionable. If the original issue is ambiguous, make reasonable assumptions and note them.
`.trim();

  return { issue, comments: [], prompt };
}
```

### Curation Output Parsing
```typescript
// src/context.ts
export function parseCurationOutput(output: string): string | undefined {
  const cleaned = stripAnsi(output);
  const match = cleaned.match(/-*CURATION_START-*\n?([\s\S]*?)-*CURATION_END-*/);
  if (!match) return undefined;
  return match[1].trim();
}
```

### Curation Comment Format
```typescript
async function postCurationComment(
  config: Config, 
  issue: Issue, 
  curation: string
): Promise<void> {
  const comment = `## 📋 Curated Specification

${curation}

---
*This specification was auto-generated by VibeSprint. Review and approve by removing the \`curate\` label to proceed with implementation.*

<details>
<summary>Original Issue</summary>

${issue.body || 'No description provided.'}

</details>
`;

  await postComment(config, issue, comment);
}
```

### Run Loop Integration
```typescript
// src/run.ts
function isCurateIssue(issue: Issue): boolean {
  return issue.labels.some(l => l.toLowerCase() === 'curate');
}

function isCuratedIssue(issue: Issue): boolean {
  return issue.labels.some(l => l.toLowerCase() === 'curated');
}

async function processCurateIssue(
  config: Config, 
  issue: Issue, 
  runId: string, 
  isRetry: boolean, 
  verbose?: boolean
): Promise<void> {
  try {
    const context = await buildCurationContext(issue);
    console.log('📋 Built curation context, invoking kiro-cli...');

    const result = await executeKiro(context, issue.model, verbose);

    if (!result.success) {
      console.error(`❌ kiro-cli failed with exit code ${result.exitCode}`);
      await handleFailure(config, issue, isRetry, runId, result);
      return;
    }

    const curation = parseCurationOutput(result.stdout);
    if (!curation) {
      console.error('❌ No curation found in output');
      await handleFailure(config, issue, isRetry, runId, result);
      return;
    }

    console.log('✅ Curation generated');
    await postCurationComment(config, issue, curation);
    console.log('💬 Curation posted as comment');

    await removeLabel(config, issue, 'running');
    await removeLabel(config, issue, 'curate');
    await addLabel(config, issue, 'curated');
    console.log('📋 Issue marked as curated, awaiting approval');
  } catch (err) {
    // Error handling...
  }
}

async function processIssue(config: Config, issue: Issue, isRetry: boolean, verbose?: boolean): Promise<void> {
  const runId = randomUUID().slice(0, 8);
  const isPlan = isPlanIssue(issue);
  const isCurate = isCurateIssue(issue);
  
  console.log(`\n🚀 Processing issue #${issue.number}: ${issue.title} (run-id: ${runId}${isRetry ? ', retry' : ''}${isPlan ? ', plan' : ''}${isCurate ? ', curate' : ''})`);

  if (isRetry) {
    await removeLabel(config, issue, 'retry');
  }
  await addLabel(config, issue, 'running');

  if (isCurate) {
    await processCurateIssue(config, issue, runId, isRetry, verbose);
  } else if (isPlan) {
    await processPlanIssue(config, issue, runId, isRetry, verbose);
  } else {
    await processImplementIssue(config, issue, runId, isRetry, verbose);
  }
}
```

### Auto-Curation Mode
```typescript
// src/run.ts
async function poll(): Promise<void> {
  const issues = await getIssuesInColumn();
  
  if (config.autoCurate) {
    // Check for sparse issues that need curation
    for (const issue of issues) {
      if (needsCuration(issue) && !issue.labels.includes('curated')) {
        console.log(`📋 Auto-adding curate label to sparse issue #${issue.number}`);
        await addLabel(config, issue, 'curate');
      }
    }
    // Re-fetch to get updated labels
    issues = await getIssuesInColumn();
  }
  
  // ... rest of polling logic
}
```

### CLI Commands

#### `vibesprint config curate`
```bash
$ vibesprint config curate
? Enable auto-curation for sparse issues? Yes
? Minimum description length to skip curation (chars): 200
? Require explicit approval after curation? No
✓ Curation settings saved
```

#### `vibesprint curate <issue-number>`
Manual curation trigger:
```bash
$ vibesprint curate 42
📋 Curating issue #42: Add dark mode support
✅ Curation posted as comment
```

## Tasks

### Task 1: Label Taxonomy Extension
- Add `curate` label to REQUIRED_LABELS
- Add `curated` label to REQUIRED_LABELS
- Update `ensureLabelsExist()` to create new labels

### Task 2: Curation Context Builder
- Create `buildCurationContext()` function
- Design curation prompt template
- Include original issue content in prompt

### Task 3: Curation Output Parser
- Implement `parseCurationOutput()` function
- Handle edge cases (missing markers, malformed output)
- Strip ANSI codes from output

### Task 4: Curation Comment Formatter
- Create `postCurationComment()` function
- Include collapsible original issue
- Add approval instructions

### Task 5: Run Loop - Curate Detection
- Add `isCurateIssue()` helper
- Add `isCuratedIssue()` helper
- Update issue type detection in `processIssue()`

### Task 6: Run Loop - Curate Processing
- Implement `processCurateIssue()` function
- Handle success: post comment, update labels
- Handle failure: retry/failed labels, error comment

### Task 7: Config Extension
- Add `autoCurate` boolean field
- Add `curationMinLength` number field
- Add `curationApprovalRequired` boolean field

### Task 8: Auto-Curation Detection
- Implement `needsCuration()` heuristic function
- Check body length, acceptance criteria, code blocks
- Respect `no-curate` label to skip

### Task 9: Config Command
- Implement `vibesprint config curate` command
- Interactive settings for auto-curation
- Validation and defaults

### Task 10: Manual Curate Command
- Implement `vibesprint curate <issue>` command
- Fetch issue, run curation, post comment
- Useful for one-off curation without polling

### Task 11: Documentation
- Update README with curation workflow
- Document label meanings
- Add examples of sparse vs. detailed issues

## Acceptance Criteria
- [ ] `curate` label triggers curation workflow
- [ ] Curation generates detailed spec from brief description
- [ ] Spec posted as formatted comment on issue
- [ ] `curated` label added after successful curation
- [ ] `curate` label removed after curation
- [ ] Issue stays in Ready column after curation
- [ ] Removing `curated` label allows normal implementation
- [ ] Auto-curation detects sparse issues (when enabled)
- [ ] `no-curate` label prevents auto-curation
- [ ] `vibesprint curate 42` manually curates specific issue
- [ ] Failed curation follows retry/failed pattern

## Example Workflow

### Before Curation
```
Issue #42: Add dark mode support
Body: "Users want dark mode"
Labels: [curate]
```

### After Curation
```
Issue #42: Add dark mode support
Body: "Users want dark mode"
Labels: [curated]

Comment:
## 📋 Curated Specification

## Summary
Implement a dark mode theme option that allows users to switch between 
light and dark color schemes across the application...

## Requirements
- Add theme toggle in user settings
- Persist theme preference in localStorage
- Support system preference detection
- Apply theme to all UI components

## Acceptance Criteria
- [ ] Theme toggle visible in settings
- [ ] Theme persists across sessions
- [ ] All components respect theme
- [ ] Smooth transition between themes

## Technical Approach
1. Create CSS custom properties for colors
2. Add ThemeContext provider
3. Implement useTheme hook
4. Add toggle component in settings

## Testing
- Toggle theme and verify all components update
- Refresh page and verify persistence
- Test system preference detection

## Edge Cases
- Handle components with hardcoded colors
- Support reduced motion preference
- Handle theme during SSR

## Out of Scope
- Per-component theme overrides
- Custom color picker
- Scheduled theme switching
```

### After Approval (user removes `curated` label)
```
Issue #42: Add dark mode support
Body: "Users want dark mode"
Labels: []  (or [approved] if using explicit approval)

→ Next poll: Normal implement workflow with curated spec as context
```

## Security Considerations
- Curation prompt doesn't include sensitive data
- Generated specs are public (posted as comments)
- No code execution during curation phase

## Future Considerations
- **Iterative Refinement**: Allow users to request changes to curation
- **Custom Templates**: Per-repo curation templates
- **Curation Quality Scoring**: Rate curation quality, improve prompts
- **Curation History**: Track curation versions
- **Integration with Plan**: Auto-curate before planning large features
