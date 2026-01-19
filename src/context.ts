import { graphql } from '@octokit/graphql';
import { getToken } from './config.js';
import { stripAnsi } from './utils.js';
import type { Issue } from './intake.js';

export interface IssueContext {
  issue: Issue;
  comments: string[];
  prompt: string;
}

export async function buildContext(issue: Issue): Promise<IssueContext> {
  const token = getToken();
  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });

  const { node } = await gql<{
    node: { comments: { nodes: Array<{ body: string; author: { login: string } }> } };
  }>(`
    query($issueId: ID!) {
      node(id: $issueId) {
        ... on Issue {
          comments(last: 10) {
            nodes { body author { login } }
          }
        }
      }
    }
  `, { issueId: issue.id });

  const comments = node.comments.nodes.map(c => `@${c.author?.login ?? 'unknown'}: ${c.body}`);

  const prompt = `
You are working on GitHub issue #${issue.number}: ${issue.title}

## Issue Description
${issue.body || 'No description provided.'}

${comments.length ? `## Recent Comments\n${comments.join('\n\n')}` : ''}

## Task
Implement the changes described in this issue. Create or modify the necessary files.
When done, ensure all changes are saved.

## PR Description
After completing the implementation, output a PR description in the following format:

---PR_DESCRIPTION_START---
<Your PR description here explaining what was done and why>
---PR_DESCRIPTION_END---
`.trim();

  return { issue, comments, prompt };
}

export function parsePRDescription(output: string): string | undefined {
  const match = output.match(/-*PR_DESCRIPTION_START-*\n?([\s\S]*?)-*PR_DESCRIPTION_END-*/);
  if (!match) return undefined;
  return stripAnsi(match[1]).trim();
}

export interface PlanTask {
  title: string;
  body: string;
}

export async function buildPlanContext(issue: Issue): Promise<IssueContext> {
  const token = getToken();
  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });

  const { node } = await gql<{
    node: { comments: { nodes: Array<{ body: string; author: { login: string } }> } };
  }>(`
    query($issueId: ID!) {
      node(id: $issueId) {
        ... on Issue {
          comments(last: 10) {
            nodes { body author { login } }
          }
        }
      }
    }
  `, { issueId: issue.id });

  const comments = node.comments.nodes.map(c => `@${c.author?.login ?? 'unknown'}: ${c.body}`);

  const prompt = `
You are analyzing GitHub issue #${issue.number}: ${issue.title}

## Issue Description
${issue.body || 'No description provided.'}

${comments.length ? `## Recent Comments\n${comments.join('\n\n')}` : ''}

## Task
Break down this feature request into PR-sized implementation tasks. Each task should be small enough to implement in a single PR.

For each task, write a proper issue/ticket that includes:
- Clear description of what needs to be implemented
- Acceptance criteria (what defines "done")
- Testing guidance (how to verify it works)

Output your plan in the following format:

---PLAN_START---
## Task 1: <title>

### Description
<What needs to be implemented and why>

### Acceptance Criteria
- [ ] <Criterion 1>
- [ ] <Criterion 2>
- [ ] <Criterion 3>

### Testing
<How to test/verify this works>

## Task 2: <title>

### Description
<What needs to be implemented and why>

### Acceptance Criteria
- [ ] <Criterion 1>
- [ ] <Criterion 2>

### Testing
<How to test/verify this works>
---PLAN_END---

Keep tasks focused and actionable. Include 2-6 tasks depending on complexity.
`.trim();

  return { issue, comments, prompt };
}

export function parsePlanOutput(output: string): PlanTask[] {
  const cleaned = stripAnsi(output);
  const match = cleaned.match(/-*PLAN_START-*\n?([\s\S]*?)-*PLAN_END-*/);
  if (!match) return [];

  const planContent = match[1];
  const tasks: PlanTask[] = [];
  const taskRegex = /## Task \d+:\s*(.+?)\n([\s\S]*?)(?=## Task \d+:|$)/g;
  
  let taskMatch;
  while ((taskMatch = taskRegex.exec(planContent)) !== null) {
    const title = taskMatch[1].trim();
    const content = taskMatch[2].trim();
    
    tasks.push({
      title,
      body: content,
    });
  }

  return tasks;
}
