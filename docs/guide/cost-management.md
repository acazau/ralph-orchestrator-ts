# Cost Management Guide

Effective cost management is crucial when running AI orchestration at scale. This guide helps you optimize spending while maintaining task quality.

## Understanding Costs

### Token Pricing

Current pricing per million tokens:

| Agent | Input Cost | Output Cost | Avg Cost/Task |
|-------|------------|-------------|---------------|
| **Claude** | $3.00 | $15.00 | $5-50 |
| **Q Chat** | $0.50 | $1.50 | $1-10 |
| **Gemini** | $0.50 | $1.50 | $1-10 |

### Cost Calculation

```typescript
const totalCost =
  (inputTokens / 1_000_000) * inputPrice +
  (outputTokens / 1_000_000) * outputPrice;
```

**Example:**
- Task uses 100K input tokens, 50K output tokens
- With Claude: (0.1 x $3) + (0.05 x $15) = $1.05
- With Q Chat: (0.1 x $0.50) + (0.05 x $1.50) = $0.125

## Cost Control Mechanisms

### 1. Hard Limits

Set maximum spending caps:

```bash
# Strict $10 limit
bun run src/cli.ts --max-cost 10.0

# Conservative token limit
bun run src/cli.ts --max-tokens 100000
```

### 2. Context Management

Reduce token usage through smart context handling:

```bash
# Aggressive context management
bun run src/cli.ts \
  --context-window 50000 \
  --context-threshold 0.6  # Summarize at 60% full
```

### 3. Agent Selection

Choose cost-effective agents:

```bash
# Development: Use cheaper agents
bun run src/cli.ts --agent q --max-cost 5.0

# Production: Use quality agents with limits
bun run src/cli.ts --agent claude --max-cost 50.0
```

## Optimization Strategies

### 1. Tiered Agent Strategy

Use different agents for different task phases:

```bash
# Phase 1: Research with Q (cheap)
echo "Research the problem" > research.md
bun run src/cli.ts --agent q --prompt research.md --max-cost 2.0

# Phase 2: Implementation with Claude (quality)
echo "Implement the solution" > implement.md
bun run src/cli.ts --agent claude --prompt implement.md --max-cost 20.0

# Phase 3: Testing with Q (cheap)
echo "Test the solution" > test.md
bun run src/cli.ts --agent q --prompt test.md --max-cost 2.0
```

### 2. Prompt Optimization

Reduce token usage through efficient prompts:

#### Before (Expensive)
```markdown
Please create a comprehensive web application with the following features:
- User authentication system with registration, login, password reset
- Dashboard with charts and graphs
- API with full CRUD operations
- Complete test suite
- Detailed documentation
[... 5000 tokens of requirements ...]
```

#### After (Optimized)
```markdown
Build user auth API:
- Register/login endpoints
- JWT tokens
- SQLite storage
- Basic tests
See spec.md for details.
```

### 3. Context Window Management

#### Automatic Summarization

```bash
# Trigger summarization early to save tokens
bun run src/cli.ts \
  --context-window 100000 \
  --context-threshold 0.5  # Summarize at 50%
```

#### Manual Context Control

```markdown
## Context Management
When context reaches 50%, summarize:
- Keep only essential information
- Remove completed task details
- Compress verbose outputs
```

### 4. Iteration Optimization

Fewer, smarter iterations save money:

```bash
# Many quick iterations (expensive)
bun run src/cli.ts --max-iterations 100  # Not recommended

# Fewer, focused iterations (economical)
bun run src/cli.ts --max-iterations 20   # Better
```

## Cost Monitoring

### Real-time Tracking

Monitor costs during execution:

```bash
# Verbose cost reporting
bun run src/cli.ts \
  --verbose \
  --metrics-interval 1
```

**Output:**
```
[INFO] Iteration 5: Tokens: 25,000 | Cost: $1.25 | Remaining: $48.75
```

### Cost Reports

Access detailed cost breakdowns:

```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface MetricsFile {
  cost: number;
  tokensUsed: number;
  iteration: number;
}

async function calculateTotalCost(): Promise<number> {
  const metricsDir = '.agent/metrics';
  const files = await readdir(metricsDir);
  let totalCost = 0;

  for (const file of files) {
    if (file.startsWith('metrics_') && file.endsWith('.json')) {
      const content = await readFile(join(metricsDir, file), 'utf-8');
      const data: MetricsFile = JSON.parse(content);
      totalCost += data.cost ?? 0;
    }
  }

  return totalCost;
}

const total = await calculateTotalCost();
console.log(`Total cost: $${total.toFixed(2)}`);
```

