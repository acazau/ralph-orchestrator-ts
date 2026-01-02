# Configuration API Reference

## Overview

The Configuration API provides methods for managing Ralph Orchestrator settings, including agent selection, runtime limits, and behavior customization.

## Configuration Types

### RalphConfig Interface

```typescript
/**
 * Main configuration for Ralph Orchestrator
 */
interface RalphConfig {
  // Core configuration
  agent: AgentType;
  promptFile: string;
  promptText?: string;
  maxIterations: number;
  maxRuntime: number;
  checkpointInterval: number;
  retryDelay: number;
  archivePrompts: boolean;
  gitCheckpoint: boolean;
  verbose: boolean;
  dryRun: boolean;
  maxTokens: number;
  maxCost: number;
  contextWindow: number;
  contextThreshold: number;
  metricsInterval: number;
  enableMetrics: boolean;
  maxPromptSize: number;
  allowUnsafePaths: boolean;
  agentArgs: string[];
  adapters: Record<string, AdapterConfig>;

  // Output formatting
  outputFormat: OutputFormat;
  outputVerbosity: OutputVerbosity;
  showTokenUsage: boolean;
  showTimestamps: boolean;

  // Telemetry
  iterationTelemetry: boolean;
  outputPreviewLength: number;

  // ACP-specific
  acpAgent?: string;
  acpPermissionMode?: string;
}
```

### AgentType Enum

```typescript
/**
 * Supported AI agent types
 */
enum AgentType {
  CLAUDE = 'claude',
  Q = 'q',
  GEMINI = 'gemini',
  ACP = 'acp',
  AUTO = 'auto',
}
```

### Output Types

```typescript
/**
 * Output format options
 */
type OutputFormat = 'plain' | 'rich' | 'json';

/**
 * Output verbosity levels
 */
type OutputVerbosity = 'quiet' | 'normal' | 'verbose' | 'debug';
```

### AdapterConfig Interface

```typescript
/**
 * Configuration for individual adapters
 */
interface AdapterConfig {
  enabled: boolean;
  args: string[];
  env: Record<string, string>;
  timeout: number;
  maxRetries: number;
  toolPermissions: Record<string, unknown>;
}
```

## Default Configuration

```typescript
/**
 * Configuration defaults
 */
const CONFIG_DEFAULTS = {
  MAX_ITERATIONS: 100,
  MAX_RUNTIME: 14400,              // 4 hours
  PROMPT_FILE: 'PROMPT.md',
  CHECKPOINT_INTERVAL: 5,
  RETRY_DELAY: 2,
  MAX_TOKENS: 1000000,             // 1M tokens total
  MAX_COST: 50.0,                  // $50 USD
  CONTEXT_WINDOW: 200000,          // 200K token context window
  CONTEXT_THRESHOLD: 0.8,          // 80% trigger for summarization
  METRICS_INTERVAL: 10,            // Log metrics every 10 iterations
  MAX_PROMPT_SIZE: 10485760,       // 10MB max prompt file size
  OUTPUT_PREVIEW_LENGTH: 500,
} as const;

/**
 * Default adapter configuration
 */
const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
  enabled: true,
  args: [],
  env: {},
  timeout: 300,
  maxRetries: 3,
  toolPermissions: {},
};
```

## Configuration Functions

### createDefaultConfig

```typescript
/**
 * Create a default configuration with optional overrides.
 *
 * @param options - Partial configuration to merge with defaults
 * @returns Complete RalphConfig object
 *
 * @example
 * ```typescript
 * // Default config
 * const config = createDefaultConfig();
 *
 * // With overrides
 * const config = createDefaultConfig({
 *   agent: AgentType.CLAUDE,
 *   maxIterations: 50,
 *   verbose: true,
 * });
 * ```
 */
function createDefaultConfig(options?: Partial<RalphConfig>): RalphConfig;
```

### loadConfig

```typescript
/**
 * Load and validate configuration from a file.
 *
 * @param configPath - Path to YAML configuration file
 * @param overrides - Optional overrides to apply
 * @returns Configuration and validation result
 *
 * @example
 * ```typescript
 * const { config, validation } = await loadConfig('ralph.yml');
 *
 * if (!validation.valid) {
 *   console.error('Configuration errors:', validation.errors);
 *   process.exit(1);
 * }
 *
 * // Show warnings
 * for (const warning of validation.warnings) {
 *   console.warn(warning.message);
 * }
 * ```
 */
async function loadConfig(
  configPath?: string,
  overrides?: Partial<RalphConfig>
): Promise<{ config: RalphConfig; validation: ValidationResult }>;
```

### createConfigFromArgs

