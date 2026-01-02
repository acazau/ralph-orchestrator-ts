# Checkpointing and Recovery Guide

Ralph Orchestrator provides robust checkpointing mechanisms to ensure work is never lost and tasks can be resumed after interruptions.

## Overview

Checkpointing saves the state of your orchestration at regular intervals, enabling:
- **Recovery** from crashes or interruptions
- **Progress tracking** across iterations
- **State inspection** for debugging
- **Audit trails** for compliance

## Checkpoint Types

### 1. Git Checkpoints

Automatic git commits at specified intervals:

```bash
# Enable git checkpointing (default)
bun run src/cli.ts --checkpoint-interval 5

# Disable git checkpointing
bun run src/cli.ts --no-git
```

**What's saved:**
- Current prompt file state
- Any files created/modified by the agent
- Timestamp and iteration number

### 2. Prompt Archives

Historical versions of the prompt file:

```bash
# Enable prompt archiving (default)
bun run src/cli.ts

# Disable prompt archiving
bun run src/cli.ts --no-archive
```

**Location:** `.agent/prompts/prompt_YYYYMMDD_HHMMSS.md`

### 3. State Snapshots

JSON files containing orchestrator state:

```json
{
  "iteration": 15,
  "agent": "claude",
  "startTime": "2024-01-10T10:00:00",
  "tokensUsed": 50000,
  "costIncurred": 2.50,
  "status": "running"
}
```

**Location:** `.agent/metrics/state_*.json`

## Configuration

### Checkpoint Interval

Control how often checkpoints occur:

```bash
# Checkpoint every iteration (maximum safety)
bun run src/cli.ts --checkpoint-interval 1

# Checkpoint every 10 iterations (balanced)
bun run src/cli.ts --checkpoint-interval 10

# Checkpoint every 50 iterations (minimal overhead)
bun run src/cli.ts --checkpoint-interval 50
```

### Checkpoint Strategies

#### Aggressive Checkpointing
For critical or experimental tasks:

```bash
bun run src/cli.ts \
  --checkpoint-interval 1 \
  --metrics-interval 1 \
  --verbose
```

#### Balanced Checkpointing
For standard production tasks:

```bash
bun run src/cli.ts \
  --checkpoint-interval 5 \
  --metrics-interval 10
```

#### Minimal Checkpointing
For simple, fast tasks:

```bash
bun run src/cli.ts \
  --checkpoint-interval 20 \
  --no-archive
```

## Recovery Procedures

### Automatic Recovery

Ralph Orchestrator automatically recovers from the last checkpoint:

1. **Detect interruption**
2. **Load last checkpoint**
3. **Resume from last known state**
4. **Continue iteration**

### Manual Recovery

#### From Git Checkpoint

```bash
# View checkpoint history
git log --oneline | grep "Ralph checkpoint"

# Restore specific checkpoint
git checkout <commit-hash>

# Resume orchestration
bun run src/cli.ts --prompt PROMPT.md
```

#### From Prompt Archive

```bash
# List archived prompts
ls -la .agent/prompts/

# Restore archived prompt
cp .agent/prompts/prompt_20240110_100000.md PROMPT.md

# Resume orchestration
bun run src/cli.ts
```

#### From State Snapshot

```typescript
// Load state programmatically
import { readFile } from 'fs/promises';

interface OrchestratorState {
  iteration: number;
  agent: string;
  startTime: string;
  tokensUsed: number;
  costIncurred: number;
  status: string;
}

async function loadState(path: string): Promise<OrchestratorState> {
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content) as OrchestratorState;
}

const state = await loadState('.agent/metrics/state_20240110_100000.json');
console.log(`Last iteration: ${state.iteration}`);
console.log(`Tokens used: ${state.tokensUsed}`);
console.log(`Cost incurred: $${state.costIncurred}`);
```

## Checkpoint Storage

### Directory Structure

```
.agent/
├── checkpoints/       # Git checkpoint metadata
├── prompts/          # Archived prompt files
│   ├── prompt_20240110_100000.md
│   ├── prompt_20240110_101500.md
│   └── prompt_20240110_103000.md
├── metrics/          # State and metrics
│   ├── state_20240110_100000.json
│   ├── state_20240110_101500.json
│   └── metrics_20240110_103000.json
└── logs/            # Execution logs
```

### Storage Management

#### Clean Old Checkpoints

```bash
# Remove checkpoints older than 7 days
find .agent/prompts -mtime +7 -delete
find .agent/metrics -name "*.json" -mtime +7 -delete

# Keep only last 100 checkpoints
ls -t .agent/prompts/*.md | tail -n +101 | xargs rm -f
```

#### Backup Checkpoints

```bash
# Create backup archive
tar -czf ralph_checkpoints_$(date +%Y%m%d).tar.gz .agent/

# Backup to remote
rsync -av .agent/ user@backup-server:/backups/ralph/
```

## Advanced Checkpointing

### Custom Checkpoint Triggers

Beyond interval-based checkpointing, you can trigger checkpoints in your prompt:

```markdown
## Progress
- Step 1 complete [CHECKPOINT]
- Step 2 complete [CHECKPOINT]
- Step 3 complete [CHECKPOINT]
```

### Checkpoint Hooks

Use git hooks for custom checkpoint processing:

```bash
# .git/hooks/post-commit
#!/bin/bash
if [[ $1 == *"Ralph checkpoint"* ]]; then
    # Custom backup or notification
    cp PROMPT.md /backup/location/
    echo "Checkpoint created" | mail -s "Ralph Progress" admin@example.com
fi
```

