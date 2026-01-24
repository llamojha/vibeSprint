#!/usr/bin/env node
import { Command } from 'commander';
import { input } from '@inquirer/prompts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadConfig, saveConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
export const VERSION = pkg.version;

const program = new Command();

program
  .name('vibesprint')
  .description('GitHub-driven automation for issue-to-PR workflows')
  .version(VERSION);

// Default action - show menu
program
  .action(async () => {
    const { mainMenu } = await import('./commands/menu.js');
    const result = await mainMenu();
    
    if (result === 'quit') {
      process.exit(0);
    }
    
    // User selected Start - run dashboard
    const cfg = loadConfig();
    let interval = cfg.interval;
    if (!interval) {
      const answer = await input({
        message: 'Polling interval in seconds:',
        default: '60',
      });
      interval = parseInt(answer, 10);
      saveConfig({ ...cfg, interval });
    }

    const { runDashboard } = await import('./ui/dashboard.js');
    await runDashboard(interval);
  });

// Direct run command (skip menu)
program
  .command('run')
  .description('Start monitoring (skip menu)')
  .option('--dry-run', 'Show issues without processing')
  .option('--interval <seconds>', 'Polling interval in seconds')
  .option('-v, --verbose', 'Show detailed command output')
  .option('-e, --executor <type>', 'Code generation backend (kiro or codex)')
  .action(async (opts) => {
    const cfg = loadConfig();
    
    if (cfg.repos.length === 0) {
      console.log('No repos configured. Run vibesprint to set up.\n');
      process.exit(1);
    }

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

// Config subcommands for CLI usage
const config = program.command('config').description('Configure VibeSprint');

config
  .command('add-repo')
  .description('Add a repository')
  .option('--linear', 'Use Linear as issue source instead of GitHub Projects')
  .action(async (options: { linear?: boolean }) => {
    const { addRepoCommand } = await import('./commands/add-repo.js');
    await addRepoCommand(options);
  });

config
  .command('list')
  .description('List repositories')
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
  .command('show')
  .description('Show configuration')
  .action(() => {
    const cfg = loadConfig();
    console.log(JSON.stringify(cfg, null, 2));
  });

program.parse();
