# Monitoring and Observability

## Overview

Ralph Orchestrator provides comprehensive monitoring capabilities to track execution, performance, and system health. This guide covers monitoring tools, metrics, and best practices.

## Built-in Monitoring

Ralph's monitoring system collects and routes execution data through multiple channels:

```
                           Metrics Collection Flow

                                                                        +--------------------+
                                                                   +--> | .agent/metrics/    |
                                                                   |    +--------------------+
+-----------------+     +------------------+     +---------------+ |    +--------------------+
|   Orchestrator  | --> | Iteration Events | --> |    Metrics    | +--> |   .agent/logs/     |
+-----------------+     +------------------+     |   Collector   | |    +--------------------+
                                                 +---------------+ |    +--------------------+
                                                                   +--> |     Console        |
                                                                        +--------------------+
```

<details>
<summary>graph-easy source</summary>

```
graph { label: "Metrics Collection Flow"; flow: east; }
[ Orchestrator ] -> [ Iteration Events ] -> [ Metrics Collector ]
[ Metrics Collector ] -> [ .agent/metrics/ ]
[ Metrics Collector ] -> [ .agent/logs/ ]
[ Metrics Collector ] -> [ Console ]
```

</details>

### State Files

Ralph automatically generates state files in `.agent/metrics/`:

```json
{
  "iterations": 15,
  "successfulIterations": 14,
  "failedIterations": 1,
  "errors": 1,
  "checkpoints": 3,
  "rollbacks": 0,
  "elapsedHours": 0.065,
  "successRate": 0.933
}
```

### Real-time Status

```bash
# Check current status via CLI
bun run cli status

# Output:
Ralph Orchestrator Status
=========================
Status: RUNNING
Current Iteration: 15
Runtime: 3m 54s
Agent: claude
Last Checkpoint: iteration 15
Errors: 0
```

### Execution Logs

#### Verbose Mode

```bash
# Enable detailed logging
bun run cli run --verbose

# Output includes:
# - Agent commands
# - Execution times
# - Output summaries
# - Error details
```

#### Log Levels

```typescript
import { createLogger } from './utils/logger.ts';

// Create logger for a component
const logger = createLogger('ralph-orchestrator.metrics');

// Log at different levels
logger.debug('Detailed debug information');
logger.info('General information');
logger.warn('Warning message');
logger.error('Error occurred');
```

## Metrics Collection

### MetricsTracker Class

```typescript
import { MetricsTracker } from './metrics/metrics.ts';

const metrics = new MetricsTracker();

// Record iterations
metrics.recordIteration(true);  // success
metrics.recordIteration(false); // failure

// Record events
metrics.recordCheckpoint();
metrics.recordRollback();
metrics.recordError();

// Get statistics
const successRate = metrics.getSuccessRate();
const elapsedHours = metrics.getElapsedHours();

// Export as JSON
const jsonData = metrics.toJson();
await Bun.write('.agent/metrics/state.json', jsonData);
```

### IterationStats Class

```typescript
import { IterationStats } from './metrics/iteration-stats.ts';

const iterationStats = new IterationStats(1000, 500); // maxIterations, outputPreviewLength

// Record iteration details
iterationStats.recordStart(iteration);
iterationStats.recordIteration({
  iteration,
  duration,
  success: true,
  error: '',
  triggerReason: 'PREVIOUS_SUCCESS',
  outputPreview: output.substring(0, 500),
  tokensUsed: 1500,
  cost: 0.015,
});

// Get summary
const summary = iterationStats.toSummary();
console.log(`Total: ${summary.total}, Success Rate: ${summary.successRate}%`);
```

### CostTracker Class

```typescript
import { CostTracker } from './metrics/cost-tracker.ts';

const costTracker = new CostTracker();

// Record API usage
costTracker.addUsage('claude', 1500, 500); // agent, inputTokens, outputTokens

// Get summary
const costs = costTracker.getSummary();
console.log(`Total Cost: $${costs.totalCost.toFixed(4)}`);
```

## Monitoring Tools

### 1. CLI Status Command

```bash
# Real-time status
bun run cli status

# With watch mode
watch -n 5 'bun run cli status'
```

### 2. Web Dashboard

Ralph TypeScript includes a built-in web dashboard:

```bash
# Start the web server
bun run web

# Access at http://localhost:3000
```

#### Dashboard API Endpoints

```typescript
// GET /api/status - Current orchestrator status
{
  "id": 1704067200000,
  "status": "running",
  "primaryTool": "claude",
  "promptFile": "PROMPT.md",
  "iteration": 15,
  "maxIterations": 100,
  "runtime": 234.5,
  "maxRuntime": 14400
}

// GET /api/metrics - Detailed metrics
{
  "iterations": 15,
  "successfulIterations": 14,
  "failedIterations": 1,
  "errors": 1,
  "checkpoints": 3,
  "rollbacks": 0,
  "elapsedHours": 0.065,
  "successRate": 0.933
}

// WebSocket /ws - Real-time updates
```

