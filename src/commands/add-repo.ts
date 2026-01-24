import { select, input, confirm } from '@inquirer/prompts';
import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { LinearClient, type Team, type WorkflowState } from '@linear/sdk';
import { addRepo, getLinearApiKey, loadConfig, saveConfig, type RepoConfig } from '../config.js';

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

async function selectPath(repoName: string): Promise<string | null> {
  const home = homedir();
  const commonDirs = ['Dev', 'Projects', 'Code', 'repos', 'src', 'work'].map(d => join(home, d));
  const cwd = process.cwd();
  
  const choices: { name: string; value: string }[] = [];
  
  // Check current directory
  if (existsSync(join(cwd, '.git'))) {
    choices.push({ name: `${cwd} (current directory)`, value: cwd });
  }
  
  // Auto-detect repo in common locations
  for (const dir of commonDirs) {
    if (!existsSync(dir)) continue;
    const repoPath = join(dir, repoName);
    if (existsSync(join(repoPath, '.git'))) {
      choices.push({ name: `${repoPath} (detected)`, value: repoPath });
    }
  }
  
  // Browse current directory
  if (!existsSync(join(cwd, '.git'))) {
    choices.push({ name: `Browse ${cwd}`, value: `browse:${cwd}` });
  }
  
  // Add common directories for browsing
  for (const dir of commonDirs) {
    if (existsSync(dir) && !choices.some(c => c.value.startsWith(dir))) {
      choices.push({ name: `Browse ${dir}`, value: `browse:${dir}` });
    }
  }
  
  choices.push({ name: 'Enter path manually', value: 'manual' });
  
  const choice = await select({
    message: 'Local path to repo clone:',
    choices,
  });
  
  if (choice === 'manual') {
    const manualPath = await input({ message: 'Enter full path:' });
    if (!existsSync(manualPath)) {
      console.error(`\n\x1b[31m❌ ERROR: Path not found: ${manualPath}\x1b[0m`);
      console.error('Please try again with a valid path.\n');
      return null;
    }
    if (!existsSync(join(manualPath, '.git'))) {
      console.error(`\n\x1b[31m❌ ERROR: Not a git repository: ${manualPath}\x1b[0m`);
      console.error('Please try again with a valid git repository.\n');
      return null;
    }
    return manualPath;
  }
  
  if (choice.startsWith('browse:')) {
    const dir = choice.replace('browse:', '');
    const subdirs = readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => join(dir, d.name))
      .filter(p => existsSync(join(p, '.git')));
    
    if (subdirs.length === 0) {
      console.error(`\n\x1b[31m❌ ERROR: No git repositories found in ${dir}\x1b[0m\n`);
      return null;
    }
    
    return await select({
      message: 'Select repository:',
      choices: subdirs.map(p => ({ name: p, value: p })),
    });
  }
  
  return choice;
}

async function addLinearRepo(): Promise<void> {
  // Step 1: Get API key
  let apiKey = getLinearApiKey();
  if (!apiKey) {
    console.log('\n📋 Linear API key not found in environment.');
    apiKey = await input({ message: 'Enter your Linear API key:' });
    
    const saveKey = await confirm({ message: 'Save API key to config? (Otherwise set LINEAR_API_KEY env var)', default: false });
    if (saveKey) {
      const config = loadConfig();
      config.linearApiKey = apiKey;
      saveConfig(config);
    }
  }

  const client = new LinearClient({ apiKey });

  // Validate API key
  try {
    await client.viewer;
  } catch {
    console.error('\n\x1b[31m❌ ERROR: Invalid Linear API key.\x1b[0m\n');
    return;
  }

  // Step 2: Select team
  const teams = await client.teams();
  if (teams.nodes.length === 0) {
    console.error('\n\x1b[31m❌ ERROR: No teams found in your Linear workspace.\x1b[0m\n');
    return;
  }

  const teamId = await select({
    message: 'Select Linear team:',
    choices: teams.nodes.map((t: Team) => ({ name: t.name, value: t.id })),
  });
  const selectedTeam = teams.nodes.find((t: Team) => t.id === teamId)!;

  // Step 3: Map workflow states
  const states = await selectedTeam.states();
  const stateChoices = states.nodes.map((s: WorkflowState) => ({ name: `${s.name} (${s.type})`, value: s.id }));

  const readyStateId = await select({ message: 'Select "Ready" state (monitored):', choices: stateChoices }) as string;
  const inProgressStateId = await select({ message: 'Select "In Progress" state:', choices: stateChoices }) as string;
  const inReviewStateId = await select({ message: 'Select "In Review" state:', choices: stateChoices }) as string;
  const backlogStateId = await select({ message: 'Select "Backlog" state:', choices: stateChoices }) as string;

  // Step 4: GitHub repo info (for PRs)
  console.log('\n📦 GitHub repository (where PRs will be created):');
  const owner = await input({ message: 'Repository owner (org or user):' });
  const repo = await input({ message: 'Repository name:' });
  const name = await input({ message: 'Friendly name for this config:', default: repo });

  // Step 5: Repo label for shared teams
  let linearRepoLabel: string | undefined;
  const isSharedTeam = await confirm({ message: 'Is this team shared across multiple GitHub repos?', default: false });
  if (isSharedTeam) {
    linearRepoLabel = await input({ message: 'Label to filter issues for this repo:', default: `repo:${repo}` });
  }

  // Step 6: Local path
  const path = await selectPath(repo);
  if (!path) return;

  // Step 7: Save config
  const repoConfig: RepoConfig = {
    name,
    owner,
    repo,
    path,
    provider: 'linear',
    linearTeamId: teamId as string,
    linearTeamName: selectedTeam.name,
    linearRepoLabel,
    linearReadyStateId: readyStateId,
    linearInProgressStateId: inProgressStateId,
    linearInReviewStateId: inReviewStateId,
    linearBacklogStateId: backlogStateId,
  };

  addRepo(repoConfig);
  console.log(`\n✅ Added Linear repo: ${name} (${selectedTeam.name} → ${owner}/${repo})`);

  // Step 8: Create labels
  console.log('🏷️ Creating VibeSprint labels in Linear...');
  const { LinearProvider } = await import('../providers/linear.js');
  const provider = new LinearProvider(repoConfig);
  await provider.ensureLabelsExist();
}

export async function addRepoCommand(options: { linear?: boolean } = {}): Promise<void> {
  if (options.linear) {
    return addLinearRepo();
  }

  // Step 1: Basic info
  const owner = await input({ message: 'Repository owner (org or user):' });
  const repo = await input({ message: 'Repository name:' });
  const name = await input({ message: 'Friendly name for this repo:', default: repo });
  
  // Step 2: Path selection
  const path = await selectPath(repo);
  if (!path) return;

  // Step 3: Select project
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
    provider: 'github',
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
