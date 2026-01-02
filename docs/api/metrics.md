# Metrics API Reference

## Overview

The Metrics API provides functionality for collecting, storing, and analyzing execution metrics from Ralph Orchestrator runs.

## Types

### TriggerReason Enum

```typescript
/**
 * Reasons why an iteration was triggered
 */
enum TriggerReason {
  /** First iteration of a session */
  INITIAL = 'initial',

  /** Previous iteration didn't complete task */
  TASK_INCOMPLETE = 'task_incomplete',

  /** Previous iteration succeeded, continuing */
  PREVIOUS_SUCCESS = 'previous_success',

  /** Recovering from a previous failure */
  RECOVERY = 'recovery',

  /** Loop detection triggered intervention */
  LOOP_DETECTED = 'loop_detected',

  /** Safety limits triggered */
  SAFETY_LIMIT = 'safety_limit',

  /** User requested stop */
  USER_STOP = 'user_stop',
}
```

### Metrics Interface

```typescript
/**
 * Basic orchestration metrics
 */
interface Metrics {
  iterations: number;
  successfulIterations: number;
  failedIterations: number;
  errors: number;
  checkpoints: number;
  rollbacks: number;
  startTime: number;
}
```

### IterationData Interface

```typescript
/**
 * Single iteration data
 */
interface IterationData {
  iteration: number;
  duration: number;
  success: boolean;
  error: string;
  timestamp: string;
  triggerReason: TriggerReason | string;
  outputPreview: string;
  tokensUsed: number;
  cost: number;
  toolsUsed: string[];
}
```

### Cost Types

```typescript
/**
 * Cost entry for tracking
 */
interface CostEntry {
  timestamp: number;
  tool: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/**
 * Cost summary
 */
interface CostSummary {
  totalCost: number;
  costsByTool: Record<string, number>;
  usageCount: number;
  averageCost: number;
}
```

### Summary Types

```typescript
/**
 * Iteration statistics summary
 */
interface IterationStatsSummary {
  total: number;
  current: number;
  successes: number;
  failures: number;
  successRate: number;
  runtime: string;
  startTime: string | null;
}

/**
 * Full metrics summary for serialization
 */
interface MetricsSummary {
  summary: {
    iterations: number;
    successful: number;
    failed: number;
    errors: number;
    checkpoints: number;
    rollbacks: number;
  };
  iterations: IterationData[];
  cost: CostSummary;
  analysis: {
    avgIterationDuration: number;
    successRate: number;
  };
}
```

## MetricsTracker Class

```typescript
/**
 * Metrics tracker class for basic orchestration metrics.
 *
 * @example
 * ```typescript
 * const metrics = new MetricsTracker();
 * metrics.recordIteration(true);
 * metrics.recordCheckpoint();
 *
 * console.log(metrics.getSuccessRate()); // 1.0
 * console.log(metrics.toJson());
 * ```
 */
class MetricsTracker {
  constructor();

  /**
   * Record an iteration result.
   *
   * @param success - Whether the iteration was successful
   *
   * @example
   * ```typescript
   * metrics.recordIteration(true);
   * metrics.recordIteration(false);
   * ```
   */
  recordIteration(success: boolean): void;

  /**
   * Record an error.
   *
   * @example
   * ```typescript
   * try {
   *   await execute();
   * } catch {
   *   metrics.recordError();
   * }
   * ```
   */
  recordError(): void;

  /**
   * Record a checkpoint creation.
   *
   * @example
   * ```typescript
   * await createCheckpoint(iteration);
   * metrics.recordCheckpoint();
   * ```
   */
  recordCheckpoint(): void;

  /**
   * Record a rollback operation.
   *
   * @example
   * ```typescript
   * await rollback(commitHash);
   * metrics.recordRollback();
   * ```
   */
  recordRollback(): void;

  /**
   * Get elapsed time in seconds since start.
   *
   * @returns Elapsed time in seconds
   */
  getElapsedSeconds(): number;

  /**
   * Get elapsed time in hours since start.
   *
   * @returns Elapsed time in hours
   */
  getElapsedHours(): number;

  /**
   * Get success rate (0-1).
   *
   * @returns Success rate as decimal
   *
   * @example
   * ```typescript
   * const rate = metrics.getSuccessRate();
   * console.log(`Success rate: ${(rate * 100).toFixed(1)}%`);
   * ```
   */
  getSuccessRate(): number;

  /**
   * Get current metrics snapshot.
   *
   * @returns Copy of current metrics
   */
  getMetrics(): Metrics;

  /**
   * Convert to dictionary for serialization.
   *
   * @returns Metrics as plain object
   */
  toDict(): Record<string, unknown>;

  /**
   * Convert to JSON string.
   *
   * @returns Pretty-printed JSON
   */
  toJson(): string;

  /**
   * Reset all metrics.
   */
  reset(): void;
}
```

