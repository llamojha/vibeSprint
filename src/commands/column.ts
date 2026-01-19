import { select } from '@inquirer/prompts';
import { graphql } from '@octokit/graphql';
import { loadConfig, saveConfig, getToken } from '../config.js';

interface FieldOption {
  id: string;
  name: string;
}

interface StatusField {
  id: string;
  name: string;
  options: FieldOption[];
}

async function selectColumn(
  options: FieldOption[],
  message: string,
  defaultName: string,
  exclude: string[] = []
): Promise<string> {
  const available = options.filter(o => !exclude.includes(o.id));
  const defaultOption = available.find(o => o.name === defaultName);
  
  return select({
    message: `${message} [${defaultName}]:`,
    choices: available.map(o => ({ name: o.name, value: o.id })),
    default: defaultOption?.id,
  });
}

export async function column(): Promise<void> {
  const token = getToken();
  const config = loadConfig();

  if (!config.projectId) {
    console.error('Error: No project linked. Run `vibesprint config link` first.');
    process.exit(1);
  }

  const gql = graphql.defaults({ headers: { authorization: `token ${token}` } });

  const { node } = await gql<{ node: { fields: { nodes: StatusField[] } } }>(`
    query($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 50) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id name options { id name }
              }
            }
          }
        }
      }
    }
  `, { projectId: config.projectId });

  const statusField = node.fields.nodes.find(f => f.name === 'Status' && f.options);
  if (!statusField) {
    console.error('Error: No Status field found in project.');
    process.exit(1);
  }

  if (statusField.options.length < 4) {
    console.error('Error: Project needs at least 4 status columns (Backlog, Ready, In Progress, In Review).');
    process.exit(1);
  }

  const opts = statusField.options;

  const backlogOptionId = await selectColumn(opts, 'Select Backlog column (sub-issues placed here)', 'Backlog');
  const columnOptionId = await selectColumn(opts, 'Select Ready column (issues picked up from here)', 'Ready', [backlogOptionId]);
  const inProgressOptionId = await selectColumn(opts, 'Select In Progress column (parent moves here after plan)', 'In Progress', [backlogOptionId, columnOptionId]);
  const inReviewOptionId = await selectColumn(opts, 'Select In Review column (issues move here after PR)', 'In Review', [backlogOptionId, columnOptionId, inProgressOptionId]);

  const selectedColumn = opts.find(o => o.id === columnOptionId)!;
  saveConfig({
    ...config,
    columnFieldId: statusField.id,
    columnOptionId,
    columnName: selectedColumn.name,
    backlogOptionId,
    inProgressOptionId,
    inReviewOptionId,
  });

  console.log(`✅ Columns configured:`);
  console.log(`   Backlog: ${opts.find(o => o.id === backlogOptionId)?.name}`);
  console.log(`   Ready (monitored): ${selectedColumn.name}`);
  console.log(`   In Progress: ${opts.find(o => o.id === inProgressOptionId)?.name}`);
  console.log(`   In Review: ${opts.find(o => o.id === inReviewOptionId)?.name}`);
}
