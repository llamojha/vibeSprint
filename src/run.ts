import { randomUUID } from 'crypto';
import { loadConfig, validateConfig, type Config } from './config.js';
import { getIssuesInColumn, type Issue } from './intake.js';
import { buildContext, buildPlanContext, parsePRDescription, parsePlanOutput } from './context.js';
import { createExecutor, type ExecutorType, type Executor } from './executors/index.js';
import { createBranchAndPR } from './git.js';
import { addLabel, removeLabel, moveToInReview, moveToInProgress, postErrorComment, postPlanComment, createSubIssueInBacklog, ensureLabelsExist } from './status.js';

function isPlanIssue(issue: Issue): boolean {
  return issue.labels.some(l => l.toLowerCase() === 'plan');
}

function isNoCurate(issue: Issue): boolean {
  return issue.labels.some(l => l.toLowerCase() === 'no-curate');
}

interface RunOptions {
  dryRun?: boolean;
  interval: number;
  verbose?: boolean;
  executor?: ExecutorType;
}

async function processPlanIssue(config: Config, issue: Issue, runId: string, isRetry: boolean, executor: Executor, verbose?: boolean): Promise<void> {
  try {
    const context = await buildPlanContext(issue, executor.name as ExecutorType);
    console.log(`📝 Built plan context, invoking ${executor.name}...`);

    const model = executor.name === 'codex' ? config.codexModel : (issue.model || config.model);
    const result = await executor.execute(context, { model, verbose });

    if (!result.success) {
      console.error(`❌ ${executor.name} failed with exit code ${result.exitCode}`);
      await removeLabel(config, issue, 'running');
      
      if (isRetry) {
        await addLabel(config, issue, 'failed');
        console.log('🚫 Marked as failed (was already a retry)');
      } else {
        await addLabel(config, issue, 'retry');
        console.log('🔄 Marked for retry');
      }
      
      await postErrorComment(config, issue, runId, result.exitCode, result.stdout, result.stderr);
      return;
    }

    const tasks = parsePlanOutput(result.stdout);
    if (tasks.length === 0) {
      console.error('❌ No tasks found in plan output');
      await removeLabel(config, issue, 'running');
      
      if (isRetry) {
        await addLabel(config, issue, 'failed');
      } else {
        await addLabel(config, issue, 'retry');
      }
      
      await postErrorComment(config, issue, runId, 1, result.stdout, 'No tasks found in plan output');
      return;
    }

    console.log(`✅ Plan generated with ${tasks.length} task(s)`);

    const planMarkdown = tasks.map((t, i) => `## Task ${i + 1}: ${t.title}\n${t.body}`).join('\n\n');
    await postPlanComment(config, issue, planMarkdown, tasks.length);
    console.log('💬 Plan posted as comment');

    for (const task of tasks) {
      const subIssue = await createSubIssueInBacklog(config, issue, task.title, task.body);
      console.log(`  📌 Created sub-issue #${subIssue.number}: ${task.title}`);
    }

    await removeLabel(config, issue, 'running');
    await addLabel(config, issue, 'plan-posted');
    await moveToInProgress(config, issue);
    console.log('📋 Parent issue moved to In Progress');
  } catch (err) {
    console.error('❌ Error:', err);
    await removeLabel(config, issue, 'running');
    
    if (isRetry) {
      await addLabel(config, issue, 'failed');
    } else {
      await addLabel(config, issue, 'retry');
    }
    
    const errorMsg = err instanceof Error ? err.message : String(err);
    await postErrorComment(config, issue, runId, 1, '', errorMsg);
  }
}