## CostTracker Class

```typescript
/**
 * Cost tracking for AI agent usage.
 *
 * @example
 * ```typescript
 * const costTracker = new CostTracker();
 * costTracker.addUsage('claude', 1000, 500);
 *
 * const summary = costTracker.getSummary();
 * console.log(`Total cost: $${summary.totalCost.toFixed(4)}`);
 * ```
 */
class CostTracker {
  constructor();

  /**
   * Add token usage and calculate cost.
   *
   * @param tool - Tool/agent name
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   *
   * @example
   * ```typescript
   * costTracker.addUsage('claude', inputTokens, outputTokens);
   * ```
   */
  addUsage(tool: string, inputTokens: number, outputTokens: number): void;

  /**
   * Get total accumulated cost.
   *
   * @returns Total cost in USD
   */
  getTotalCost(): number;

  /**
   * Get cost summary.
   *
   * @returns Cost breakdown by tool
   */
  getSummary(): CostSummary;

  /**
   * Estimate cost for given tokens.
   *
   * @param tool - Tool/agent name
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Estimated cost in USD
   *
   * @example
   * ```typescript
   * const estimated = CostTracker.estimateCost('claude', 1000, 500);
   * console.log(`Estimated: $${estimated.toFixed(4)}`);
   * ```
   */
  static estimateCost(tool: string, inputTokens: number, outputTokens: number): number;
}
```

## IterationStats Class

```typescript
/**
 * Track detailed iteration statistics.
 *
 * @example
 * ```typescript
 * const stats = new IterationStats(1000, 500);
 *
 * stats.recordStart(1);
 * // ... perform iteration ...
 * stats.recordIteration({
 *   iteration: 1,
 *   duration: 45.5,
 *   success: true,
 *   error: '',
 *   triggerReason: TriggerReason.INITIAL,
 *   outputPreview: 'Output...',
 *   tokensUsed: 1500,
 *   cost: 0.015,
 * });
 *
 * console.log(stats.toSummary());
 * ```
 */
class IterationStats {
  /**
   * Current iteration number
   */
  currentIteration: number;

  /**
   * Create iteration stats tracker.
   *
   * @param maxIterations - Maximum iterations limit
   * @param outputPreviewLength - Length for output preview
   */
  constructor(maxIterations: number, outputPreviewLength?: number);

  /**
   * Record the start of an iteration.
   *
   * @param iteration - Iteration number
   */
  recordStart(iteration: number): void;

  /**
   * Record iteration completion.
   *
   * @param data - Iteration data to record
   */
  recordIteration(data: Partial<IterationData>): void;

  /**
   * Get summary statistics.
   *
   * @returns Summary of all iterations
   */
  toSummary(): IterationStatsSummary;

  /**
   * Get all iteration data.
   *
   * @returns Array of iteration records
   */
  getIterations(): IterationData[];
}
```

## Utility Functions

### Metrics Helpers

```typescript
/**
 * Create default metrics object.
 *
 * @returns Fresh metrics with current timestamp
 */
function createMetrics(): Metrics;

/**
 * Calculate elapsed time in hours.
 *
 * @param metrics - Metrics object
 * @returns Elapsed hours
 */
function elapsedHours(metrics: Metrics): number;

/**
 * Calculate success rate (0-1).
 *
 * @param metrics - Metrics object
 * @returns Success rate as decimal
 */
function successRate(metrics: Metrics): number;

/**
 * Convert metrics to dictionary.
 *
 * @param metrics - Metrics object
 * @returns Plain object representation
 */
function metricsToDict(metrics: Metrics): Record<string, unknown>;
```