### Cost Dashboards

Create monitoring dashboards:

```typescript
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface MetricsData {
  totalCost: number;
  iteration: number;
}

async function generateCostReport(): Promise<void> {
  const metricsDir = '.agent/metrics';
  const files = await readdir(metricsDir);
  const data: MetricsData[] = [];

  for (const file of files.sort()) {
    if (file.endsWith('.json')) {
      const content = await readFile(join(metricsDir, file), 'utf-8');
      const parsed = JSON.parse(content);
      data.push({
        totalCost: parsed.totalCost ?? 0,
        iteration: parsed.iteration ?? 0,
      });
    }
  }

  console.log('Iteration | Cumulative Cost');
  console.log('-'.repeat(30));
  for (const entry of data) {
    console.log(`${entry.iteration.toString().padStart(9)} | $${entry.totalCost.toFixed(2)}`);
  }
}

await generateCostReport();
```

## Budget Planning

### Task Cost Estimation

| Task Type | Complexity | Recommended Budget | Agent |
|-----------|------------|-------------------|--------|
| Simple Script | Low | $0.50 - $2 | Q Chat |
| Web API | Medium | $5 - $20 | Gemini/Claude |
| Full Application | High | $20 - $100 | Claude |
| Data Analysis | Medium | $5 - $15 | Gemini |
| Documentation | Low-Medium | $2 - $10 | Q/Claude |
| Debugging | Variable | $5 - $50 | Claude |

### Monthly Budget Planning

```typescript
// Calculate monthly budget needs
const tasksPerMonth = 50;
const avgCostPerTask = 10.0;
const safetyMargin = 1.5;

const monthlyBudget = tasksPerMonth * avgCostPerTask * safetyMargin;
console.log(`Recommended monthly budget: $${monthlyBudget}`);
```

## Cost Optimization Profiles

### Minimal Cost Profile

Maximum savings, acceptable quality:

```bash
bun run src/cli.ts \
  --agent q \
  --max-tokens 50000 \
  --max-cost 2.0 \
  --context-window 30000 \
  --context-threshold 0.5 \
  --checkpoint-interval 10
```

### Balanced Profile

Good quality, reasonable cost:

```bash
bun run src/cli.ts \
  --agent gemini \
  --max-tokens 200000 \
  --max-cost 10.0 \
  --context-window 100000 \
  --context-threshold 0.7 \
  --checkpoint-interval 5
```

### Quality Profile

Best results, controlled spending:

```bash
bun run src/cli.ts \
  --agent claude \
  --max-tokens 500000 \
  --max-cost 50.0 \
  --context-window 200000 \
  --context-threshold 0.8 \
  --checkpoint-interval 3
```

## Advanced Cost Management

### Dynamic Agent Switching

Switch agents based on budget remaining:

```typescript
import { CostTracker } from 'ralph-orchestrator-ts';

function selectAgent(tracker: CostTracker): string {
  const remainingBudget = tracker.getRemainingBudget();

  if (remainingBudget > 20) {
    return 'claude';
  } else if (remainingBudget > 5) {
    return 'gemini';
  } else {
    return 'q';
  }
}
```

### Cost-Aware Prompts

Include cost considerations in prompts:

```markdown
## Budget Constraints
- Maximum budget: $10
- Optimize for efficiency
- Skip non-essential features if approaching limit
- Prioritize core functionality
```

### Batch Processing

Combine multiple small tasks:

```bash
# Inefficient: Multiple orchestrations
bun run src/cli.ts --prompt task1.md  # $5
bun run src/cli.ts --prompt task2.md  # $5
bun run src/cli.ts --prompt task3.md  # $5
# Total: $15

# Efficient: Batched orchestration
cat task1.md task2.md task3.md > batch.md
bun run src/cli.ts --prompt batch.md  # $10
# Total: $10 (33% savings)
```

## Cost Alerts

### Setting Up Alerts

```bash
#!/bin/bash
# cost_monitor.sh

COST_LIMIT=25.0
CURRENT_COST=$(bun -e "
import { readFile } from 'fs/promises';
const data = JSON.parse(await readFile('.agent/metrics/state_latest.json', 'utf-8'));
console.log(data.totalCost);
")

if (( $(echo "$CURRENT_COST > $COST_LIMIT" | bc -l) )); then
    echo "ALERT: Cost exceeded $COST_LIMIT" | mail -s "Ralph Cost Alert" admin@example.com
fi
```