### 3. Git History Monitoring

```bash
# View checkpoint history
git log --oneline | grep "Ralph checkpoint"

# Analyze code changes over time
git diff --stat HEAD~10..HEAD

# Track file modifications
git log --follow -p PROMPT.md
```

### 4. System Resource Monitoring

```bash
# Monitor Bun process
htop -p $(pgrep -f "bun run")

# Track resource usage
pidstat -p $(pgrep -f ralph) 1

# Monitor file system changes
fswatch -r . | grep -v node_modules
```

## Dashboard Setup

### Terminal Dashboard

Create `scripts/monitor.sh`:

```bash
#!/bin/bash
# Ralph Monitoring Dashboard

while true; do
    clear
    echo "=== RALPH ORCHESTRATOR MONITOR ==="
    echo ""

    # Status via API
    curl -s http://localhost:3000/api/status | jq .
    echo ""

    # Recent errors
    echo "Recent Errors:"
    tail -n 5 .agent/logs/ralph.log 2>/dev/null | grep ERROR || echo "No errors"
    echo ""

    # Resource usage
    echo "Resource Usage:"
    ps aux | grep "bun run" | grep -v grep
    echo ""

    # Latest checkpoint
    echo "Latest Checkpoint:"
    ls -lt .agent/checkpoints/ 2>/dev/null | head -2

    sleep 5
done
```

### Web Dashboard Implementation

```typescript
// src/web/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();
app.use('/*', cors());

// Status endpoint
app.get('/api/status', async (c) => {
  const state = orchestrator.getState();
  return c.json(state);
});

// Metrics endpoint
app.get('/api/metrics', async (c) => {
  const metrics = orchestrator.getMetrics();
  return c.json(metrics);
});

// Iteration stats endpoint
app.get('/api/iterations', async (c) => {
  const stats = orchestrator.getIterationStats();
  return c.json(stats);
});

// Cost summary endpoint
app.get('/api/costs', async (c) => {
  const costs = orchestrator.getCostSummary();
  return c.json(costs);
});

// WebSocket for real-time updates
app.get('/ws', upgradeWebSocket((c) => ({
  onOpen(event, ws) {
    // Send initial state
    ws.send(JSON.stringify(orchestrator.getState()));
  },
  onMessage(event, ws) {
    // Handle client messages
  },
})));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

## Alerting

### Error Detection

```typescript
async function checkErrors(): Promise<void> {
  const metricsFile = Bun.file('.agent/metrics/state.json');

  if (await metricsFile.exists()) {
    const state = await metricsFile.json();

    if (state.errors > 0) {
      await sendAlert(`Ralph encountered ${state.errors} errors`);
    }

    if (state.iterations > 100) {
      await sendAlert('Ralph exceeded 100 iterations');
    }

    if (state.elapsedHours > 4) {
      await sendAlert('Ralph runtime exceeded 4 hours');
    }
  }
}
```

### Notification Methods

```typescript
// Desktop notification (macOS)
async function notifyDesktop(title: string, message: string): Promise<void> {
  await Bun.spawn([
    'osascript',
    '-e',
    `display notification "${message}" with title "${title}"`,
  ]).exited;
}

