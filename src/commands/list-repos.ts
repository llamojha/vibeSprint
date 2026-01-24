import { loadConfig, removeRepo } from '../config.js';

export function listRepos(): void {
  const config = loadConfig();
  
  if (config.repos.length === 0) {
    console.log('No repositories configured. Run `vibesprint config add-repo` to add one.');
    return;
  }

  console.log('Configured repositories:\n');
  for (const repo of config.repos) {
    const provider = repo.provider || 'github';
    console.log(`  ${repo.name} [${provider}]`);
    console.log(`    Repo: ${repo.owner}/${repo.repo}`);
    console.log(`    Path: ${repo.path}`);
    
    if (provider === 'linear') {
      console.log(`    Team: ${repo.linearTeamName || repo.linearTeamId}`);
      if (repo.linearRepoLabel) {
        console.log(`    Repo label: ${repo.linearRepoLabel}`);
      }
    } else {
      console.log(`    Project: #${repo.projectNumber}`);
      console.log(`    Ready column: ${repo.columnName}`);
    }
    console.log('');
  }
}

export function removeRepoCommand(name: string): void {
  if (!name) {
    console.error('Usage: vibesprint config remove-repo <name>');
    process.exit(1);
  }

  if (removeRepo(name)) {
    console.log(`✅ Removed repo: ${name}`);
  } else {
    console.error(`Error: Repo not found: ${name}`);
    process.exit(1);
  }
}
