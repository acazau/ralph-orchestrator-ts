/**
 * Q Chat adapter for Ralph Orchestrator
 * Uses the Q CLI tool for execution
 */

import {
	type AdapterConfig,
	type ExecuteOptions,
	type ToolResponse,
	createErrorResponse,
	createSuccessResponse,
} from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import { extractErrorMessage, mergeAdditionalArgs } from "../utils/shared.ts";
import { ToolAdapter, executeCLICommand } from "./base.ts";

const logger = createLogger("ralph-orchestrator.qchat");

/**
 * Q Chat adapter implementation
 */
export class QChatAdapter extends ToolAdapter {
	private readonly qCommand: string = "q";

	constructor(config?: Partial<AdapterConfig>) {
		super("qchat", config);
	}

	/**
	 * Check if Q CLI is available
	 */
	async checkAvailability(): Promise<boolean> {
		return this.checkCommandExists(this.qCommand, "Q CLI not found in PATH");
	}

	/**
	 * Execute Q with the given prompt
	 */
	async execute(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse> {
		if (!this.available && !(await this.checkAvailability())) {
			return createErrorResponse("Q CLI is not available");
		}

		const enhancedPrompt = this.enhancePromptWithInstructions(prompt);

		// Build command arguments
		const args = this.buildArgs(enhancedPrompt, options);

		logger.debug(`Executing Q with ${args.length} arguments`);

		try {
			const result = await executeCLICommand([this.qCommand, ...args], {
				timeout: options?.timeout ?? this.config.timeout * 1000,
				env: {
					...options?.env,
					// Q-specific environment variables
					RALPH_QCHAT_NO_INTERACTIVE: "true",
					RALPH_QCHAT_TRUST_TOOLS: "true",
				},
			});

			if (!result.success) {
				logger.error(`Q execution failed: ${result.stderr}`);
				return createErrorResponse(
					result.stderr || `Q exited with code ${result.exitCode}`,
					result.stdout,
					{ exitCode: result.exitCode, duration: result.duration },
				);
			}

			logger.debug(`Q execution completed in ${result.duration.toFixed(2)}s`);

			return createSuccessResponse(result.stdout, {
				// Q is typically free/local, so no cost
				cost: 0,
				metadata: {
					duration: result.duration,
					exitCode: result.exitCode,
				},
			});
		} catch (error) {
			const message = extractErrorMessage(error);
			logger.error(`Q execution error: ${message}`);
			return createErrorResponse(message);
		}
	}

	/**
	 * Build command arguments
	 */
	private buildArgs(prompt: string, options?: ExecuteOptions): string[] {
		const args: string[] = [];

		// Add chat subcommand with non-interactive and trust-all-tools flags
		args.push("chat", "--no-interactive", "--trust-all-tools");

		// Add verbose flag
		if (options?.verbose) {
			args.push("--verbose");
		}

		// Add additional args from config and options
		mergeAdditionalArgs(args, this.config.args, options?.additionalArgs);

		// Add the prompt
		args.push("--prompt", prompt);

		return args;
	}

	/**
	 * Estimate cost for a prompt (Q is typically free)
	 */
	override estimateCost(_prompt: string): number {
		return 0;
	}
}
