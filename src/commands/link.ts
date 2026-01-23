import { select, input } from '@inquirer/prompts';
import { spawnSync } from 'child_process';
import { loadConfig, saveConfig } from '../config.js';

interface Project {
  number: number;
  title: string;
  id: string;
}

export async function link(): Promise<void> {
  const config = loadConfig();

  const owner = await input({
    message: 'Repository owner (org or user):',
    default: config.owner,
  });

  const repo = await input({
    message: 'Repository name:',
    default: config.repo,
  });

  // Get projects using gh project list
  const result = spawnSync('gh', [
    'project', 'list',
    '--owner', owner,
    '--format', 'json',
  ], { encoding: 'utf-8' });

  if (result.status !== 0) {
    console.error('Failed to list projects:', result.stderr);
    return;
  }

  let projects: Project[];
  try {
    const parsed = JSON.parse(result.stdout);
    projects = parsed.projects || parsed;
  } catch {
    console.error('Failed to parse projects response');
    return;
  }

  if (!projects.length) {
    console.log('No projects found for this owner.');
    return;
  }

  const projectNumber = await select({
    message: 'Select a project:',
    choices: projects.map(p => ({ name: `#${p.number} ${p.title}`, value: p.number })),
  });

  const selected = projects.find(p => p.number === projectNumber);
  if (!selected) {
    console.error('Error: Project selection failed');
    return;
  }
  saveConfig({ ...config, owner, repo, projectId: selected.id, projectNumber: selected.number });
  console.log(`Linked to project #${selected.number}: ${selected.title}`);
}
