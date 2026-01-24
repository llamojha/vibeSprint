import { select, input } from '@inquirer/prompts';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { addRepo, type RepoConfig } from '../config.js';

interface Project {
  number: number;
  title: string;
  id: string;
}

interface FieldOption {
  id: string;
  name: string;
}

interface Field {
  id: string;
  name: string;
  type: string;
  options?: FieldOption[];
}

async function selectColumn(
  options: FieldOption[],
  message: string,
  defaultName: string,
  exclude: string[] = []
): Promise<{ id: string; name: string }> {
  const available = options.filter(o => !exclude.includes(o.id));
  const defaultOption = available.find(o => o.name === defaultName);
  
  const id = await select({
    message,
    choices: available.map(o => ({ name: o.name, value: o.id })),
    default: defaultOption?.id,
  });
  
  const selected = available.find(o => o.id === id);
  if (!selected) {
    throw new Error('Invalid column selection');
  }
  return { id, name: selected.name };
}

export async function addRepoCommand(): Promise<void> {
  // Step 1: Basic info
  const owner = await input({ message: 'Repository owner (org or user):' });
  const repo = await input({ message: 'Repository name:' });
  const name = await input({ message: 'Friendly name for this repo:', default: repo });
  const path = await input({ message: 'Local path to repo clone:' });

  if (!existsSync(path)) {
    console.error(`\n\x1b[31m❌ ERROR: Path not found: ${path}\x1b[0m`);
    console.error('Please try again with a valid path.\n');
    return;
  }

  if (!existsSync(join(path, '.git'))) {
    console.error(`\n\x1b[31m❌ ERROR: Not a git repository: ${path}\x1b[0m`);
    console.error('Please try again with a valid git repository.\n');
    return;
  }

  // Step 2: Select project
  const projectResult = spawnSync('gh', [
    'project', 'list', '--owner', owner, '--format', 'json',
  ], { encoding: 'utf-8' });

  if (projectResult.status !== 0) {
    console.error(`\n\x1b[31m❌ ERROR: Failed to list projects: ${projectResult.stderr}\x1b[0m`);
    console.error('Please check your GitHub authentication and try again.\n');
    return;
  }

  let projects: Project[];
  try {
    const parsed = JSON.parse(projectResult.stdout);
    projects = parsed.projects || parsed;
  } catch {
    console.error('\n\x1b[31m❌ ERROR: Failed to parse projects response.\x1b[0m');
    console.error('Please try again.\n');
    return;
  }

  if (!projects.length) {
    console.error('\n\x1b[31m❌ ERROR: No projects found for this owner.\x1b[0m');
    console.error('Please create a GitHub Project first.\n');
    return;
  }

  const projectNumber = await select({
    message: 'Select a project:',
    choices: projects.map(p => ({ name: `#${p.number} ${p.title}`, value: p.number })),
  });

  const selectedProject = projects.find(p => p.number === projectNumber)!;

  // Step 3: Select columns
  const fieldResult = spawnSync('gh', [
    'project', 'field-list', String(projectNumber), '--owner', owner, '--format', 'json',
  ], { encoding: 'utf-8' });

  if (fieldResult.status !== 0) {
    console.error(`\n\x1b[31m❌ ERROR: Failed to list project fields: ${fieldResult.stderr}\x1b[0m`);
    console.error('Please try again.\n');
    return;
  }

  let fields: Field[];
  try {
    const parsed = JSON.parse(fieldResult.stdout);
    fields = parsed.fields || parsed;
  } catch {
    console.error('\n\x1b[31m❌ ERROR: Failed to parse fields response.\x1b[0m');
    console.error('Please try again.\n');
    return;
  }

  const statusField = fields.find(f => f.name === 'Status' && f.type === 'ProjectV2SingleSelectField');
  if (!statusField?.options || statusField.options.length < 4) {
    console.error('\n\x1b[31m❌ ERROR: Project needs a Status field with at least 4 options.\x1b[0m');
    console.error('Please add Backlog, Ready, In Progress, and In Review columns.\n');
    return;
  }

  const opts = statusField.options;
  const backlog = await selectColumn(opts, 'Select Backlog column:', 'Backlog');
  const ready = await selectColumn(opts, 'Select Ready column (monitored):', 'Ready', [backlog.id]);
  const inProgress = await selectColumn(opts, 'Select In Progress column:', 'In Progress', [backlog.id, ready.id]);
  const inReview = await selectColumn(opts, 'Select In Review column:', 'In Review', [backlog.id, ready.id, inProgress.id]);

  // Step 4: Save
  const repoConfig: RepoConfig = {
    name,
    owner,
    repo,
    path,
    projectId: selectedProject.id,
    projectNumber: selectedProject.number,
    columnFieldId: statusField.id,
    columnOptionId: ready.id,
    columnName: ready.name,
    backlogOptionId: backlog.id,
    backlogColumnName: backlog.name,
    inProgressOptionId: inProgress.id,
    inProgressColumnName: inProgress.name,
    inReviewOptionId: inReview.id,
    inReviewColumnName: inReview.name,
  };

  addRepo(repoConfig);
  console.log(`✅ Added repo: ${name} (${owner}/${repo})`);
}