### Automated Stops

Implement circuit breakers:

```typescript
import { readFile } from 'fs/promises';

interface State {
  totalCost: number;
  maxCost: number;
}

async function checkCostLimit(): Promise<void> {
  const content = await readFile('.agent/metrics/state_latest.json', 'utf-8');
  const state: State = JSON.parse(content);

  if (state.totalCost > state.maxCost * 0.9) {
    console.warn('WARNING: 90% of budget consumed');
    process.exit(1);
  }
}

await checkCostLimit();
```

## ROI Analysis

### Calculating ROI

```typescript
// ROI calculation
const hoursSaved = 10; // Hours of manual work saved
const hourlyRate = 50; // Developer hourly rate
const aiCost = 25; // Cost of AI orchestration

const valueCreated = hoursSaved * hourlyRate;
const roi = ((valueCreated - aiCost) / aiCost) * 100;

console.log(`Value created: $${valueCreated}`);
console.log(`AI cost: $${aiCost}`);
console.log(`ROI: ${roi.toFixed(1)}%`);
```

### Cost-Benefit Matrix

| Task | Manual Hours | Manual Cost | AI Cost | Savings |
|------|-------------|-------------|---------|---------|
| API Development | 40h | $2000 | $50 | $1950 |
| Documentation | 20h | $1000 | $20 | $980 |
| Testing Suite | 30h | $1500 | $30 | $1470 |
| Bug Fixing | 10h | $500 | $25 | $475 |

## Best Practices

### 1. Start Small

Test with minimal budgets first:

```bash
# Test run
bun run src/cli.ts --max-cost 1.0 --max-iterations 5

# Scale up if successful
bun run src/cli.ts --max-cost 10.0 --max-iterations 50
```

### 2. Monitor Continuously

Track costs in real-time:

```bash
# Terminal 1: Run orchestration
bun run src/cli.ts --verbose

# Terminal 2: Monitor costs
watch -n 5 'tail -n 20 .agent/metrics/state_latest.json'
```

### 3. Optimize Iteratively

- Analyze cost reports
- Identify expensive operations
- Refine prompts and settings
- Test optimizations

### 4. Set Realistic Budgets

- Development: 50% of production budget
- Testing: 25% of production budget
- Production: Full budget with safety margin

### 5. Document Costs

Keep records for analysis:

```bash
# Save cost report after each run
bun run src/cli.ts && \
  cp .agent/metrics/state_latest.json "reports/run_$(date +%Y%m%d_%H%M%S).json"
```

## TypeScript Cost Tracking API

```typescript
import { CostTracker, MetricsCollector } from 'ralph-orchestrator-ts';

// Initialize cost tracker
const costTracker = new CostTracker({
  maxCost: 50.0,
  alertThreshold: 0.9,
});

// Register cost callback
costTracker.on('costUpdate', (cost) => {
  console.log(`Current cost: $${cost.toFixed(2)}`);
});

// Register alert callback
costTracker.on('budgetAlert', (remaining) => {
  console.warn(`Budget alert! Only $${remaining.toFixed(2)} remaining`);
});

// Check remaining budget
const remaining = costTracker.getRemainingBudget();
console.log(`Remaining budget: $${remaining.toFixed(2)}`);

// Get cost breakdown
const breakdown = costTracker.getCostBreakdown();
console.log(`Input tokens cost: $${breakdown.inputCost.toFixed(2)}`);
console.log(`Output tokens cost: $${breakdown.outputCost.toFixed(2)}`);
```

## Troubleshooting

### Common Issues

1. **Unexpected high costs**
   - Check token usage in metrics
   - Review prompt efficiency
   - Verify context settings

2. **Budget exceeded quickly**
   - Lower context window
   - Increase summarization threshold
   - Use cheaper agent

3. **Poor results with budget constraints**
   - Increase budget slightly
   - Optimize prompts
   - Consider phased approach

## Next Steps

- Review [Agent Selection](agents.md) for cost-effective choices
- Optimize [Prompts](prompts.md) for efficiency
- Configure [Checkpointing](checkpointing.md) to save progress
- Explore [Examples](../examples/index.md) for cost-optimized patterns
