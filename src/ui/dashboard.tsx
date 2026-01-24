import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { loadConfig, saveConfig, type RepoConfig, type Config } from '../config.js';
import { createProvider } from '../providers/index.js';
import { createExecutor, type ExecutorType } from '../executors/index.js';
import { buildContext, buildPlanContext, parsePRDescription, parsePlanOutput } from '../context.js';
import { createBranchAndPR } from '../git.js';
import { addLabel, removeLabel, moveToInReview, moveToInProgress, postErrorComment, postPlanComment, createSubIssueInBacklog } from '../status.js';
import { startIssueLog, appendIssueLog, readIssueLog } from '../issue-logs.js';
import type { Issue } from '../providers/types.js';
import { VERSION } from '../cli.js';
import { randomUUID } from 'crypto';

interface RepoStatus {
  name: string;
  issueCount: number;
  status: 'idle' | 'polling' | 'processing';
  currentIssue?: string;
}

interface ActivityItem {
  time: Date;
  icon: string;
  text: string;
  repoName: string;
  issueNumber: number;
}

interface DashboardProps {
  config: Config;
  interval: number;
  verbose?: boolean;
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function Dashboard({ config, interval, verbose }: DashboardProps) {
  const { exit } = useApp();
  const [repoStatuses, setRepoStatuses] = useState<RepoStatus[]>(
    config.repos.map(r => ({ name: r.name, issueCount: 0, status: 'idle' }))
  );
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [selectedActivity, setSelectedActivity] = useState(0);
  const [viewingLog, setViewingLog] = useState<{ repoName: string; issueNumber: number } | null>(null);
  const [logContent, setLogContent] = useState('');

  const addActivity = (icon: string, text: string, repoName: string, issueNumber: number) => {
    setActivity(prev => [{ time: new Date(), icon, text, repoName, issueNumber }, ...prev].slice(0, 20));
  };

  const updateRepoStatus = (repoName: string, updates: Partial<RepoStatus>) => {
    setRepoStatuses(prev => prev.map(r => r.name === repoName ? { ...r, ...updates } : r));
  };

  const processIssue = async (cfg: Config, issue: Issue) => {
    const runId = randomUUID().slice(0, 8);
    const isPlan = issue.labels.some(l => l.toLowerCase() === 'plan');
    const executorType = issue.executor || cfg.executor || 'kiro';
    const executor = createExecutor(executorType);
    const repoName = issue.repoConfig?.name || 'unknown';

    updateRepoStatus(repoName, { status: 'processing', currentIssue: `#${issue.number} ${issue.title.slice(0, 30)}...` });
    startIssueLog(repoName, issue.number, issue.title);

    const onOutput = (text: string) => appendIssueLog(repoName, issue.number, text);

    try {
      await addLabel(issue, 'running');

      if (isPlan) {
        const context = await buildPlanContext(issue, executorType);
        const model = executorType === 'codex' ? cfg.codexModel : (issue.model || cfg.model);
        const result = await executor.execute(context, { model, verbose, cwd: issue.repoConfig?.path, onOutput });

        if (!result.success) {
          await removeLabel(issue, 'running');
          await addLabel(issue, 'retry');
          await postErrorComment(issue, runId, result.exitCode, result.stdout, result.stderr);
          addActivity('✗', `#${issue.number} → failed`, repoName, issue.number);
          return;
        }

        const tasks = parsePlanOutput(result.stdout);
        if (tasks.length > 0) {
          const planMarkdown = tasks.map((t, i) => `## Task ${i + 1}: ${t.title}\n${t.body}`).join('\n\n');
          await postPlanComment(issue, planMarkdown, tasks.length);
          for (const task of tasks) {
            await createSubIssueInBacklog(issue, task.title, task.body);
          }
          await removeLabel(issue, 'running');
          await addLabel(issue, 'plan-posted');
          await moveToInProgress(issue);
          addActivity('✓', `#${issue.number} → plan (${tasks.length} tasks)`, repoName, issue.number);
        }
      } else {
        const skipCuration = issue.labels.some(l => l.toLowerCase() === 'no-curate');
        const context = await buildContext(issue, skipCuration, executorType);
        const model = executorType === 'codex' ? cfg.codexModel : (issue.model || cfg.model);
        const result = await executor.execute(context, { model, verbose, cwd: issue.repoConfig?.path, onOutput });

        if (!result.success) {
          await removeLabel(issue, 'running');
          await addLabel(issue, 'retry');
          await postErrorComment(issue, runId, result.exitCode, result.stdout, result.stderr);
          addActivity('✗', `#${issue.number} → failed`, repoName, issue.number);
          return;
        }

        const prDescription = parsePRDescription(result.stdout);
        const prUrl = await createBranchAndPR(issue, prDescription, result.credits, result.timeSeconds);
        const prNum = prUrl.match(/\/pull\/(\d+)/)?.[1] || '?';

        await removeLabel(issue, 'running');
        await addLabel(issue, 'pr-opened');
        await moveToInReview(issue);
        addActivity('✓', `#${issue.number} → PR #${prNum}`, repoName, issue.number);
      }
    } catch (err) {
      await removeLabel(issue, 'running');
      await addLabel(issue, 'retry');
      const errorMsg = err instanceof Error ? err.message : String(err);
      await postErrorComment(issue, runId, 1, '', errorMsg);
      addActivity('✗', `#${issue.number} → error`, repoName, issue.number);
    } finally {
      updateRepoStatus(repoName, { status: 'idle', currentIssue: undefined });
    }
  };

  const poll = async () => {
    const cfg = loadConfig();
    let allIssues: Issue[] = [];

    for (let i = 0; i < cfg.repos.length; i++) {
      const repo = cfg.repos[i];
      setRepoStatuses(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'polling' } : r));

      const provider = createProvider(repo);
      const issues = await provider.getIssues();

      setRepoStatuses(prev => prev.map((r, idx) =>
        idx === i ? { ...r, issueCount: issues.length, status: 'idle' } : r
      ));

      allIssues.push(...issues);
    }

