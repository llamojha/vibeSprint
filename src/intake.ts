import { loadConfig } from './config.js';
import { createProvider } from './providers/index.js';
import type { Issue } from './providers/types.js';

export type { Issue };

export async function getIssuesInColumn(): Promise<Issue[]> {
  const config = loadConfig();
  const allIssues: Issue[] = [];

  for (const repoConfig of config.repos) {
    const provider = createProvider(repoConfig);
    const issues = await provider.getIssues();
    allIssues.push(...issues);
  }

  return allIssues.sort((a, b) => 
    (a.repoConfig?.name || '').localeCompare(b.repoConfig?.name || '') || a.number - b.number
  );
}

export async function ensureAllLabelsExist(): Promise<void> {
  const config = loadConfig();
  for (const repoConfig of config.repos) {
    console.log(`  📦 ${repoConfig.name}...`);
    const provider = createProvider(repoConfig);
    await provider.ensureLabelsExist();
  }
}