async function processImplementIssue(config: Config, issue: Issue, runId: string, isRetry: boolean, executor: Executor, verbose?: boolean): Promise<void> {
  try {
    const skipCuration = isNoCurate(issue);
    const context = await buildContext(issue, skipCuration, executor.name as ExecutorType);
    console.log(`📝 Built context${skipCuration ? '' : ' (curated)'}, invoking ${executor.name}...`);

    const model = executor.name === 'codex' ? config.codexModel : (issue.model || config.model);
    const result = await executor.execute(context, { model, verbose });

    if (!result.success) {
      console.error(`❌ ${executor.name} failed with exit code ${result.exitCode}`);
      await removeLabel(config, issue, 'running');
      
      if (isRetry) {
        await addLabel(config, issue, 'failed');
        console.log('🚫 Marked as failed (was already a retry)');
      } else {
        await addLabel(config, issue, 'retry');
        console.log('🔄 Marked for retry');
      }
      
      await postErrorComment(config, issue, runId, result.exitCode, result.stdout, result.stderr);
      return;
    }

    console.log(`✅ ${executor.name} completed, creating PR...`);
    if (result.credits !== undefined) {
      console.log(`💳 Credits: ${result.credits} • Time: ${result.timeSeconds}s`);
    }
    if (result.tokensUsed !== undefined) {
      console.log(`🔢 Tokens: ${result.tokensUsed}`);
    }
    const prDescription = parsePRDescription(result.stdout);
    const prUrl = await createBranchAndPR(issue, prDescription, result.credits, result.timeSeconds);
    console.log(`🔗 PR created: ${prUrl}`);

    await removeLabel(config, issue, 'running');
    await addLabel(config, issue, 'pr-opened');
    await moveToInReview(config, issue);
    console.log('📋 Issue moved to In Review');
  } catch (err) {
    console.error('❌ Error:', err);
    await removeLabel(config, issue, 'running');
    
    if (isRetry) {
      await addLabel(config, issue, 'failed');
    } else {
      await addLabel(config, issue, 'retry');
    }
    
    const errorMsg = err instanceof Error ? err.message : String(err);
    await postErrorComment(config, issue, runId, 1, '', errorMsg);
  }
}

async function processIssue(config: Config, issue: Issue, isRetry: boolean, executor: Executor, verbose?: boolean): Promise<void> {
  const runId = randomUUID().slice(0, 8);
  const isPlan = isPlanIssue(issue);
  const noCurate = isNoCurate(issue);
  const tags = [
    isRetry ? 'retry' : '',
    isPlan ? 'plan' : '',
    noCurate ? 'no-curate' : 'curate',
  ].filter(Boolean).join(', ');
  console.log(`\n🚀 Processing issue #${issue.number}: ${issue.title} (run-id: ${runId}, ${tags}, executor: ${executor.name})`);

  if (isRetry) {
    await removeLabel(config, issue, 'retry');
  }
  await addLabel(config, issue, 'running');

  if (isPlan) {
    await processPlanIssue(config, issue, runId, isRetry, executor, verbose);
  } else {
    await processImplementIssue(config, issue, runId, isRetry, executor, verbose);
  }
}

export async function run(options: RunOptions): Promise<void> {
  // Validate config before starting
  const validation = validateConfig();
  if (!validation.valid) {
    console.error('❌ Configuration incomplete:\n');
    validation.errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }

  const config = loadConfig();
  
  // Create and validate executor
  const executorType = options.executor || config.executor || 'kiro';
  const executor = createExecutor(executorType);
  const execValidation = await executor.validateSetup();
  if (!execValidation.valid) {
    console.error(`❌ ${executor.name} setup issues:\n`);
    execValidation.errors.forEach(e => console.error(`  • ${e}`));
    process.exit(1);
  }

  console.log(`🔄 VibeSprint started (executor: ${executor.name}, interval: ${options.interval}s, dry-run: ${options.dryRun ?? false})`);

  // Check labels
  console.log('🏷️ Checking labels...');
  await ensureLabelsExist(config);

  const poll = async () => {
    const issues = await getIssuesInColumn();

    if (issues.length === 0) {
      console.log('📭 No issues to process');
      return;
    }

    const planCount = issues.filter(isPlanIssue).length;
    const implementCount = issues.length - planCount;
    const summary = [
      implementCount > 0 ? `${implementCount} implement` : '',
      planCount > 0 ? `${planCount} plan` : '',
    ].filter(Boolean).join(', ');
    console.log(`📬 Found ${issues.length} issue(s) to process [${summary}]`);

    if (options.dryRun) {
      issues.forEach(i => {
        const tags = [
          isPlanIssue(i) ? 'plan' : '',
          isNoCurate(i) ? 'no-curate' : 'curate',
        ].filter(Boolean).join(', ');
        console.log(`  - #${i.number}: ${i.title} [${tags}]`);
      });
      return;
    }

    const issue = issues[0];
    const isRetry = issue.labels.includes('retry');
    await processIssue(config, issue, isRetry, executor, options.verbose);
    
    await poll();
  };

  await poll();

  if (!options.dryRun) {
    const intervalId = setInterval(poll, options.interval * 1000);

    const shutdown = () => {
      console.log('\n🛑 Shutting down...');
      clearInterval(intervalId);
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
