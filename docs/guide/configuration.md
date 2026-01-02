# Configuration Guide

Ralph Orchestrator provides extensive configuration options to control execution, manage costs, and ensure safe operation. This guide covers all configuration parameters and best practices.

## Configuration Methods

### 1. Command Line Arguments

The primary way to configure Ralph Orchestrator is through command-line arguments:

```bash
bun run src/cli.ts --agent claude --max-iterations 50 --max-cost 25.0
```

### 2. Environment Variables

Some settings can be configured via environment variables:

```bash
export RALPH_AGENT=claude
export RALPH_MAX_COST=25.0
bun run src/cli.ts
```

### 3. Configuration File (ralph.yml)

Configuration can be defined in a YAML file:

```yaml
# ralph.yml
agent: claude
maxIterations: 100
maxCost: 50.0
contextWindow: 200000
checkpointInterval: 5
```

## Core Configuration Options

### Agent Selection

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--agent` | `auto` | AI agent to use: `claude`, `q`, `gemini`, `acp`, or `auto` |
| `--agent-args` | None | Additional arguments to pass to the agent |
| `--acp-agent` | `gemini` | ACP agent command (for `-a acp`) |
| `--acp-permission-mode` | `auto_approve` | Permission handling: `auto_approve`, `deny_all`, `allowlist`, `interactive` |

**Example:**
```bash
# Use Claude specifically
bun run src/cli.ts --agent claude

# Auto-detect available agent
bun run src/cli.ts --agent auto

# Pass additional arguments to agent
bun run src/cli.ts --agent claude --agent-args "--model claude-3-sonnet"

# Use ACP-compliant agent
bun run src/cli.ts --agent acp --acp-agent gemini

# Use ACP with specific permission mode
bun run src/cli.ts --agent acp --acp-agent gemini --acp-permission-mode deny_all
```

### Prompt Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--prompt` | `PROMPT.md` | Path to the prompt file |
| `--max-prompt-size` | 10MB | Maximum allowed prompt file size |

**Example:**
```bash
# Use custom prompt file
bun run src/cli.ts --prompt tasks/my-task.md

# Set maximum prompt size (in bytes)
bun run src/cli.ts --max-prompt-size 5242880  # 5MB
```

## Execution Limits

### Iteration and Runtime

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--max-iterations` | 100 | Maximum number of iterations |
| `--max-runtime` | 14400 | Maximum runtime in seconds (4 hours) |

**Example:**
```bash
# Quick task with few iterations
bun run src/cli.ts --max-iterations 10 --max-runtime 600

# Long-running task
bun run src/cli.ts --max-iterations 500 --max-runtime 86400  # 24 hours
```

### Token and Cost Management

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--max-tokens` | 1,000,000 | Maximum total tokens to use |
| `--max-cost` | 50.0 | Maximum cost in USD |
| `--context-window` | 200,000 | Context window size in tokens |
| `--context-threshold` | 0.8 | Trigger summarization at this % of context |

**Example:**
```bash
# Budget-conscious configuration
bun run src/cli.ts \
  --max-tokens 100000 \
  --max-cost 5.0 \
  --context-window 100000

# High-capacity configuration
bun run src/cli.ts \
  --max-tokens 5000000 \
  --max-cost 200.0 \
  --context-window 500000
```

## Checkpointing and Recovery

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--checkpoint-interval` | 5 | Iterations between checkpoints |
| `--no-git` | False | Disable git checkpointing |
| `--no-archive` | False | Disable prompt archiving |

**Example:**
```bash
# Frequent checkpoints for critical tasks
bun run src/cli.ts --checkpoint-interval 1

# Disable git operations (for non-git directories)
bun run src/cli.ts --no-git

# Minimal persistence
bun run src/cli.ts --no-git --no-archive
```

## Monitoring and Debugging

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--metrics-interval` | 10 | Iterations between metrics logs |
| `--no-metrics` | False | Disable metrics collection |
| `--verbose` | False | Enable verbose logging |
| `--dry-run` | False | Test configuration without execution |

**Example:**
```bash
# Verbose monitoring
bun run src/cli.ts --verbose --metrics-interval 1

# Test configuration
bun run src/cli.ts --dry-run --verbose

# Minimal logging
bun run src/cli.ts --no-metrics
```

## Security Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--allow-unsafe-paths` | False | Allow potentially unsafe file paths |

**Example:**
```bash
# Standard security (recommended)
bun run src/cli.ts

# Allow unsafe paths (use with caution)
bun run src/cli.ts --allow-unsafe-paths
```

## Retry and Recovery

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--retry-delay` | 2 | Delay between retries in seconds |

**Example:**
```bash
# Slower retry for rate-limited APIs
bun run src/cli.ts --retry-delay 10

# Fast retry for local agents
bun run src/cli.ts --retry-delay 1
```

## ACP (Agent Client Protocol) Configuration

### ACP Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--acp-agent` | `gemini` | Command to run the ACP-compliant agent |
| `--acp-permission-mode` | `auto_approve` | Permission handling mode |

### Permission Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `auto_approve` | Approve all tool requests automatically | Trusted environments, CI/CD |
| `deny_all` | Deny all tool requests | Testing, sandboxed execution |
| `allowlist` | Only approve matching patterns | Production with specific tools |
| `interactive` | Prompt user for each request | Development, manual oversight |

### Configuration File (ralph.yml)