## Export Functions

### JSON Export

```typescript
/**
 * Export metrics to JSON file.
 *
 * @param metrics - Metrics to export
 * @param outputFile - Output file path
 *
 * @example
 * ```typescript
 * const metrics = tracker.toDict();
 * await Bun.write('metrics.json', JSON.stringify(metrics, null, 2));
 * ```
 */
```

### CSV Export

```typescript
/**
 * Export iteration data to CSV.
 *
 * @param iterations - Iteration data array
 * @param outputFile - Output file path
 *
 * @example
 * ```typescript
 * import { stringify } from 'csv-stringify/sync';
 *
 * const iterations = stats.getIterations();
 * const csv = stringify(iterations, { header: true });
 * await Bun.write('iterations.csv', csv);
 * ```
 */
```

## Usage from Orchestrator

The `RalphOrchestrator` class provides methods to access metrics:

```typescript
import { RalphOrchestrator } from 'ralph-orchestrator-ts';

const orchestrator = new RalphOrchestrator(config);
await orchestrator.run();

// Get basic metrics
const metrics = orchestrator.getMetrics();
console.log(`Iterations: ${metrics.iterations}`);
console.log(`Success rate: ${metrics.successRate}`);

// Get iteration statistics
const stats = orchestrator.getIterationStats();
console.log(`Total: ${stats.total}`);
console.log(`Successes: ${stats.successes}`);
console.log(`Runtime: ${stats.runtime}`);

// Get cost summary
const costs = orchestrator.getCostSummary();
console.log(`Total cost: $${costs.totalCost.toFixed(4)}`);
console.log(`By tool:`, costs.costsByTool);
```

## Complete Example

```typescript
import {
  MetricsTracker,
  CostTracker,
  IterationStats,
  TriggerReason,
} from 'ralph-orchestrator-ts';

// Initialize trackers
const metrics = new MetricsTracker();
const costTracker = new CostTracker();
const iterationStats = new IterationStats(100, 500);

// Track iterations
for (let i = 1; i <= 10; i++) {
  iterationStats.recordStart(i);

  const startTime = Date.now();

  try {
    // Simulate execution
    const result = await executeIteration(i);
    const duration = (Date.now() - startTime) / 1000;

    // Record success
    metrics.recordIteration(true);
    costTracker.addUsage('claude', result.inputTokens, result.outputTokens);

    iterationStats.recordIteration({
      iteration: i,
      duration,
      success: true,
      error: '',
      triggerReason: i === 1 ? TriggerReason.INITIAL : TriggerReason.PREVIOUS_SUCCESS,
      outputPreview: result.output.substring(0, 500),
      tokensUsed: result.inputTokens + result.outputTokens,
      cost: CostTracker.estimateCost('claude', result.inputTokens, result.outputTokens),
    });

    // Checkpoint every 5 iterations
    if (i % 5 === 0) {
      await createCheckpoint(i);
      metrics.recordCheckpoint();
    }
  } catch (error) {
    metrics.recordIteration(false);
    metrics.recordError();

    iterationStats.recordIteration({
      iteration: i,
      duration: (Date.now() - startTime) / 1000,
      success: false,
      error: error.message,
      triggerReason: TriggerReason.RECOVERY,
    });
  }
}

// Generate report
console.log('=== Metrics Report ===');
console.log(`Total Iterations: ${metrics.getMetrics().iterations}`);
console.log(`Success Rate: ${(metrics.getSuccessRate() * 100).toFixed(1)}%`);
console.log(`Runtime: ${iterationStats.toSummary().runtime}`);
console.log(`Total Cost: $${costTracker.getTotalCost().toFixed(4)}`);

// Export to file
const report = {
  metrics: metrics.toDict(),
  iterations: iterationStats.getIterations(),
  costs: costTracker.getSummary(),
};

await Bun.write('metrics-report.json', JSON.stringify(report, null, 2));
```

## See Also

- [Orchestrator API](orchestrator.md)
- [Configuration API](config.md)
- [Agents API](agents.md)
