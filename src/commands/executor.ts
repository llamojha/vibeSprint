import { select } from '@inquirer/prompts';
import { loadConfig, saveConfig, AVAILABLE_MODELS, CODEX_MODELS } from '../config.js';
import { createExecutor, type ExecutorType } from '../executors/index.js';

export async function executor(preselected?: string): Promise<void> {
  const config = loadConfig();
  
  let executorType: ExecutorType;
  
  if (preselected === 'kiro' || preselected === 'codex') {
    executorType = preselected;
  } else {
    executorType = await select({
      message: 'Select code generation backend:',
      choices: [
        { value: 'kiro' as const, name: 'kiro (default) - Kiro CLI with Claude models' },
        { value: 'codex' as const, name: 'codex - OpenAI Codex CLI with GPT models' },
      ],
      default: config.executor || 'kiro',
    });
  }

  // Validate setup
  const exec = createExecutor(executorType);
  const validation = await exec.validateSetup();
  if (!validation.valid) {
    console.log(`\n⚠️  ${executorType} setup issues:`);
    validation.errors.forEach(e => console.log(`   - ${e}`));
    console.log('');
  }

  // Model selection based on executor
  const models = executorType === 'codex' ? CODEX_MODELS : AVAILABLE_MODELS;
  const currentModel = executorType === 'codex' ? config.codexModel : config.model;
  
  const model = await select({
    message: `Select default model for ${executorType}:`,
    choices: models.map(m => ({ value: m.value, name: m.name })),
    default: currentModel || models[0].value,
  });

  // Save config
  if (executorType === 'codex') {
    saveConfig({ ...config, executor: executorType, codexModel: model });
  } else {
    saveConfig({ ...config, executor: executorType, model });
  }

  console.log(`✓ Executor set to: ${executorType}`);
  console.log(`✓ Model set to: ${model}`);
}
