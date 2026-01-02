# Agents API Reference

## Overview

The Agents API provides interfaces for interacting with different AI agents (Claude, Gemini, Q) and managing agent execution through tool adapters.

## Tool Adapter Interface

### IToolAdapter Interface

```typescript
import type { ToolResponse, ExecuteOptions, AdapterConfig } from '../types';

/**
 * Interface for AI tool adapters.
 *
 * All adapter implementations must implement this interface.
 */
interface IToolAdapter {
  /** Adapter name identifier */
  readonly name: string;

  /** Check if adapter is currently available */
  readonly available: boolean;

  /** Check if the tool is available and properly configured */
  checkAvailability(): Promise<boolean>;

  /** Execute the tool with the given prompt */
  execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse>;

  /** Estimate the cost of executing this prompt */
  estimateCost(prompt: string): number;

  /** Get adapter configuration */
  getConfig(): AdapterConfig;

  /** Update adapter configuration */
  updateConfig(config: Partial<AdapterConfig>): void;
}
```

### Base ToolAdapter Class

```typescript
import type { IToolAdapter, ToolResponse, ExecuteOptions, AdapterConfig } from '../types';

/**
 * Abstract base class for tool adapters.
 *
 * All agent implementations should extend this class
 * and implement the required abstract methods.
 *
 * @example
 * ```typescript
 * const claude = new ClaudeAdapter();
 * if (await claude.checkAvailability()) {
 *   const response = await claude.execute('Build a REST API');
 * }
 * ```
 */
abstract class ToolAdapter implements IToolAdapter {
  readonly name: string;
  protected config: AdapterConfig;

  constructor(name: string, config?: Partial<AdapterConfig>);

  /**
   * Check if the tool is available
   */
  get available(): boolean;

  /**
   * Check if the tool is available and properly configured
   */
  abstract checkAvailability(): Promise<boolean>;

  /**
   * Execute the tool with the given prompt
   */
  abstract execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse>;

  /**
   * Execute the tool with a prompt file
   *
   * @param promptFile - Path to prompt file
   * @param options - Execution options
   * @returns Tool response
   *
   * @example
   * ```typescript
   * const response = await adapter.executeWithFile('PROMPT.md');
   * ```
   */
  async executeWithFile(promptFile: string, options?: ExecuteOptions): Promise<ToolResponse>;

  /**
   * Estimate the cost of executing this prompt
   */
  estimateCost(prompt: string): number;

  /**
   * Enhance prompt with orchestration context and instructions
   */
  protected enhancePromptWithInstructions(prompt: string): string;

  /**
   * Get adapter configuration
   */
  getConfig(): AdapterConfig;

  /**
   * Update adapter configuration
   */
  updateConfig(config: Partial<AdapterConfig>): void;
}
```

## Adapter Implementations

### Claude Adapter

```typescript
import type { ToolResponse, ExecuteOptions, AdapterConfig } from '../types';
import { ToolAdapter } from './base';

/**
 * Claude AI adapter implementation.
 * Uses the Claude CLI tool for execution.
 *
 * @example
 * ```typescript
 * const claude = new ClaudeAdapter();
 * await claude.checkAvailability();
 * const response = await claude.execute('Implement user authentication');
 * ```
 */
class ClaudeAdapter extends ToolAdapter {
  constructor(config?: Partial<AdapterConfig>);

  /**
   * Check if Claude CLI is available
   *
   * @returns True if Claude CLI is in PATH
   */
  async checkAvailability(): Promise<boolean>;

  /**
   * Execute Claude with the given prompt
   *
   * @param prompt - The prompt to execute
   * @param options - Execution options
   * @returns Tool response with output, tokens used, and cost
   *
   * @example
   * ```typescript
   * const claude = new ClaudeAdapter();
   * const response = await claude.execute('Build a REST API', {
   *   model: 'claude-sonnet-4-5-20250929',
   *   verbose: true,
   *   timeout: 300000
   * });
   *
   * if (response.success) {
   *   console.log(response.output);
   * }
   * ```
   */
  async execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse>;

  /**
   * Estimate cost for a prompt
   */
  estimateCost(prompt: string): number;

  /**
   * Get pricing for a specific model
   *
   * @param model - Model identifier
   * @returns Input and output costs per million tokens
   */
  static getPricing(model: string): { input: number; output: number };
}

/**
 * Claude model pricing (per 1M tokens)
 */
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5-20251101': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  default: { input: 3.0, output: 15.0 },
};
```