```typescript
/**
 * Create configuration from CLI arguments.
 *
 * @param args - CLI argument values
 * @returns Complete RalphConfig object
 *
 * @example
 * ```typescript
 * const config = createConfigFromArgs({
 *   agent: 'claude',
 *   prompt: 'PROMPT.md',
 *   maxIterations: 50,
 *   verbose: true,
 *   dryRun: false,
 * });
 * ```
 */
function createConfigFromArgs(args: {
  agent?: string;
  prompt?: string;
  promptText?: string;
  maxIterations?: number;
  maxRuntime?: number;
  checkpointInterval?: number;
  retryDelay?: number;
  maxTokens?: number;
  maxCost?: number;
  contextWindow?: number;
  contextThreshold?: number;
  metricsInterval?: number;
  noMetrics?: boolean;
  maxPromptSize?: number;
  allowUnsafePaths?: boolean;
  noGit?: boolean;
  noArchive?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  outputFormat?: string;
  outputVerbosity?: string;
  noTokenUsage?: boolean;
  noTimestamps?: boolean;
  agentArgs?: string[];
  acpAgent?: string;
  acpPermissionMode?: string;
}): RalphConfig;
```

## Configuration Validation

### ConfigValidator Class

```typescript
/**
 * Configuration validator with static methods.
 */
class ConfigValidator {
  /**
   * Validate entire configuration (synchronous).
   *
   * @param config - Configuration to validate
   * @returns Validation result with errors and warnings
   *
   * @example
   * ```typescript
   * const result = ConfigValidator.validate(config);
   * if (!result.valid) {
   *   for (const error of result.errors) {
   *     console.error(`${error.field}: ${error.message}`);
   *   }
   * }
   * ```
   */
  static validate(config: RalphConfig): ValidationResult;

  /**
   * Validate configuration including async checks.
   *
   * @param config - Configuration to validate
   * @returns Validation result including file existence checks
   *
   * @example
   * ```typescript
   * const result = await ConfigValidator.validateAsync(config);
   * ```
   */
  static async validateAsync(config: RalphConfig): Promise<ValidationResult>;

  // Individual validators
  static validateMaxIterations(maxIterations: number): ValidationError[];
  static validateMaxRuntime(maxRuntime: number): ValidationError[];
  static validateCheckpointInterval(checkpointInterval: number): ValidationError[];
  static validateRetryDelay(retryDelay: number): ValidationError[];
  static validateMaxTokens(maxTokens: number): ValidationError[];
  static validateMaxCost(maxCost: number): ValidationError[];
  static validateContextThreshold(contextThreshold: number): ValidationError[];
  static async validatePromptFile(promptFile: string): Promise<ValidationError[]>;

  // Warning generators
  static getWarningLargeDelay(retryDelay: number): ValidationWarning[];
  static getWarningSingleIteration(maxIterations: number): ValidationWarning[];
  static getWarningShortTimeout(maxRuntime: number): ValidationWarning[];
}
```

### ValidationResult Interface

```typescript
/**
 * Result of configuration validation
 */
interface ValidationResult {
  /** Whether configuration is valid (no errors) */
  valid: boolean;

  /** List of validation errors */
  errors: ValidationError[];

  /** List of validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation warning
 */
interface ValidationWarning {
  field: string;
  message: string;
}
```

### Validation Thresholds

```typescript
/**
 * Validation thresholds for configuration
 */
const VALIDATION_THRESHOLDS = {
  LARGE_DELAY_THRESHOLD_SECONDS: 3600,        // 1 hour
  SHORT_TIMEOUT_THRESHOLD_SECONDS: 10,        // Very short timeout
  TYPICAL_AI_ITERATION_MIN_SECONDS: 30,       // Typical minimum time
  TYPICAL_AI_ITERATION_MAX_SECONDS: 300,      // Typical maximum time
  MAX_ITERATIONS_LIMIT: 100000,
  MAX_RUNTIME_LIMIT: 604800,                  // 1 week in seconds
  MAX_TOKENS_LIMIT: 100000000,                // 100M tokens
  MAX_COST_LIMIT: 10000.0,                    // $10K USD
} as const;
```

## Token Costs

```typescript
/**
 * Token costs per million (approximate)
 */
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  claude: { input: 3.0, output: 15.0 },   // Claude 3.5 Sonnet
  q: { input: 0.5, output: 1.5 },         // Estimated
  gemini: { input: 0.5, output: 1.5 },    // Gemini Pro
};
```

## YAML Configuration File

### Schema

