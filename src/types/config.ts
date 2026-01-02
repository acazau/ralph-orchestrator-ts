/**
 * Configuration types for Ralph Orchestrator
 */

/**
 * Supported AI agent types
 */
export enum AgentType {
	CLAUDE = "claude",
	Q = "q",
	GEMINI = "gemini",
	ACP = "acp",
	AUTO = "auto",
}

/**
 * Output format options
 */
export type OutputFormat = "plain" | "rich" | "json";

/**
 * Output verbosity levels
 */
export type OutputVerbosity = "quiet" | "normal" | "verbose" | "debug";

/**
 * Configuration for individual adapters
 */
export interface AdapterConfig {
	enabled: boolean;
	args: string[];
	env: Record<string, string>;
	timeout: number;
	maxRetries: number;
	toolPermissions: Record<string, unknown>;
}

/**
 * Default adapter configuration
 */
export const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
	enabled: true,
	args: [],
	env: {},
	timeout: 300,
	maxRetries: 3,
	toolPermissions: {},
};

/**
 * Configuration defaults
 */
export const CONFIG_DEFAULTS = {
	MAX_ITERATIONS: 100,
	MAX_RUNTIME: 14400, // 4 hours
	PROMPT_FILE: "PROMPT.md",
	CHECKPOINT_INTERVAL: 5,
	RETRY_DELAY: 2,
	MAX_TOKENS: 1000000, // 1M tokens total
	MAX_COST: 50, // $50 USD
	CONTEXT_WINDOW: 200000, // 200K token context window
	CONTEXT_THRESHOLD: 0.8, // Trigger summarization at 80% of context
	METRICS_INTERVAL: 10, // Log metrics every 10 iterations
	MAX_PROMPT_SIZE: 10485760, // 10MB max prompt file size
	OUTPUT_PREVIEW_LENGTH: 500,
} as const;

/**
 * Token costs per million (approximate)
 */
export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
	claude: { input: 3, output: 15 }, // Claude 3.5 Sonnet
	q: { input: 0.5, output: 1.5 }, // Estimated
	gemini: { input: 0.5, output: 1.5 }, // Gemini Pro
};

/**
 * SonarQube scanning configuration
 */
export interface SonarQubeConfig {
	enabled: boolean;
	autoStart: boolean;
	scanOnCheckpoint: boolean;
	scanAfterIteration: boolean;
	scanMode: "changed" | "full";
	failOnQualityGate: boolean;
}

/**
 * Main configuration for Ralph Orchestrator
 */
export interface RalphConfig {
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

	// Output formatting configuration
	outputFormat: OutputFormat;
	outputVerbosity: OutputVerbosity;
	showTokenUsage: boolean;
	showTimestamps: boolean;

	// Telemetry configuration
	iterationTelemetry: boolean;
	outputPreviewLength: number;

	// ACP-specific configuration
	acpAgent?: string;
	acpPermissionMode?: string;

	// SonarQube configuration
	sonarqube?: SonarQubeConfig;
}

/**
 * Options for creating a RalphConfig (all optional with defaults)
 */
export type RalphConfigOptions = Partial<RalphConfig>;

/**
 * Create a default configuration
 */
export function createDefaultConfig(
	options: RalphConfigOptions = {},
): RalphConfig {
	return {
		agent: options.agent ?? AgentType.AUTO,
		promptFile: options.promptFile ?? CONFIG_DEFAULTS.PROMPT_FILE,
		promptText: options.promptText,
		maxIterations: options.maxIterations ?? CONFIG_DEFAULTS.MAX_ITERATIONS,
		maxRuntime: options.maxRuntime ?? CONFIG_DEFAULTS.MAX_RUNTIME,
		checkpointInterval:
			options.checkpointInterval ?? CONFIG_DEFAULTS.CHECKPOINT_INTERVAL,
		retryDelay: options.retryDelay ?? CONFIG_DEFAULTS.RETRY_DELAY,
		archivePrompts: options.archivePrompts ?? true,
		gitCheckpoint: options.gitCheckpoint ?? true,
		verbose: options.verbose ?? false,
		dryRun: options.dryRun ?? false,
		maxTokens: options.maxTokens ?? CONFIG_DEFAULTS.MAX_TOKENS,
		maxCost: options.maxCost ?? CONFIG_DEFAULTS.MAX_COST,
		contextWindow: options.contextWindow ?? CONFIG_DEFAULTS.CONTEXT_WINDOW,
		contextThreshold:
			options.contextThreshold ?? CONFIG_DEFAULTS.CONTEXT_THRESHOLD,
		metricsInterval:
			options.metricsInterval ?? CONFIG_DEFAULTS.METRICS_INTERVAL,
		enableMetrics: options.enableMetrics ?? true,
		maxPromptSize: options.maxPromptSize ?? CONFIG_DEFAULTS.MAX_PROMPT_SIZE,
		allowUnsafePaths: options.allowUnsafePaths ?? false,
		agentArgs: options.agentArgs ?? [],
		adapters: options.adapters ?? {},
		outputFormat: options.outputFormat ?? "rich",
		outputVerbosity: options.outputVerbosity ?? "normal",
		showTokenUsage: options.showTokenUsage ?? true,
		showTimestamps: options.showTimestamps ?? true,
		iterationTelemetry: options.iterationTelemetry ?? true,
		outputPreviewLength:
			options.outputPreviewLength ?? CONFIG_DEFAULTS.OUTPUT_PREVIEW_LENGTH,
		acpAgent: options.acpAgent,
		acpPermissionMode: options.acpPermissionMode,
		sonarqube: options.sonarqube,
	};
}

/**
 * Validation thresholds for configuration
 */
export const VALIDATION_THRESHOLDS = {
	LARGE_DELAY_THRESHOLD_SECONDS: 3600, // 1 hour
	SHORT_TIMEOUT_THRESHOLD_SECONDS: 10, // Very short timeout
	TYPICAL_AI_ITERATION_MIN_SECONDS: 30, // Typical minimum time for AI iteration
	TYPICAL_AI_ITERATION_MAX_SECONDS: 300, // Typical maximum time for AI iteration
	MAX_ITERATIONS_LIMIT: 100000,
	MAX_RUNTIME_LIMIT: 604800, // 1 week in seconds
	MAX_TOKENS_LIMIT: 100000000, // 100M tokens
	MAX_COST_LIMIT: 10000, // $10K USD
} as const;
