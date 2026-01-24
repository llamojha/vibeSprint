import { select, input } from '@inquirer/prompts';
import { loadConfig, saveConfig, AVAILABLE_MODELS, CODEX_MODELS } from '../config.js';
import { addRepoCommand } from './add-repo.js';
import { isDaemonRunning, startDaemon, stopDaemon, tailLog } from '../daemon.js';
import { VERSION } from '../cli.js';

export async function mainMenu(): Promise<'dashboard' | 'quit'> {
  while (true) {
    const config = loadConfig();
    const repoCount = config.repos.length;
    const executor = config.executor || 'kiro';
    const model = config.model || 'auto';
    const daemonRunning = isDaemonRunning();

    console.clear();
    console.log(`VibeSprint v${VERSION}\n${'─'.repeat(20)}\n`);

    if (daemonRunning) {
      console.log('\x1b[32m● Daemon running in background\x1b[0m\n');
    }

    const choices = [
      { name: daemonRunning ? 'View Dashboard' : 'Start', value: 'start' },
      ...(daemonRunning ? [{ name: 'Stop Daemon', value: 'stop' }] : []),
      { name: `Repos (${repoCount} configured)`, value: 'repos' },
      { name: `Executor: ${executor}`, value: 'executor' },
      { name: `Model: ${model}`, value: 'model' },
      { name: 'Quit', value: 'quit' },
    ];

    const choice = await select({ message: 'What would you like to do?', choices });

    if (choice === 'quit') {
      return 'quit';
    }

    if (choice === 'start') {
      if (repoCount === 0) {
        console.log('\n⚠️  No repos configured. Add one first.\n');
        await addRepoCommand();
      } else {
        return 'dashboard';
      }
    }

    if (choice === 'stop') {
      if (stopDaemon()) {
        console.log('✓ Daemon stopped');
      } else {
        console.log('Failed to stop daemon');
      }
      await input({ message: 'Press enter to continue...' });
    }

    if (choice === 'repos') {
      await reposMenu();
    }

    if (choice === 'executor') {
      const newExecutor = await select({
        message: 'Select default executor:',
        choices: [
          { name: 'kiro', value: 'kiro' },
          { name: 'codex', value: 'codex' },
        ],
        default: executor,
      });
      const cfg = loadConfig();
      cfg.executor = newExecutor as 'kiro' | 'codex';
      cfg.model = newExecutor === 'codex' ? 'gpt-5.2-codex' : 'auto';
      cfg.codexModel = newExecutor === 'codex' ? 'gpt-5.2-codex' : undefined;
      saveConfig(cfg);
    }

    if (choice === 'model') {
      const currentExecutor = loadConfig().executor || 'kiro';
      const models = currentExecutor === 'codex' ? CODEX_MODELS : AVAILABLE_MODELS;
      const newModel = await select({
        message: 'Select default model:',
        choices: models.map(m => ({ name: m.name, value: m.value })),
        default: model,
      });
      saveConfig({ ...loadConfig(), model: newModel });
    }
  }
}

async function reposMenu(): Promise<void> {
  while (true) {
    const config = loadConfig();

    const choices = [
      { name: '+ Add new repo', value: 'add' },
      ...config.repos.map(r => ({ name: `${r.name} (${r.owner}/${r.repo})`, value: r.name })),
      { name: '← Back', value: 'back' },
    ];

    const choice = await select({
      message: 'Manage repositories:',
      choices,
    });

    if (choice === 'back') {
      return;
    }

    if (choice === 'add') {
      await addRepoCommand();
      continue;
    }

    await repoDetailMenu(choice);
  }
}

async function repoDetailMenu(repoName: string): Promise<void> {
  const config = loadConfig();
  const repo = config.repos.find(r => r.name === repoName);
  if (!repo) return;

  console.log(`\n${repo.name}`);
  console.log(`  Path: ${repo.path}`);
  console.log(`  Project: #${repo.projectNumber}`);
  console.log(`  Ready column: ${repo.columnName}\n`);

  const action = await select({
    message: 'Action:',
    choices: [
      { name: 'Remove', value: 'remove' },
      { name: '← Back', value: 'back' },
    ],
  });

  if (action === 'remove') {
    config.repos = config.repos.filter(r => r.name !== repoName);
    saveConfig(config);
    console.log(`✅ Removed ${repoName}`);
  }
}
