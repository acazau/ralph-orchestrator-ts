/**
 * Configuration management and validation for Ralph Orchestrator
 */

import {
	type RalphConfig,
	VALIDATION_THRESHOLDS,
	createDefaultConfig,
} from "./types/index.ts";
import { loadConfigFromYaml } from "./utils/yaml.ts";

/**
 * Validation error
 */
export interface ValidationError {
	field: string;
	message: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
	field: string;
	message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

/**
 * Helper to validate numeric fields with optional upper limit
 */
function validateNumericField(
	value: number,
	field: string,
	displayName: string,
	maxLimit?: number,
	unit?: string,
): ValidationError[] {
	if (value < 0) {
		return [{ field, message: `${displayName} must be non-negative` }];
	}
	if (maxLimit !== undefined && value > maxLimit) {
		const limitStr = unit ? `${maxLimit}${unit}` : maxLimit.toString();
		return [{ field, message: `${displayName} exceeds limit (${limitStr})` }];
	}
	return [];
}

/**
 * Config validator class
 */
export class ConfigValidator {
	static validateMaxIterations(maxIterations: number): ValidationError[] {
		return validateNumericField(
			maxIterations,
			"maxIterations",
			"Max iterations",
			VALIDATION_THRESHOLDS.MAX_ITERATIONS_LIMIT,
		);
	}

	static validateMaxRuntime(maxRuntime: number): ValidationError[] {
		return validateNumericField(
			maxRuntime,
			"maxRuntime",
			"Max runtime",
			VALIDATION_THRESHOLDS.MAX_RUNTIME_LIMIT,
			"s",
		);
	}

	static validateCheckpointInterval(
		checkpointInterval: number,
	): ValidationError[] {
		return validateNumericField(
			checkpointInterval,
			"checkpointInterval",
			"Checkpoint interval",
		);
	}

	static validateRetryDelay(retryDelay: number): ValidationError[] {
		return validateNumericField(
			retryDelay,
			"retryDelay",
			"Retry delay",
			VALIDATION_THRESHOLDS.LARGE_DELAY_THRESHOLD_SECONDS,
			"s",
		);
	}

	static validateMaxTokens(maxTokens: number): ValidationError[] {
		return validateNumericField(
			maxTokens,
			"maxTokens",
			"Max tokens",
			VALIDATION_THRESHOLDS.MAX_TOKENS_LIMIT,
		);
	}

	static validateMaxCost(maxCost: number): ValidationError[] {
		return validateNumericField(
			maxCost,
			"maxCost",
			"Max cost",
			VALIDATION_THRESHOLDS.MAX_COST_LIMIT,
			" dollars",
		);
	}

	/**
	 * Validate context threshold
	 */
	static validateContextThreshold(contextThreshold: number): ValidationError[] {
		const errors: ValidationError[] = [];

		if (contextThreshold < 0 || contextThreshold > 1) {
			errors.push({
				field: "contextThreshold",
				message: "Context threshold must be between 0.0 and 1.0",
			});
		}

		return errors;
	}

	/**
	 * Validate prompt file exists
	 */
	static async validatePromptFile(
		promptFile: string,
	): Promise<ValidationError[]> {
		const errors: ValidationError[] = [];
		const file = Bun.file(promptFile);

		if (!(await file.exists())) {
			errors.push({
				field: "promptFile",
				message: `Prompt file not found: ${promptFile}`,
			});
		}

		return errors;
	}

	/**
	 * Get warning for large delay
	 */
	static getWarningLargeDelay(retryDelay: number): ValidationWarning[] {
		if (retryDelay > VALIDATION_THRESHOLDS.LARGE_DELAY_THRESHOLD_SECONDS) {
			return [
				{
					field: "retryDelay",
					message: `Retry delay is very large (${retryDelay}s = ${(retryDelay / 60).toFixed(1)}m). Did you mean to use minutes instead of seconds?`,
				},
			];
		}
		return [];
	}

	/**
	 * Get warning for single iteration
	 */
	static getWarningSingleIteration(maxIterations: number): ValidationWarning[] {
		if (maxIterations === 1) {
			return [
				{
					field: "maxIterations",
					message:
						"max_iterations is 1. Ralph is designed for continuous loops. Did you mean 0 (infinite)?",
				},
			];
		}
		return [];
	}

