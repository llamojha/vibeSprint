import { GitHubProvider } from './providers/github.js';
import type { IssueProvider, Issue } from './providers/types.js';

function getProvider(issue: Issue): IssueProvider {
  if (!issue.repoConfig) {
    throw new Error('Issue missing repoConfig');
  }
  return new GitHubProvider(issue.repoConfig);
}

export async function ensureLabelsExist(issue: Issue): Promise<void> {
  const provider = getProvider(issue);
  await provider.ensureLabelsExist();
}

export async function addLabel(issue: Issue, label: string): Promise<void> {
  const provider = getProvider(issue);
  await provider.addLabel(issue, label);
}

export async function removeLabel(issue: Issue, label: string): Promise<void> {
  const provider = getProvider(issue);
  await provider.removeLabel(issue, label);
}

export async function postErrorComment(issue: Issue, runId: string, exitCode: number, stdout: string, stderr: string): Promise<void> {
  const output = (stderr || stdout).slice(-2000);
  
  const body = `## ❌ VibeSprint Run Failed

**Run ID:** \`${runId}\`
**Exit Code:** ${exitCode}

<details>
<summary>Output (last 2000 chars)</summary>

\`\`\`
${output || 'No output captured'}
\`\`\`

</details>`;

  const provider = getProvider(issue);
  await provider.postComment(issue, body);
}

export async function moveToInReview(issue: Issue): Promise<void> {
  const provider = getProvider(issue);
  await provider.moveToColumn(issue, 'inReview');
}

export async function moveToInProgress(issue: Issue): Promise<void> {
  const provider = getProvider(issue);
  await provider.moveToColumn(issue, 'inProgress');
}

export async function postPlanComment(issue: Issue, plan: string, taskCount: number): Promise<void> {
  const body = `## 📋 Plan Generated

${plan}

---
*${taskCount} sub-issue(s) will be created in Backlog.*`;

  const provider = getProvider(issue);
  await provider.postComment(issue, body);
}

export async function createSubIssueInBacklog(
  parentIssue: Issue,
  title: string,
  body: string
): Promise<{ id: number; number: number }> {
  const provider = getProvider(parentIssue);
  return provider.createSubIssue(parentIssue, title, body);
}
