/**
 * YAML configuration utilities for Ralph Orchestrator
 */

import yaml from "js-yaml";
import {
	type AdapterConfig,
	AgentType,
	DEFAULT_ADAPTER_CONFIG,
	type RalphConfig,
	createDefaultConfig,
} from "../types/index.ts";

// Type-safe value extractors to reduce cognitive complexity
type ConfigData = Record<string, unknown>;

function getString(data: ConfigData, key: string): string | undefined {
	const value = data[key];
	return typeof value === "string" ? value : undefined;
}

function getNumber(data: ConfigData, key: string): number | undefined {
	const value = data[key];
	return typeof value === "number" ? value : undefined;
}

function getBoolean(data: ConfigData, key: string): boolean | undefined {
	const value = data[key];
	return typeof value === "boolean" ? value : undefined;
}

function getStringArray(data: ConfigData, key: string): string[] | undefined {
	const value = data[key];
	return Array.isArray(value) ? value : undefined;
}

function parseAgentType(data: ConfigData): AgentType {
	const agentStr = getString(data, "agent");
	if (!agentStr) return AgentType.AUTO;

	const agentValue = agentStr.toLowerCase();
	return Object.values(AgentType).includes(agentValue as AgentType)
		? (agentValue as AgentType)
		: AgentType.AUTO;
}

function parseAdapters(data: ConfigData): Record<string, AdapterConfig> {
	const adapters: Record<string, AdapterConfig> = {};
	const adaptersData = data.adapters;

	if (!adaptersData || typeof adaptersData !== "object") {
		return adapters;
	}

	for (const [name, adapterData] of Object.entries(
		adaptersData as ConfigData,
	)) {
		adapters[name] = parseAdapterConfig(adapterData);
	}
	return adapters;
}

function parseAdapterConfig(adapterData: unknown): AdapterConfig {
	if (typeof adapterData === "boolean") {
		return { ...DEFAULT_ADAPTER_CONFIG, enabled: adapterData };
	}
	if (typeof adapterData === "object" && adapterData !== null) {
		return {
			...DEFAULT_ADAPTER_CONFIG,
			...(adapterData as Partial<AdapterConfig>),
		};
	}
	return DEFAULT_ADAPTER_CONFIG;
}

/**
 * Load configuration from YAML file
 */
export async function loadConfigFromYaml(
	configPath: string,
): Promise<RalphConfig> {
	const file = Bun.file(configPath);

	if (!(await file.exists())) {
		throw new Error(`Configuration file not found: ${configPath}`);
	}

	const content = await file.text();
	const data = yaml.load(content) as ConfigData;

	return parseConfig(data);
}

/**
 * Load configuration from YAML string
 */
export function loadConfigFromYamlString(yamlString: string): RalphConfig {
	const data = yaml.load(yamlString) as ConfigData;
	return parseConfig(data);
}

/**
 * Parse raw config data into RalphConfig
 */
function parseConfig(data: ConfigData): RalphConfig {
	return createDefaultConfig({
		agent: parseAgentType(data),
		promptFile: getString(data, "prompt_file"),
		promptText: getString(data, "prompt_text"),
		maxIterations: getNumber(data, "max_iterations"),
		maxRuntime: getNumber(data, "max_runtime"),
		checkpointInterval: getNumber(data, "checkpoint_interval"),
		retryDelay: getNumber(data, "retry_delay"),
		archivePrompts: getBoolean(data, "archive_prompts"),
		gitCheckpoint: getBoolean(data, "git_checkpoint"),
		verbose: getBoolean(data, "verbose"),
		dryRun: getBoolean(data, "dry_run"),
		maxTokens: getNumber(data, "max_tokens"),
		maxCost: getNumber(data, "max_cost"),
		contextWindow: getNumber(data, "context_window"),
		contextThreshold: getNumber(data, "context_threshold"),
		metricsInterval: getNumber(data, "metrics_interval"),
		enableMetrics: getBoolean(data, "enable_metrics"),
		maxPromptSize: getNumber(data, "max_prompt_size"),
		allowUnsafePaths: getBoolean(data, "allow_unsafe_paths"),
		agentArgs: getStringArray(data, "agent_args"),
		adapters: parseAdapters(data),
		outputFormat: getString(data, "output_format") as
			| "plain"
			| "rich"
			| "json"
			| undefined,
		outputVerbosity: getString(data, "output_verbosity") as
			| "quiet"
			| "normal"
			| "verbose"
			| "debug"
			| undefined,
		showTokenUsage: getBoolean(data, "show_token_usage"),
		showTimestamps: getBoolean(data, "show_timestamps"),
		iterationTelemetry: getBoolean(data, "iteration_telemetry"),
		outputPreviewLength: getNumber(data, "output_preview_length"),
		acpAgent: getString(data, "acp_agent"),
		acpPermissionMode: getString(data, "acp_permission_mode"),
	});
}