```yaml
# ralph.yml
agent: auto                    # claude, q, gemini, acp, auto
promptFile: PROMPT.md
maxIterations: 100
maxRuntime: 14400              # 4 hours
checkpointInterval: 5
retryDelay: 2
archivePrompts: true
gitCheckpoint: true
verbose: false
dryRun: false
maxTokens: 1000000
maxCost: 50.0
contextWindow: 200000
contextThreshold: 0.8
metricsInterval: 10
enableMetrics: true
maxPromptSize: 10485760
allowUnsafePaths: false

# Output formatting
outputFormat: rich             # plain, rich, json
outputVerbosity: normal        # quiet, normal, verbose, debug
showTokenUsage: true
showTimestamps: true

# Telemetry
iterationTelemetry: true
outputPreviewLength: 500

# ACP configuration
acpAgent: gemini
acpPermissionMode: auto_approve

# Adapter-specific configuration
adapters:
  claude:
    enabled: true
    timeout: 300
    maxRetries: 3
    args: []
    env: {}
  gemini:
    enabled: true
    timeout: 300
    maxRetries: 3
  q:
    enabled: true
    timeout: 300
```

### Configuration Templates

#### Development Template

```yaml
# ralph.dev.yml
agent: auto
maxIterations: 50
maxRuntime: 3600               # 1 hour
checkpointInterval: 10
verbose: true
dryRun: false
gitCheckpoint: true
archivePrompts: true
outputFormat: rich
outputVerbosity: verbose
```

#### Production Template

```yaml
# ralph.prod.yml
agent: claude
maxIterations: 100
maxRuntime: 14400              # 4 hours
checkpointInterval: 5
retryDelay: 5
maxCost: 100.0
verbose: false
dryRun: false
gitCheckpoint: true
archivePrompts: true
outputFormat: json
outputVerbosity: normal
```

#### Testing Template

```yaml
# ralph.test.yml
agent: auto
maxIterations: 10
maxRuntime: 600                # 10 minutes
checkpointInterval: 1
verbose: true
dryRun: true
gitCheckpoint: false
archivePrompts: false
outputFormat: plain
outputVerbosity: debug
```

## Usage Examples

### Basic Usage

```typescript
import { createDefaultConfig, AgentType } from 'ralph-orchestrator-ts';

// Create default configuration
const config = createDefaultConfig();

// Create with overrides
const config = createDefaultConfig({
  agent: AgentType.CLAUDE,
  maxIterations: 50,
  verbose: true,
});

console.log(`Using agent: ${config.agent}`);
console.log(`Max iterations: ${config.maxIterations}`);
```

### Load from File

```typescript
import { loadConfig } from 'ralph-orchestrator-ts';

// Load configuration
const { config, validation } = await loadConfig('ralph.yml');

// Check for errors
if (!validation.valid) {
  for (const error of validation.errors) {
    console.error(`${error.field}: ${error.message}`);
  }
  process.exit(1);
}

// Show warnings
for (const warning of validation.warnings) {
  console.warn(`Warning: ${warning.message}`);
}
```

### From CLI Arguments

```typescript
import { createConfigFromArgs, ConfigValidator } from 'ralph-orchestrator-ts';

// Parse from CLI args
const config = createConfigFromArgs({
  agent: 'claude',
  prompt: 'TASK.md',
  maxIterations: 25,
  maxCost: 10,
  verbose: true,
});

// Validate
const result = ConfigValidator.validate(config);
if (!result.valid) {
  throw new Error('Invalid configuration');
}
```

### Merge Multiple Sources

```typescript
import { createDefaultConfig, loadConfig } from 'ralph-orchestrator-ts';

// Start with defaults
let config = createDefaultConfig();

// Merge from file if exists
try {
  const { config: fileConfig } = await loadConfig('ralph.yml');
  config = { ...config, ...fileConfig };
} catch {
  // File doesn't exist, use defaults
}

// Apply environment overrides
if (process.env.RALPH_MAX_ITERATIONS) {
  config.maxIterations = parseInt(process.env.RALPH_MAX_ITERATIONS, 10);
}

// Apply CLI overrides
if (cliArgs.verbose) {
  config.verbose = true;
}
```

### With RalphOrchestrator

```typescript
import { RalphOrchestrator, createDefaultConfig, AgentType } from 'ralph-orchestrator-ts';

const config = createDefaultConfig({
  agent: AgentType.CLAUDE,
  promptFile: 'task.md',
  maxIterations: 50,
  maxCost: 25.0,
});

const orchestrator = new RalphOrchestrator(config);
await orchestrator.run();
```

## See Also

- [CLI Reference](cli.md)
- [Orchestrator API](orchestrator.md)
- [Agents API](agents.md)
- [Metrics API](metrics.md)