// Slack webhook
async function notifySlack(message: string, webhookUrl: string): Promise<void> {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

// Generic alert dispatcher
async function sendAlert(message: string): Promise<void> {
  console.warn(`ALERT: ${message}`);

  if (process.env.SLACK_WEBHOOK_URL) {
    await notifySlack(message, process.env.SLACK_WEBHOOK_URL);
  }

  if (process.platform === 'darwin') {
    await notifyDesktop('Ralph Alert', message);
  }
}
```

## Performance Analysis

### Iteration Analysis

```typescript
import { Glob } from 'bun';

interface IterationMetric {
  iteration: number;
  duration: number;
  success: boolean;
  cost: number;
}

async function analyzeIterations(): Promise<void> {
  const glob = new Glob('.agent/metrics/iteration_*.json');
  const metrics: IterationMetric[] = [];

  for await (const file of glob.scan('.')) {
    const data = await Bun.file(file).json();
    metrics.push(data);
  }

  // Calculate statistics
  const totalIterations = metrics.length;
  const successfulIterations = metrics.filter((m) => m.success).length;
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const averageDuration = totalDuration / totalIterations;
  const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);

  console.log(`Total iterations: ${totalIterations}`);
  console.log(`Success rate: ${((successfulIterations / totalIterations) * 100).toFixed(1)}%`);
  console.log(`Average iteration time: ${averageDuration.toFixed(2)}s`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
}
```

### Cost Tracking

```typescript
// Agent cost rates (per 1K tokens)
const AGENT_COSTS = {
  claude: { input: 0.003, output: 0.015 },
  gemini: { input: 0.0001, output: 0.0002 },
  q: { input: 0, output: 0 }, // Free tier
} as const;

function calculateCost(
  agent: keyof typeof AGENT_COSTS,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = AGENT_COSTS[agent];
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}
```

## Log Management

### Log Rotation

```typescript
import { mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function rotateLog(logFile: string, maxSizeBytes: number = 10 * 1024 * 1024): Promise<void> {
  const file = Bun.file(logFile);

  if (await file.exists()) {
    const fileStats = await stat(logFile);

    if (fileStats.size > maxSizeBytes) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = logFile.replace('.log', `_${timestamp}.log`);

      await Bun.write(backupFile, await file.text());
      await Bun.write(logFile, ''); // Clear original

      console.log(`Rotated log to ${backupFile}`);
    }
  }
}
```

### Log Aggregation

```bash
# Combine all logs
cat .agent/logs/*.log > combined.log

# Filter by date
grep "2025-01-01" .agent/logs/*.log

# Extract errors only
grep -E "ERROR|CRITICAL" .agent/logs/*.log > errors.log
```

### Log Analysis

```bash
# Count errors by type
grep ERROR .agent/logs/*.log | cut -d: -f4 | sort | uniq -c

# Find longest running iterations
grep "Iteration .* completed" .agent/logs/*.log | \
    awk '{print $NF}' | sort -rn | head -10

# Agent usage statistics
grep "Using adapter:" .agent/logs/*.log | \
    cut -d: -f4 | sort | uniq -c
```

## Health Checks

### Automated Health Checks

```typescript
import { exists } from 'node:fs/promises';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'warning';
  checks: string[];
}

async function healthCheck(): Promise<HealthCheckResult> {
  const health: HealthCheckResult = {
    status: 'healthy',
    checks: [],
  };

  // Check prompt file exists
  if (!(await Bun.file('PROMPT.md').exists())) {
    health.status = 'unhealthy';
    health.checks.push('PROMPT.md missing');
  }

  // Check agent availability
  for (const agent of ['claude', 'q', 'gemini']) {
    try {
      const proc = Bun.spawn(['which', agent], { stdout: 'pipe' });
      await proc.exited;
      if (proc.exitCode === 0) {
        health.checks.push(`${agent}: available`);
      } else {
        health.checks.push(`${agent}: not found`);
      }
    } catch {
      health.checks.push(`${agent}: not found`);
    }
  }

  // Check disk space
  const si = await import('systeminformation');
  const disk = await si.fsSize();
  const mainDisk = disk[0];
  if (mainDisk && mainDisk.available < 1024 * 1024 * 1024) {
    // Less than 1GB
    health.status = 'warning';
    health.checks.push(`Low disk space: ${(mainDisk.available / 1024 / 1024 / 1024).toFixed(2)}GB`);
  }

  // Check Git status
  const gitProc = Bun.spawn(['git', 'status', '--porcelain'], {
    stdout: 'pipe',
  });
  const gitOutput = await new Response(gitProc.stdout).text();
  if (gitOutput.trim()) {
    health.checks.push('Uncommitted changes present');
  }

  return health;
}
```

## Troubleshooting with Monitoring

### Common Issues

| Symptom              | Check                         | Solution                         |
| -------------------- | ----------------------------- | -------------------------------- |
| High iteration count | `.agent/metrics/state.json`   | Review prompt clarity            |
| Slow performance     | Iteration times in logs       | Check agent response times       |
| Memory issues        | System monitor                | Increase limits or restart       |
| Repeated errors      | Error patterns in logs        | Fix underlying issue             |
| No progress          | Git diff output               | Check if agent is making changes |

### Debug Mode

```bash
# Maximum verbosity
RALPH_DEBUG=1 bun run cli run --verbose

# Profile performance
bun run --inspect src/cli.ts run

# Memory debugging
bun run --smol src/cli.ts run  # Optimized memory mode
```

## Best Practices

1. **Regular Monitoring**
   - Check status every 10-15 minutes
   - Review logs for anomalies
   - Monitor resource usage

2. **Metric Retention**
   - Archive old metrics weekly
   - Compress logs monthly
   - Maintain 30-day history

3. **Alert Fatigue**
   - Set reasonable thresholds
   - Group related alerts
   - Prioritize critical issues

4. **Documentation**
   - Document custom metrics
   - Track performance baselines
   - Note configuration changes