	/**
	 * Get warning for short timeout
	 */
	static getWarningShortTimeout(maxRuntime: number): ValidationWarning[] {
		if (
			maxRuntime > 0 &&
			maxRuntime < VALIDATION_THRESHOLDS.SHORT_TIMEOUT_THRESHOLD_SECONDS
		) {
			return [
				{
					field: "maxRuntime",
					message: `Max runtime is very short (${maxRuntime}s). AI iterations typically take ${VALIDATION_THRESHOLDS.TYPICAL_AI_ITERATION_MIN_SECONDS}-${VALIDATION_THRESHOLDS.TYPICAL_AI_ITERATION_MAX_SECONDS} seconds.`,
				},
			];
		}
		return [];
	}

	/**
	 * Validate entire configuration
	 */
	static validate(config: RalphConfig): ValidationResult {
		const errors: ValidationError[] = [
			...this.validateMaxIterations(config.maxIterations),
			...this.validateMaxRuntime(config.maxRuntime),
			...this.validateCheckpointInterval(config.checkpointInterval),
			...this.validateRetryDelay(config.retryDelay),
			...this.validateMaxTokens(config.maxTokens),
			...this.validateMaxCost(config.maxCost),
			...this.validateContextThreshold(config.contextThreshold),
		];

		const warnings: ValidationWarning[] = [
			...this.getWarningLargeDelay(config.retryDelay),
			...this.getWarningSingleIteration(config.maxIterations),
			...this.getWarningShortTimeout(config.maxRuntime),
		];

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Validate configuration including async checks (file existence, etc.)
	 */
	static async validateAsync(config: RalphConfig): Promise<ValidationResult> {
		const syncResult = this.validate(config);

		// Add async validations if no prompt text is provided
		if (!config.promptText) {
			const promptFileErrors = await this.validatePromptFile(config.promptFile);
			syncResult.errors.push(...promptFileErrors);
		}

		return {
			valid: syncResult.errors.length === 0,
			errors: syncResult.errors,
			warnings: syncResult.warnings,
		};
	}
}

/**
 * Load and validate configuration
 */
export async function loadConfig(
	configPath?: string,
	overrides?: Partial<RalphConfig>,
): Promise<{ config: RalphConfig; validation: ValidationResult }> {
	let config: RalphConfig;

	if (configPath) {
		config = await loadConfigFromYaml(configPath);
	} else {
		config = createDefaultConfig();
	}

	// Apply overrides
	if (overrides) {
		config = { ...config, ...overrides };
	}

	const validation = await ConfigValidator.validateAsync(config);

	return { config, validation };
}

/**
 * Create configuration from CLI arguments
 */
export function createConfigFromArgs(args: {
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
}): RalphConfig {
	return createDefaultConfig({
		agent: args.agent as RalphConfig["agent"],
		promptFile: args.prompt,
		promptText: args.promptText,
		maxIterations: args.maxIterations,
		maxRuntime: args.maxRuntime,
		checkpointInterval: args.checkpointInterval,
		retryDelay: args.retryDelay,
		maxTokens: args.maxTokens,
		maxCost: args.maxCost,
		contextWindow: args.contextWindow,
		contextThreshold: args.contextThreshold,
		metricsInterval: args.metricsInterval,
		enableMetrics: args.noMetrics !== true,
		maxPromptSize: args.maxPromptSize,
		allowUnsafePaths: args.allowUnsafePaths,
		gitCheckpoint: args.noGit !== true,
		archivePrompts: args.noArchive !== true,
		verbose: args.verbose,
		dryRun: args.dryRun,
		outputFormat: args.outputFormat as RalphConfig["outputFormat"],
		outputVerbosity: args.outputVerbosity as RalphConfig["outputVerbosity"],
		showTokenUsage: args.noTokenUsage !== true,
		showTimestamps: args.noTimestamps !== true,
		agentArgs: args.agentArgs,
		acpAgent: args.acpAgent,
		acpPermissionMode: args.acpPermissionMode,
	});
}
