import { loadConfig, type Config } from './config.js';
import { GitHubProvider } from './providers/github.js';
import type { IssueProvider, Issue } from './providers/types.js';

function getProvider(): IssueProvider {
  return new GitHubProvider();
}

export async function ensureLabelsExist(config: Config): Promise<void> {
  const provider = getProvider();
  await provider.ensureLabelsExist();
}

export async function addLabel(config: Config, issue: Issue, label: string): Promise<void> {
  const provider = getProvider();
  await provider.addLabel(issue, label);
}

export async function removeLabel(config: Config, issue: Issue, label: string): Promise<void> {
  const provider = getProvider();
  await provider.removeLabel(issue, label);
}

export async function postErrorComment(config: Config, issue: Issue, runId: string, exitCode: number, stdout: string, stderr: string): Promise<void> {
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

  const provider = getProvider();
  await provider.postComment(issue, body);
}

export async function moveToInReview(config: Config, issue: Issue): Promise<void> {
  const provider = getProvider();
  await provider.moveToColumn(issue, 'inReview');
}

export async function moveToInProgress(config: Config, issue: Issue): Promise<void> {
  const provider = getProvider();
  await provider.moveToColumn(issue, 'inProgress');
}

export async function postPlanComment(config: Config, issue: Issue, plan: string, taskCount: number): Promise<void> {
  const body = `## 📋 Plan Generated

${plan}

---
*${taskCount} sub-issue(s) will be created in Backlog.*`;

  const provider = getProvider();
  await provider.postComment(issue, body);
}

export async function createSubIssueInBacklog(
  config: Config,
  parentIssue: Issue,
  title: string,
  body: string
): Promise<{ id: number; number: number }> {
  const provider = getProvider();
  return provider.createSubIssue(parentIssue, title, body);
}