### Distributed Checkpointing

For team environments:

```bash
# Push checkpoints to shared repository
bun run src/cli.ts --checkpoint-interval 5

# In another terminal/machine
git pull  # Get latest checkpoints

# Or use automated sync
watch -n 60 'git pull'
```

## Best Practices

### 1. Choose Appropriate Intervals

| Task Type | Recommended Interval | Rationale |
|-----------|---------------------|-----------|
| Experimental | 1-2 | Maximum recovery points |
| Development | 5-10 | Balance safety/performance |
| Production | 10-20 | Minimize overhead |
| Simple | 20-50 | Low risk tasks |

### 2. Monitor Checkpoint Size

```bash
# Check checkpoint storage usage
du -sh .agent/

# Monitor growth
watch -n 60 'du -sh .agent/*'
```

### 3. Test Recovery

Regularly test recovery procedures:

```bash
# Simulate interruption
bun run src/cli.ts &
PID=$!
sleep 30
kill $PID

# Verify recovery
bun run src/cli.ts  # Should resume
```

### 4. Clean Up Regularly

Implement checkpoint rotation:

```bash
# Keep last 50 checkpoints
#!/bin/bash
MAX_CHECKPOINTS=50
COUNT=$(ls .agent/prompts/*.md 2>/dev/null | wc -l)
if [ $COUNT -gt $MAX_CHECKPOINTS ]; then
    ls -t .agent/prompts/*.md | tail -n +$(($MAX_CHECKPOINTS+1)) | xargs rm
fi
```

## Troubleshooting

### Common Issues

#### 1. Git Checkpointing Fails

**Error:** "Not a git repository"

**Solution:**
```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Or disable git checkpointing
bun run src/cli.ts --no-git
```

#### 2. Checkpoint Storage Full

**Error:** "No space left on device"

**Solution:**
```bash
# Clean old checkpoints
find .agent -type f -mtime +30 -delete

# Move to larger storage
mv .agent /larger/disk/
ln -s /larger/disk/.agent .agent
```

#### 3. Corrupted Checkpoint

**Error:** "Invalid checkpoint data"

**Solution:**
```bash
# Use previous checkpoint
ls -la .agent/prompts/  # Find earlier version
cp .agent/prompts/prompt_EARLIER.md PROMPT.md
```

### Recovery Validation

Verify checkpoint integrity:

```typescript
#!/usr/bin/env bun
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface StateFile {
  iteration: number;
  agent: string;
}

async function validateCheckpoints(): Promise<void> {
  const checkpointDir = '.agent/metrics';
  const files = await readdir(checkpointDir);

  for (const file of files) {
    if (file.startsWith('state_') && file.endsWith('.json')) {
      try {
        const content = await readFile(join(checkpointDir, file), 'utf-8');
        const data: StateFile = JSON.parse(content);
        if (!('iteration' in data) || !('agent' in data)) {
          throw new Error('Missing required fields');
        }
        console.log(`OK: ${file}`);
      } catch (e) {
        console.log(`FAIL: ${file}: ${(e as Error).message}`);
      }
    }
  }
}

await validateCheckpoints();
```

## Performance Impact

### Checkpoint Overhead

| Interval | Overhead | Use Case |
|----------|----------|----------|
| 1 | High (5-10%) | Critical tasks |
| 5 | Moderate (2-5%) | Standard tasks |
| 10 | Low (1-2%) | Long tasks |
| 20+ | Minimal (<1%) | Simple tasks |

### Optimization Tips

1. **Use SSDs** for checkpoint storage
2. **Disable unnecessary features** (e.g., `--no-archive` if not needed)
3. **Adjust intervals** based on task criticality
4. **Clean up regularly** to maintain performance

## Integration

### CI/CD Integration

```yaml
# .github/workflows/ralph.yml
name: Ralph Orchestration
on:
  push:
    branches: [main]

jobs:
  orchestrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run Ralph
        run: |
          bun run src/cli.ts \
            --checkpoint-interval 10 \
            --max-iterations 100

      - name: Save Checkpoints
        uses: actions/upload-artifact@v4
        with:
          name: ralph-checkpoints
          path: .agent/
```

### Monitoring Integration

```bash
# Send checkpoint events to monitoring
#!/bin/bash
CHECKPOINT_COUNT=$(ls .agent/prompts/*.md 2>/dev/null | wc -l)
curl -X POST https://metrics.example.com/api/v1/metrics \
  -d "ralph.checkpoints.count=$CHECKPOINT_COUNT"
```

## TypeScript Checkpoint API

You can also work with checkpoints programmatically:

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';

const orchestrator = new RalphOrchestrator({
  checkpointInterval: 5,
  enableGitCheckpoints: true,
  enablePromptArchive: true,
});

// Register checkpoint callback
orchestrator.on('checkpoint', (state) => {
  console.log(`Checkpoint at iteration ${state.iteration}`);
  console.log(`Cost so far: $${state.costIncurred}`);
});

// Manual checkpoint
await orchestrator.createCheckpoint('Manual checkpoint before risky operation');

// Restore from checkpoint
await orchestrator.restoreFromCheckpoint('.agent/metrics/state_latest.json');
```

## Next Steps

- Learn about [Cost Management](cost-management.md) to optimize checkpoint costs
- Explore [Configuration](configuration.md) for checkpoint options
- Review [Troubleshooting](../troubleshooting.md) for recovery issues
- See [Examples](../examples/index.md) for checkpoint patterns