### Gemini Adapter

```typescript
import type { ToolResponse, ExecuteOptions, AdapterConfig } from '../types';
import { ToolAdapter } from './base';

/**
 * Gemini AI adapter implementation.
 * Uses the Gemini CLI tool for execution.
 *
 * @example
 * ```typescript
 * const gemini = new GeminiAdapter();
 * await gemini.checkAvailability();
 * const response = await gemini.execute('Analyze this codebase');
 * ```
 */
class GeminiAdapter extends ToolAdapter {
  constructor(config?: Partial<AdapterConfig>);

  /**
   * Check if Gemini CLI is available
   *
   * @returns True if Gemini CLI is in PATH
   */
  async checkAvailability(): Promise<boolean>;

  /**
   * Execute Gemini with the given prompt
   *
   * @param prompt - The prompt to execute
   * @param options - Execution options
   * @returns Tool response with output
   *
   * @example
   * ```typescript
   * const gemini = new GeminiAdapter();
   * const response = await gemini.execute('Refactor this function', {
   *   model: 'gemini-pro',
   *   verbose: true
   * });
   * ```
   */
  async execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse>;

  /**
   * Estimate cost for a prompt
   */
  estimateCost(prompt: string): number;
}
```

### Q Chat Adapter

```typescript
import type { ToolResponse, ExecuteOptions, AdapterConfig } from '../types';
import { ToolAdapter } from './base';

/**
 * Q Chat AI adapter implementation.
 * Uses the Q CLI tool for execution.
 *
 * @example
 * ```typescript
 * const q = new QChatAdapter();
 * await q.checkAvailability();
 * const response = await q.execute('Debug this issue');
 * ```
 */
class QChatAdapter extends ToolAdapter {
  constructor(config?: Partial<AdapterConfig>);

  /**
   * Check if Q CLI is available
   *
   * @returns True if Q CLI is in PATH
   */
  async checkAvailability(): Promise<boolean>;

  /**
   * Execute Q with the given prompt
   *
   * @param prompt - The prompt to execute
   * @param options - Execution options
   * @returns Tool response with output (cost is typically 0)
   *
   * @example
   * ```typescript
   * const q = new QChatAdapter();
   * const response = await q.execute('Write unit tests', {
   *   verbose: true
   * });
   * ```
   */
  async execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse>;

  /**
   * Estimate cost for a prompt (Q is typically free)
   */
  estimateCost(prompt: string): number; // Always returns 0
}
```

## Adapter Factory Functions

```typescript
import type { AdapterConfig } from '../types';
import type { ACPAdapterOptions } from './acp';

/**
 * Get a specific adapter by type
 *
 * @param type - Agent type (claude, q, gemini, acp)
 * @param config - Optional adapter configuration
 * @param acpOptions - Optional ACP-specific options
 * @returns Adapter instance or null if not available
 *
 * @example
 * ```typescript
 * const claude = await getAdapter('claude');
 * if (claude) {
 *   const response = await claude.execute(prompt);
 * }
 * ```
 */
async function getAdapter(
  type: string,
  config?: Partial<AdapterConfig>,
  acpOptions?: ACPAdapterOptions
): Promise<ToolAdapter | null>;

/**
 * Auto-detect the best available adapter
 *
 * Priority: claude > gemini > q
 *
 * @param config - Optional adapter configuration
 * @param acpOptions - Optional ACP-specific options
 * @returns Best available adapter
 * @throws Error if no adapters are available
 *
 * @example
 * ```typescript
 * const adapter = await autoDetectAdapter();
 * console.log(`Using: ${adapter.name}`);
 * ```
 */
async function autoDetectAdapter(
  config?: Partial<AdapterConfig>,
  acpOptions?: ACPAdapterOptions
): Promise<ToolAdapter>;
```

## Types

### ExecuteOptions

```typescript
/**
 * Options for adapter execution
 */
interface ExecuteOptions {
  /** Model to use for execution */
  model?: string;

  /** System prompt to prepend */
  systemPrompt?: string;

  /** Tools to allow during execution */
  allowedTools?: string[];

  /** Tools to disallow during execution */
  disallowedTools?: string[];

  /** Enable verbose output */
  verbose?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Additional environment variables */
  env?: Record<string, string>;

  /** Additional CLI arguments */
  additionalArgs?: string[];

  /** Path to prompt file (when using executeWithFile) */
  promptFile?: string;
}
```

### ToolResponse