```yaml
adapters:
  acp:
    enabled: true
    timeout: 300
    toolPermissions:
      agentCommand: gemini        # ACP agent CLI command
      agentArgs: []               # Additional CLI arguments
      permissionMode: auto_approve
      permissionAllowlist:        # For allowlist mode
        - "fs/read_text_file:*.ts"
        - "fs/write_text_file:src/*"
        - "terminal/create:bun*"
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RALPH_ACP_AGENT` | Override `agentCommand` |
| `RALPH_ACP_PERMISSION_MODE` | Override `permissionMode` |
| `RALPH_ACP_TIMEOUT` | Override `timeout` (integer) |

**Example:**
```bash
# Using environment variables
export RALPH_ACP_AGENT=gemini
export RALPH_ACP_PERMISSION_MODE=deny_all
bun run src/cli.ts --agent acp
```

### ACP Profile

For ACP-compliant agents:

```bash
bun run src/cli.ts \
  --agent acp \
  --acp-agent gemini \
  --acp-permission-mode auto_approve \
  --max-iterations 100 \
  --max-runtime 14400
```

## Configuration Profiles

### Development Profile

For local development and testing:

```bash
bun run src/cli.ts \
  --agent q \
  --max-iterations 10 \
  --max-cost 1.0 \
  --verbose \
  --checkpoint-interval 1 \
  --metrics-interval 1
```

### Production Profile

For production workloads:

```bash
bun run src/cli.ts \
  --agent claude \
  --max-iterations 100 \
  --max-runtime 14400 \
  --max-tokens 1000000 \
  --max-cost 50.0 \
  --checkpoint-interval 5 \
  --metrics-interval 10
```

### Budget Profile

For cost-sensitive operations:

```bash
bun run src/cli.ts \
  --agent q \
  --max-tokens 50000 \
  --max-cost 2.0 \
  --context-window 50000 \
  --context-threshold 0.7
```

### High-Performance Profile

For complex, resource-intensive tasks:

```bash
bun run src/cli.ts \
  --agent claude \
  --max-iterations 500 \
  --max-runtime 86400 \
  --max-tokens 5000000 \
  --max-cost 500.0 \
  --context-window 500000 \
  --checkpoint-interval 10
```

## Configuration Best Practices

### 1. Start Conservative

Begin with lower limits and increase as needed:

```bash
# Start small
bun run src/cli.ts --max-iterations 5 --max-cost 1.0

# Increase if needed
bun run src/cli.ts --max-iterations 50 --max-cost 10.0
```

### 2. Use Dry Run

Always test configuration before production:

```bash
bun run src/cli.ts --dry-run --verbose
```

### 3. Monitor Metrics

Enable metrics for production workloads:

```bash
bun run src/cli.ts --metrics-interval 5 --verbose
```

### 4. Set Appropriate Limits

Choose limits based on task complexity:

- **Simple tasks**: 10-20 iterations, $1-5 cost
- **Medium tasks**: 50-100 iterations, $10-25 cost
- **Complex tasks**: 100-500 iterations, $50-200 cost

### 5. Checkpoint Frequently

For long-running tasks, checkpoint often:

```bash
bun run src/cli.ts --checkpoint-interval 3
```

## Environment-Specific Configuration

### CI/CD Pipelines

```bash
bun run src/cli.ts \
  --agent auto \
  --max-iterations 50 \
  --max-runtime 3600 \
  --no-git \
  --metrics-interval 10
```

### Docker Containers

```dockerfile
ENV RALPH_AGENT=claude
ENV RALPH_MAX_COST=25.0
CMD ["bun", "run", "src/cli.ts", "--no-git", "--max-runtime", "7200"]
```

### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ralph-config
data:
  RALPH_AGENT: "claude"
  RALPH_MAX_COST: "50.0"
  RALPH_MAX_ITERATIONS: "100"
```

## TypeScript Configuration

You can also configure Ralph programmatically in TypeScript:

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';
import type { OrchestratorConfig } from 'ralph-orchestrator-ts';

const config: OrchestratorConfig = {
  agent: 'claude',
  maxIterations: 100,
  maxCost: 50.0,
  maxTokens: 1000000,
  contextWindow: 200000,
  contextThreshold: 0.8,
  checkpointInterval: 5,
  metricsInterval: 10,
  verbose: true,
};

const orchestrator = new RalphOrchestrator(config);
await orchestrator.run('PROMPT.md');
```

## Troubleshooting Configuration

### Common Issues

1. **Agent not found**
   - Solution: Check agent installation with `--agent auto`

2. **Exceeding cost limits**
   - Solution: Increase `--max-cost` or use cheaper agent

3. **Context overflow**
   - Solution: Decrease `--context-threshold` or increase `--context-window`

4. **Slow performance**
   - Solution: Increase `--checkpoint-interval` and `--metrics-interval`

### Debug Commands

```bash
# Check configuration
bun run src/cli.ts --dry-run --verbose

# List available agents
bun run src/cli.ts --agent auto --dry-run

# Test with minimal configuration
bun run src/cli.ts --max-iterations 1 --verbose
```

## Configuration Reference

For a complete list of all configuration options, run:

```bash
bun run src/cli.ts --help
```

## Next Steps

- Learn about [AI Agents](agents.md) and their capabilities
- Understand [Prompt Engineering](prompts.md) for better results
- Explore [Cost Management](cost-management.md) strategies
- Set up [Checkpointing](checkpointing.md) for recovery
