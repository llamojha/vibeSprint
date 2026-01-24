import { select, input } from '@inquirer/prompts';
import { loadConfig, saveConfig, AVAILABLE_MODELS, CODEX_MODELS } from '../config.js';
import { addRepoCommand } from './add-repo.js';
import { VERSION } from '../cli.js';

export async function mainMenu(): Promise<void> {
  while (true) {
    const config = loadConfig();
    const repoCount = config.repos.length;
    const executor = config.executor || 'kiro';
    const model = config.model || 'auto';

    console.clear();
    console.log(`VibeSprint v${VERSION}\n${'─'.repeat(20)}\n`);

    const choice = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Start', value: 'start' },
        { name: `Repos (${repoCount} configured)`, value: 'repos' },
        { name: `Executor: ${executor}`, value: 'executor' },
        { name: `Model: ${model}`, value: 'model' },
        { name: 'Quit', value: 'quit' },
      ],
    });

    if (choice === 'quit') {
      break;
    }

    if (choice === 'start') {
      if (repoCount === 0) {
        console.log('\n⚠️  No repos configured. Add one first.\n');
        await addRepoCommand();
      } else {
        return; // Exit menu, cli.ts will call run()
      }
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
      // Reset model to default for new executor
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

  process.exit(0);
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

    // Selected existing repo
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
