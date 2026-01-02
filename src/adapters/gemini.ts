/**
 * Gemini adapter for Ralph Orchestrator
 * Uses the Gemini CLI tool for execution
 */

import { CostTracker } from "../metrics/cost-tracker.ts";
import {
	type AdapterConfig,
	type ExecuteOptions,
	type ToolResponse,
	createErrorResponse,
	createSuccessResponse,
} from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import {
	estimateTokens,
	extractErrorMessage,
	mergeAdditionalArgs,
} from "../utils/shared.ts";
import { ToolAdapter, executeCLICommand } from "./base.ts";

const logger = createLogger("ralph-orchestrator.gemini");

/**
 * Gemini adapter implementation
 */
export class GeminiAdapter extends ToolAdapter {
	private readonly geminiCommand: string = "gemini";

	constructor(config?: Partial<AdapterConfig>) {
		super("gemini", config);
	}

	/**
	 * Check if Gemini CLI is available
	 */
	async checkAvailability(): Promise<boolean> {
		return this.checkCommandExists(
			this.geminiCommand,
			"Gemini CLI not found in PATH",
		);
	}

	/**
	 * Execute Gemini with the given prompt
	 */
	async execute(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse> {
		if (!this.available && !(await this.checkAvailability())) {
			return createErrorResponse("Gemini CLI is not available");
		}

		const enhancedPrompt = this.enhancePromptWithInstructions(prompt);

		// Build command arguments
		const args = this.buildArgs(options);

		logger.debug(`Executing Gemini with ${args.length} arguments`);

		try {
			const result = await executeCLICommand([this.geminiCommand, ...args], {
				timeout: options?.timeout ?? this.config.timeout * 1000,
				env: options?.env,
				stdin: enhancedPrompt,
			});

			if (!result.success) {
				logger.error(`Gemini execution failed: ${result.stderr}`);
				return createErrorResponse(
					result.stderr || `Gemini exited with code ${result.exitCode}`,
					result.stdout,
					{ exitCode: result.exitCode, duration: result.duration },
				);
			}

			logger.debug(
				`Gemini execution completed in ${result.duration.toFixed(2)}s`,
			);

			return createSuccessResponse(result.stdout, {
				metadata: {
					duration: result.duration,
					exitCode: result.exitCode,
					model: options?.model,
				},
			});
		} catch (error) {
			const message = extractErrorMessage(error);
			logger.error(`Gemini execution error: ${message}`);
			return createErrorResponse(message);
		}
	}

	/**
	 * Build command arguments
	 */
	private buildArgs(options?: ExecuteOptions): string[] {
		const args: string[] = [];

		// Add model if specified
		if (options?.model) {
			args.push("--model", options.model);
		}

		// Add verbose flag
		if (options?.verbose) {
			args.push("--verbose");
		}

		// Add additional args from config and options
		mergeAdditionalArgs(args, this.config.args, options?.additionalArgs);

		return args;
	}

	/**
	 * Estimate cost for a prompt
	 */
	override estimateCost(prompt: string): number {
		const inputTokens = estimateTokens(prompt);
		// Assume output is roughly 2x input for estimation
		const outputTokens = inputTokens * 2;

		return CostTracker.estimateCost("gemini", inputTokens, outputTokens);
	}
}
