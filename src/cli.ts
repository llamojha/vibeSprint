#!/usr/bin/env node
import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import { loadConfig, saveConfig, isConfigComplete, AVAILABLE_MODELS } from './config.js';

const program = new Command();

program
  .name('vibesprint')
  .description('GitHub-driven automation for issue-to-PR workflows')
  .version('0.1.0');

const config = program.command('config').description('Configure VibeSprint settings');

config
  .command('link')
  .description('Link to a GitHub Project')
  .action(async () => {
    const { link } = await import('./commands/link.js');
    await link();
  });

config
  .command('column')
  .description('Select column to monitor')
  .action(async () => {
    const { column } = await import('./commands/column.js');
    await column();
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
    if (Object.keys(cfg).length === 0) {
      console.log('No configuration found. Run `vibesprint config link` to set up.');
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
      const path = '.vibesprint';
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
      
      const { link } = await import('./commands/link.js');
      await link();
      
      const { column } = await import('./commands/column.js');
      await column();
      
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
