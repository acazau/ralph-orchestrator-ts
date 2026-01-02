# Orchestrator API Reference

Complete API documentation for the Ralph Orchestrator core module.

## Module: `ralph-orchestrator-ts`

The main orchestration module that coordinates AI agent execution using the Ralph Wiggum technique.

## Classes

### RalphOrchestrator

Main orchestrator class managing the execution loop.

```typescript
import type { RalphConfig, ToolAdapter } from 'ralph-orchestrator-ts';

/**
 * Ralph Orchestrator - The main orchestration engine.
 *
 * Orchestrates AI agent iterations for autonomous task completion.
 * Runs a loop that repeatedly calls an AI agent until the task is
 * complete or safety limits are reached.
 *
 * @example
 * ```typescript
 * import { RalphOrchestrator, createDefaultConfig, AgentType } from 'ralph-orchestrator-ts';
 *
 * const config = createDefaultConfig({
 *   agent: AgentType.CLAUDE,
 *   maxIterations: 50,
 * });
 *
 * const orchestrator = new RalphOrchestrator(config);
 * await orchestrator.run();
 * ```
 */
class RalphOrchestrator {
  /**
   * Initialize the orchestrator with configuration.
   *
   * @param config - Full RalphConfig object or partial configuration
   *
   * @example
   * ```typescript
   * // With full config
   * const orchestrator = new RalphOrchestrator(fullConfig);
   *
   * // With partial config (defaults applied)
   * const orchestrator = new RalphOrchestrator({
   *   agent: AgentType.CLAUDE,
   *   maxIterations: 50,
   * });
   * ```
   */
  constructor(config?: RalphConfig | Partial<RalphConfig>);

  /**
   * Run the orchestration loop (sync wrapper).
   *
   * @returns Promise that resolves when orchestration completes
   *
   * @example
   * ```typescript
   * await orchestrator.run();
   * ```
   */
  run(): Promise<void>;

  /**
   * Run the orchestration loop (async).
   *
   * Executes iterations until one of:
   * - Task completion marker is found
   * - Maximum iterations reached
   * - Maximum runtime exceeded
   * - Maximum cost exceeded
   * - Loop detected
   * - User interruption
   *
   * @throws Error if already running or no adapter available
   *
   * @example
   * ```typescript
   * try {
   *   await orchestrator.arun();
   * } catch (error) {
   *   console.error('Orchestration failed:', error);
   * }
   * ```
   */
  async arun(): Promise<void>;

  /**
   * Stop the orchestration loop.
   *
   * Sets a flag that will stop the loop after the current iteration completes.
   *
   * @example
   * ```typescript
   * // Handle Ctrl+C
   * process.on('SIGINT', () => {
   *   orchestrator.stop();
   * });
   * ```
   */
  stop(): void;

  /**
   * Get current orchestrator state.
   *
   * @returns Current state including iteration count, status, tasks
   *
   * @example
   * ```typescript
   * const state = orchestrator.getState();
   * console.log(`Iteration ${state.iteration}/${state.maxIterations}`);
   * console.log(`Status: ${state.status}`);
   * ```
   */
  getState(): OrchestratorState;

  /**
   * Get metrics as dictionary.
   *
   * @returns Metrics data suitable for serialization
   */
  getMetrics(): Record<string, unknown>;

  /**
   * Get iteration statistics summary.
   *
   * @returns Summary of iteration performance
   */
  getIterationStats(): IterationStatsSummary;

  /**
   * Get cost summary.
   *
   * @returns Breakdown of costs by tool
   */
  getCostSummary(): CostSummary;
}
```

### OrchestratorState Interface

```typescript
/**
 * Orchestrator state for monitoring and persistence.
 */
interface OrchestratorState {
  /** Unique session ID */
  id: number;

  /** Current status */
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';

  /** Name of the primary tool adapter */
  primaryTool: string;

  /** Path to prompt file */
  promptFile: string;

  /** Current iteration number */
  iteration: number;

  /** Maximum allowed iterations */
  maxIterations: number;

  /** Elapsed runtime in seconds */
  runtime: number;

  /** Maximum allowed runtime in seconds */
  maxRuntime: number;

  /** Pending tasks extracted from prompt */
  tasks: Task[];

  /** Tasks that have been completed */
  completedTasks: Task[];
}
```

### Task Interface

```typescript
/**
 * Task object for tracking work items.
 */
interface Task {
  id: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
  iteration?: number;
}
```

## Configuration

### RalphConfig Interface

```typescript
/**
 * Configuration for Ralph orchestrator.
 *
 * All parameters can be set via:
 * - Command-line arguments
 * - Environment variables (RALPH_*)
 * - Configuration file (ralph.yml)
 * - Default values
 */
interface RalphConfig {
  // Agent configuration
  agent: AgentType;
  agentArgs: string[];

  // File paths
  promptFile: string;
  promptText?: string;

  // Iteration limits
  maxIterations: number;
  maxRuntime: number;        // seconds

  // Token and cost limits
  maxTokens: number;
  maxCost: number;           // USD

  // Context management
  contextWindow: number;     // tokens
  contextThreshold: number;  // 0-1

  // Checkpointing
  checkpointInterval: number;
  gitCheckpoint: boolean;
  archivePrompts: boolean;

  // Retry configuration
  retryDelay: number;        // seconds

  // Monitoring
  metricsInterval: number;
  enableMetrics: boolean;

  // Security
  maxPromptSize: number;     // bytes
  allowUnsafePaths: boolean;

  // Output
  verbose: boolean;
  dryRun: boolean;
  outputFormat: 'plain' | 'rich' | 'json';
  outputVerbosity: 'quiet' | 'normal' | 'verbose' | 'debug';
  showTokenUsage: boolean;
  showTimestamps: boolean;

  // Telemetry
  iterationTelemetry: boolean;
  outputPreviewLength: number;

  // Adapter configuration
  adapters: Record<string, AdapterConfig>;

  // ACP configuration
  acpAgent?: string;
  acpPermissionMode?: string;
}
```