    if (allIssues.length > 0) {
      const issue = allIssues[0];
      const repoIdx = cfg.repos.findIndex(r => r.name === issue.repoConfig?.name);
      if (repoIdx >= 0) {
        setRepoStatuses(prev => prev.map((r, idx) =>
          idx === repoIdx ? { ...r, status: 'processing' } : r
        ));
      }
      await processIssue(cfg, issue);
      setRepoStatuses(prev => prev.map(r => ({ ...r, status: 'idle' })));
    }
  };

  const [currentInterval, setCurrentInterval] = useState(interval);
  const [detaching, setDetaching] = useState(false);

  useEffect(() => {
    poll();
    const id = setInterval(poll, currentInterval * 1000);
    return () => clearInterval(id);
  }, [currentInterval]);

  useInput(async (input, key) => {
    if (viewingLog) {
      if (input === 'q' || key.escape) setViewingLog(null);
      return;
    }
    if (input === 'q') exit();
    if (input === 'd' && !detaching) {
      setDetaching(true);
      const { startDaemon } = await import('../daemon.js');
      startDaemon(currentInterval);
      process.exit(0);
    }
    if (input === '+' || input === '=') setCurrentInterval(prev => Math.min(300, prev + 10));
    if (input === '-') setCurrentInterval(prev => Math.max(10, prev - 10));
    if (key.upArrow) setSelectedActivity(prev => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedActivity(prev => Math.min(activity.length - 1, prev + 1));
    if (key.return && activity[selectedActivity]) {
      const item = activity[selectedActivity];
      setLogContent(readIssueLog(item.repoName, item.issueNumber));
      setViewingLog({ repoName: item.repoName, issueNumber: item.issueNumber });
    }
  });

  const statusIcon = (s: RepoStatus['status']) => {
    if (s === 'polling') return '◐';
    if (s === 'processing') return '●';
    return '○';
  };

  const statusColor = (s: RepoStatus['status']) => {
    if (s === 'polling') return 'yellow';
    if (s === 'processing') return 'green';
    return 'gray';
  };

  const truncate = (s: string, len: number) => s.length > len ? s.slice(0, len - 1) + '…' : s;

  if (viewingLog) {
    const lines = logContent.split('\n');
    const displayLines = lines.slice(-30);
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Log: {viewingLog.repoName} #{viewingLog.issueNumber}</Text>
        <Text dimColor>Press q to return</Text>
        <Box marginTop={1} flexDirection="column">
          {displayLines.map((line, i) => <Text key={i}>{line}</Text>)}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>VibeSprint v{VERSION}</Text>
      <Text>{'═'.repeat(50)}</Text>
      <Text> </Text>

      <Text bold>Repos ({config.repos.length})</Text>
      <Text>{'─'.repeat(30)}</Text>
      {repoStatuses.map((r) => (
        <Box key={r.name} flexDirection="column">
          <Text>
            <Text color={statusColor(r.status)}>{statusIcon(r.status)} </Text>
            <Text>{r.name}</Text>
            <Text color="gray"> ({r.issueCount} ready)</Text>
          </Text>
          {r.currentIssue && (
            <Text color="green">  └─ {truncate(r.currentIssue, 45)}</Text>
          )}
        </Box>
      ))}

      <Text> </Text>
      <Text bold>Recent Activity</Text>
      <Text>{'─'.repeat(50)}</Text>
      {activity.length === 0 && <Text color="gray">No activity yet</Text>}
      {activity.map((a, i) => (
        <Text key={i}>
          <Text color={i === selectedActivity ? 'cyan' : undefined}>
            {i === selectedActivity ? '▸ ' : '  '}
          </Text>
          <Text>{a.icon} </Text>
          <Text>{a.text}</Text>
          <Text color="gray"> ({formatTime(a.time)})</Text>
        </Text>
      ))}

      <Text> </Text>
      <Text color="gray">[q] Quit  [d] Detach  [↑↓] Select  [Enter] Log  [+/-] Interval ({currentInterval}s)</Text>
    </Box>
  );
}

export async function runDashboard(interval: number, verbose?: boolean): Promise<void> {
  const config = loadConfig();

  if (config.repos.length === 0) {
    console.log('No repos configured. Run vibesprint to set up.');
    process.exit(1);
  }

  // Check labels only for repos that haven't been checked
  const uncheckedRepos = config.repos.filter(r => !r.labelsChecked);
  if (uncheckedRepos.length > 0) {
    console.log('🏷️  Checking labels...');
    for (const repo of uncheckedRepos) {
      process.stdout.write(`   ${repo.name}...`);
      const provider = createProvider(repo);
      await provider.ensureLabelsExist();
      repo.labelsChecked = true;
      console.log(' ✓');
    }
    saveConfig(config);
    console.clear();
  }

  render(<Dashboard config={config} interval={interval} verbose={verbose} />);
}
