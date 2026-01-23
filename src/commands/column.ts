import { select } from '@inquirer/prompts';
import { spawnSync } from 'child_process';
import { loadConfig, saveConfig } from '../config.js';

interface FieldOption {
  id: string;
  name: string;
}

interface Field {
  id: string;
  name: string;
  type: string;
  options?: FieldOption[];
}

async function selectColumn(
  options: FieldOption[],
  message: string,
  defaultName: string,
  exclude: string[] = []
): Promise<{ id: string; name: string }> {
  const available = options.filter(o => !exclude.includes(o.id));
  const defaultOption = available.find(o => o.name === defaultName);
  
  const id = await select({
    message: `${message} [${defaultName}]:`,
    choices: available.map(o => ({ name: o.name, value: o.id })),
    default: defaultOption?.id,
  });
  
  const selected = available.find(o => o.id === id)!;
  return { id, name: selected.name };
}

export async function column(): Promise<void> {
  const config = loadConfig();

  if (!config.projectNumber) {
    console.error('Error: No project linked. Run `vibesprint config link` first.');
    process.exit(1);
  }

  // Get project fields using gh project field-list
  const result = spawnSync('gh', [
    'project', 'field-list', String(config.projectNumber),
    '--owner', config.owner!,
    '--format', 'json',
  ], { encoding: 'utf-8' });

  if (result.status !== 0) {
    console.error('Failed to list fields:', result.stderr);
    process.exit(1);
  }

  let fields: Field[];
  try {
    const parsed = JSON.parse(result.stdout);
    fields = parsed.fields || parsed;
  } catch {
    console.error('Failed to parse fields response');
    process.exit(1);
  }

  const statusField = fields.find(f => f.name === 'Status' && f.type === 'ProjectV2SingleSelectField');
  if (!statusField || !statusField.options) {
    console.error('Error: No Status field found in project.');
    process.exit(1);
  }

  if (statusField.options.length < 4) {
    console.error('Error: Project needs at least 4 status columns (Backlog, Ready, In Progress, In Review).');
    process.exit(1);
  }

  const opts = statusField.options;

  const backlog = await selectColumn(opts, 'Select Backlog column (sub-issues placed here)', 'Backlog');
  const ready = await selectColumn(opts, 'Select Ready column (issues picked up from here)', 'Ready', [backlog.id]);
  const inProgress = await selectColumn(opts, 'Select In Progress column (parent moves here after plan)', 'In Progress', [backlog.id, ready.id]);
  const inReview = await selectColumn(opts, 'Select In Review column (issues move here after PR)', 'In Review', [backlog.id, ready.id, inProgress.id]);

  saveConfig({
    ...config,
    columnFieldId: statusField.id,
    columnOptionId: ready.id,
    columnName: ready.name,
    backlogOptionId: backlog.id,
    backlogColumnName: backlog.name,
    inProgressOptionId: inProgress.id,
    inProgressColumnName: inProgress.name,
    inReviewOptionId: inReview.id,
    inReviewColumnName: inReview.name,
  });

  console.log(`✅ Columns configured:`);
  console.log(`   Backlog: ${backlog.name}`);
  console.log(`   Ready (monitored): ${ready.name}`);
  console.log(`   In Progress: ${inProgress.name}`);
  console.log(`   In Review: ${inReview.name}`);
}