### AgentType Enum

```typescript
/**
 * Supported AI agent types.
 */
enum AgentType {
  CLAUDE = 'claude',
  Q = 'q',
  GEMINI = 'gemini',
  ACP = 'acp',
  AUTO = 'auto',
}
```

## Functions

### createDefaultConfig

```typescript
/**
 * Create a default configuration with optional overrides.
 *
 * @param options - Partial configuration to merge
 * @returns Complete RalphConfig
 *
 * @example
 * ```typescript
 * const config = createDefaultConfig({
 *   agent: AgentType.CLAUDE,
 *   maxIterations: 50,
 * });
 * ```
 */
function createDefaultConfig(options?: Partial<RalphConfig>): RalphConfig;
```

## Constants

```typescript
/**
 * Configuration defaults
 */
const CONFIG_DEFAULTS = {
  MAX_ITERATIONS: 100,
  MAX_RUNTIME: 14400,           // 4 hours
  PROMPT_FILE: 'PROMPT.md',
  CHECKPOINT_INTERVAL: 5,
  RETRY_DELAY: 2,
  MAX_TOKENS: 1000000,          // 1M tokens
  MAX_COST: 50.0,               // $50 USD
  CONTEXT_WINDOW: 200000,       // 200K tokens
  CONTEXT_THRESHOLD: 0.8,       // 80%
  METRICS_INTERVAL: 10,
  MAX_PROMPT_SIZE: 10485760,    // 10MB
  OUTPUT_PREVIEW_LENGTH: 500,
} as const;

/**
 * Token costs per million
 */
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  claude: { input: 3.0, output: 15.0 },
  q: { input: 0.5, output: 1.5 },
  gemini: { input: 0.5, output: 1.5 },
};
```

## Usage Examples

### Basic Usage

```typescript
import { RalphOrchestrator, createDefaultConfig, AgentType } from 'ralph-orchestrator-ts';

// Create configuration
const config = createDefaultConfig({
  agent: AgentType.CLAUDE,
  promptFile: 'task.md',
  maxIterations: 50,
  maxCost: 25.0,
});

// Initialize orchestrator
const orchestrator = new RalphOrchestrator(config);

// Run orchestration
await orchestrator.run();
```

### With Partial Configuration

```typescript
import { RalphOrchestrator, AgentType } from 'ralph-orchestrator-ts';

// Partial config with defaults
const orchestrator = new RalphOrchestrator({
  agent: AgentType.CLAUDE,
  maxIterations: 100,
  verbose: true,
});

await orchestrator.run();
```

### State Monitoring

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';

const orchestrator = new RalphOrchestrator(config);

// Start in background
const promise = orchestrator.run();

// Monitor progress
const interval = setInterval(() => {
  const state = orchestrator.getState();
  console.log(`Progress: ${state.iteration}/${state.maxIterations}`);
  console.log(`Runtime: ${state.runtime.toFixed(1)}s`);
  console.log(`Tasks completed: ${state.completedTasks.length}`);

  if (state.status !== 'running') {
    clearInterval(interval);
  }
}, 5000);

await promise;
```

### Error Handling

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';

const orchestrator = new RalphOrchestrator(config);

try {
  await orchestrator.run();

  // Get final state
  const state = orchestrator.getState();
  if (state.status === 'completed') {
    console.log('Task completed successfully!');
  } else if (state.status === 'stopped') {
    console.log('Task stopped before completion');
  }

  // Get metrics
  const metrics = orchestrator.getMetrics();
  console.log(`Success rate: ${metrics.successRate}`);

  // Get costs
  const costs = orchestrator.getCostSummary();
  console.log(`Total cost: $${costs.totalCost.toFixed(4)}`);

} catch (error) {
  console.error('Orchestration failed:', error);
  process.exit(1);
}
```

### Graceful Shutdown

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';

const orchestrator = new RalphOrchestrator(config);

// Handle shutdown signals
const shutdown = () => {
  console.log('Shutting down...');
  orchestrator.stop();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await orchestrator.run();
console.log('Orchestration complete');
```

### Web Dashboard Integration

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';

// Create orchestrator
const orchestrator = new RalphOrchestrator(config);

// Expose state via API endpoint
app.get('/api/status', (req, res) => {
  const state = orchestrator.getState();
  const metrics = orchestrator.getMetrics();
  const costs = orchestrator.getCostSummary();

  res.json({
    state,
    metrics,
    costs,
  });
});

// Start orchestration
orchestrator.run().catch(console.error);
```

## Thread Safety

The orchestrator is **not thread-safe**. If you need concurrent execution:

1. Create separate orchestrator instances
2. Use different working directories
3. Implement external synchronization

## Performance Considerations

- **Memory usage**: ~50MB base + agent overhead
- **Disk I/O**: Checkpoints create Git commits
- **Network**: Agent API calls may have latency
- **CPU**: Minimal overhead (<1% between iterations)

## See Also

- [Configuration API](config.md)
- [Agents API](agents.md)
- [Metrics API](metrics.md)
- [CLI Reference](cli.md)
