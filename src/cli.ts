#!/usr/bin/env node
import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig, saveConfig, isConfigComplete, AVAILABLE_MODELS } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
export const VERSION = pkg.version;

const program = new Command();

program
  .name('vibesprint')
  .description('GitHub-driven automation for issue-to-PR workflows')
  .version(VERSION);

const config = program.command('config').description('Configure VibeSprint settings');

config
  .command('add-repo')
  .description('Add a repository to monitor')
  .action(async () => {
    const { addRepoCommand } = await import('./commands/add-repo.js');
    await addRepoCommand();
  });

config
  .command('list')
  .description('List configured repositories')
  .action(async () => {
    const { listRepos } = await import('./commands/list-repos.js');
    listRepos();
  });

config
  .command('remove-repo <name>')
  .description('Remove a repository')
  .action(async (name: string) => {
    const { removeRepoCommand } = await import('./commands/list-repos.js');
    removeRepoCommand(name);
  });

config
  .command('executor [type]')
  .description('Select code generation backend (kiro or codex)')
  .action(async (type?: string) => {
    const { executor } = await import('./commands/executor.js');
    await executor(type);
  });

config
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const cfg = loadConfig();
    if (cfg.repos.length === 0) {
      console.log('No configuration found. Run `vibesprint config add-repo` to set up.');
    } else {
      console.log(JSON.stringify(cfg, null, 2));
    }
  });

config
  .command('reset')
  .description('Reset configuration')
  .action(async () => {
    const { confirm } = await import('@inquirer/prompts');
    const yes = await confirm({ message: 'Delete configuration and start fresh?' });
    if (yes) {
      const { unlinkSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const path = join(homedir(), '.vibesprint', 'config.json');
      if (existsSync(path)) {
        unlinkSync(path);
        console.log('Configuration deleted.');
      } else {
        console.log('No configuration file found.');
      }
    }
  });

program
  .command('run')
  .description('Start monitoring and processing issues')
  .option('--dry-run', 'Show issues without processing')
  .option('--interval <seconds>', 'Polling interval in seconds')
  .option('-v, --verbose', 'Show detailed command output')
  .option('-e, --executor <type>', 'Code generation backend (kiro or codex)')
  .action(async (opts) => {
    // Prompt for missing config
    if (!isConfigComplete()) {
      console.log('📋 First-time setup required...\n');
      
      const { addRepoCommand } = await import('./commands/add-repo.js');
      await addRepoCommand();
      
      // Model selection
      const cfg = loadConfig();
      const model = await select({
        message: 'Select model for kiro-cli:',
        choices: AVAILABLE_MODELS.map(m => ({ value: m.value, name: m.name })),
        default: 'auto',
      });
      saveConfig({ ...cfg, model });
    }

    // Prompt for interval if not provided and not saved
    const cfg = loadConfig();
    let interval = opts.interval ? parseInt(opts.interval, 10) : cfg.interval;
    
    if (!interval) {
      const answer = await input({
        message: 'Polling interval in seconds:',
        default: '60',
      });
      interval = parseInt(answer, 10);
      saveConfig({ ...cfg, interval });
    }

    const { run } = await import('./run.js');
    await run({ dryRun: opts.dryRun, interval, verbose: opts.verbose, executor: opts.executor });
  });

program.parse();
