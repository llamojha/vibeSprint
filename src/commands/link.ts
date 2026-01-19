import { select, input } from '@inquirer/prompts';
import { graphql } from '@octokit/graphql';
import { loadConfig, saveConfig, getToken } from '../config.js';

interface Project {
  id: string;
  number: number;
  title: string;
}

export async function link(): Promise<void> {
  const token = getToken();
  const config = loadConfig();

  const owner = await input({
    message: 'Repository owner (org or user):',
    default: config.owner,
  });

  const repo = await input({
    message: 'Repository name:',
    default: config.repo,
  });

  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });

  const { repository } = await gql<{ repository: { projectsV2: { nodes: Project[] } } }>(`
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        projectsV2(first: 20) {
          nodes { id number title }
        }
      }
    }
  `, { owner, repo });

  const projects = repository.projectsV2.nodes;
  if (!projects.length) {
    console.log('No projects found for this repository.');
    return;
  }

  const projectId = await select({
    message: 'Select a project:',
    choices: projects.map(p => ({ name: `#${p.number} ${p.title}`, value: p.id })),
  });

  const selected = projects.find(p => p.id === projectId)!;
  saveConfig({ ...config, owner, repo, projectId, projectNumber: selected.number });
  console.log(`Linked to project #${selected.number}: ${selected.title}`);
}