```typescript
/**
 * Response from tool execution
 */
interface ToolResponse {
  /** Whether execution was successful */
  success: boolean;

  /** Output from the tool */
  output?: string;

  /** Error message if execution failed */
  error?: string;

  /** Number of tokens used */
  tokensUsed?: number;

  /** Cost of execution in USD */
  cost?: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
```

### AdapterConfig

```typescript
/**
 * Configuration for individual adapters
 */
interface AdapterConfig {
  /** Whether the adapter is enabled */
  enabled: boolean;

  /** Additional CLI arguments */
  args: string[];

  /** Environment variables */
  env: Record<string, string>;

  /** Execution timeout in seconds */
  timeout: number;

  /** Maximum retry attempts */
  maxRetries: number;

  /** Tool permission configuration */
  toolPermissions: Record<string, unknown>;
}

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

## Utility Functions

### Command Utilities

```typescript
/**
 * Check if a command exists in PATH
 *
 * @param command - Command to check
 * @returns True if command is available
 *
 * @example
 * ```typescript
 * if (await commandExists('claude')) {
 *   console.log('Claude CLI is available');
 * }
 * ```
 */
async function commandExists(command: string): Promise<boolean>;

/**
 * Execute a command and capture output
 *
 * @param command - Command and arguments array
 * @param options - Execution options
 * @returns Command output and exit code
 *
 * @example
 * ```typescript
 * const result = await executeCommand(['claude', '--print', prompt], {
 *   timeout: 300000,
 *   env: { CLAUDE_API_KEY: 'xxx' }
 * });
 * ```
 */
async function executeCommand(
  command: string[],
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    stdin?: string;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number }>;
```

## Custom Adapter Implementation

```typescript
import type { ToolResponse, ExecuteOptions, AdapterConfig } from '../types';
import { ToolAdapter, commandExists, executeCommand } from './base';

/**
 * Template for implementing custom AI adapters.
 *
 * @example
 * ```typescript
 * class MyCustomAdapter extends ToolAdapter {
 *   constructor(config?: Partial<AdapterConfig>) {
 *     super('myagent', config);
 *   }
 *
 *   async checkAvailability(): Promise<boolean> {
 *     const available = await commandExists('myagent-cli');
 *     this.setAvailable(available);
 *     return available;
 *   }
 *
 *   async execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse> {
 *     const enhancedPrompt = this.enhancePromptWithInstructions(prompt);
 *
 *     const result = await executeCommand(['myagent-cli', enhancedPrompt], {
 *       timeout: options?.timeout ?? this.config.timeout * 1000,
 *     });
 *
 *     if (result.exitCode !== 0) {
 *       return { success: false, error: result.stderr };
 *     }
 *
 *     return { success: true, output: result.stdout };
 *   }
 * }
 * ```
 */
```

## Usage Examples

### Basic Usage

```typescript
import { ClaudeAdapter, autoDetectAdapter } from 'ralph-orchestrator-ts';

// Use specific adapter
const claude = new ClaudeAdapter();
if (await claude.checkAvailability()) {
  const response = await claude.execute('Build a user authentication system');
  if (response.success) {
    console.log(response.output);
    console.log(`Cost: $${response.cost?.toFixed(4)}`);
  }
}

// Auto-detect best adapter
const adapter = await autoDetectAdapter();
console.log(`Using ${adapter.name}`);
const response = await adapter.execute('Refactor this code');
```

### With Configuration

```typescript
import { ClaudeAdapter, type AdapterConfig } from 'ralph-orchestrator-ts';

const config: Partial<AdapterConfig> = {
  timeout: 600, // 10 minutes
  args: ['--verbose'],
  maxRetries: 5,
};

const claude = new ClaudeAdapter(config);
const response = await claude.execute('Complex task', {
  model: 'claude-sonnet-4-5-20250929',
  systemPrompt: 'You are a senior software engineer.',
});
```

### With Fallbacks

```typescript
import { getAdapter, AgentType } from 'ralph-orchestrator-ts';

const adapters = [AgentType.CLAUDE, AgentType.GEMINI, AgentType.Q];
let response: ToolResponse | null = null;

for (const type of adapters) {
  const adapter = await getAdapter(type);
  if (adapter) {
    response = await adapter.execute(prompt);
    if (response.success) {
      console.log(`Succeeded with ${adapter.name}`);
      break;
    }
  }
}
```

## See Also

- [Configuration API](config.md)
- [Orchestrator API](orchestrator.md)
- [Metrics API](metrics.md)