/**
 * Save configuration to YAML file
 */
export async function saveConfigToYaml(
	config: RalphConfig,
	configPath: string,
): Promise<void> {
	const data = configToYamlData(config);
	const yamlString = yaml.dump(data, {
		indent: 2,
		lineWidth: 120,
		noRefs: true,
	});
	await Bun.write(configPath, yamlString);
}

/**
 * Convert RalphConfig to YAML-friendly object (snake_case keys)
 */
function configToYamlData(config: RalphConfig): Record<string, unknown> {
	return {
		agent: config.agent,
		prompt_file: config.promptFile,
		prompt_text: config.promptText,
		max_iterations: config.maxIterations,
		max_runtime: config.maxRuntime,
		checkpoint_interval: config.checkpointInterval,
		retry_delay: config.retryDelay,
		archive_prompts: config.archivePrompts,
		git_checkpoint: config.gitCheckpoint,
		verbose: config.verbose,
		dry_run: config.dryRun,
		max_tokens: config.maxTokens,
		max_cost: config.maxCost,
		context_window: config.contextWindow,
		context_threshold: config.contextThreshold,
		metrics_interval: config.metricsInterval,
		enable_metrics: config.enableMetrics,
		max_prompt_size: config.maxPromptSize,
		allow_unsafe_paths: config.allowUnsafePaths,
		agent_args: config.agentArgs,
		adapters: config.adapters,
		output_format: config.outputFormat,
		output_verbosity: config.outputVerbosity,
		show_token_usage: config.showTokenUsage,
		show_timestamps: config.showTimestamps,
		iteration_telemetry: config.iterationTelemetry,
		output_preview_length: config.outputPreviewLength,
		acp_agent: config.acpAgent,
		acp_permission_mode: config.acpPermissionMode,
	};
}

/**
 * Generate default ralph.yml content
 */
export function generateDefaultYaml(): string {
	const template = `# Ralph Orchestrator Configuration
# See documentation for full configuration options

# Agent to use (claude, q, gemini, acp, auto)
agent: auto

# Prompt file path
prompt_file: PROMPT.md

# Maximum iterations before stopping
max_iterations: 100

# Maximum runtime in seconds (4 hours)
max_runtime: 14400

# Git checkpoint interval (iterations)
checkpoint_interval: 5

# Retry delay in seconds
retry_delay: 2

# Cost and token limits
max_tokens: 1000000
max_cost: 50.0

# Context management
context_window: 200000
context_threshold: 0.8

# Metrics and telemetry
enable_metrics: true
metrics_interval: 10
iteration_telemetry: true
output_preview_length: 500

# Output formatting
output_format: rich
output_verbosity: normal
show_token_usage: true
show_timestamps: true

# Git and archiving
git_checkpoint: true
archive_prompts: true

# Security
allow_unsafe_paths: false
max_prompt_size: 10485760

# Adapter-specific configuration (optional)
# adapters:
#   claude:
#     enabled: true
#     timeout: 300
#     max_retries: 3
#   gemini:
#     enabled: true
#     timeout: 300
`;

	return template;
}
