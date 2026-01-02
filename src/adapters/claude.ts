/**
 * Claude adapter for Ralph Orchestrator
 * Uses the Claude CLI tool for execution
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

const logger = createLogger("ralph-orchestrator.claude");

/**
 * Claude model pricing (per 1M tokens)
 */
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
	"claude-opus-4-5-20251101": { input: 15, output: 75 },
	"claude-sonnet-4-5-20250929": { input: 3, output: 15 },
	"claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
	// Default fallback
	default: { input: 3, output: 15 },
};

/**
 * Claude adapter implementation
 */
export class ClaudeAdapter extends ToolAdapter {
	private readonly claudeCommand: string = "claude";

	constructor(config?: Partial<AdapterConfig>) {
		super("claude", config);
	}

	/**
	 * Check if Claude CLI is available
	 */
	async checkAvailability(): Promise<boolean> {
		return this.checkCommandExists(
			this.claudeCommand,
			"Claude CLI not found in PATH",
		);
	}

	/**
	 * Execute Claude with the given prompt
	 */
	async execute(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse> {
		if (!this.available && !(await this.checkAvailability())) {
			return createErrorResponse("Claude CLI is not available");
		}

		const enhancedPrompt = this.enhancePromptWithInstructions(prompt);

		// Build command arguments
		const args = this.buildArgs(enhancedPrompt, options);

		logger.debug(`Executing Claude with ${args.length} arguments`);

		try {
			const result = await executeCLICommand([this.claudeCommand, ...args], {
				timeout: options?.timeout ?? this.config.timeout * 1000,
				env: options?.env,
			});

			if (!result.success) {
				logger.error(`Claude execution failed: ${result.stderr}`);
				return createErrorResponse(
					result.stderr || `Claude exited with code ${result.exitCode}`,
					result.stdout,
					{ exitCode: result.exitCode, duration: result.duration },
				);
			}

			const tokensUsed = this.extractTokenUsage(result.stdout);
			const cost = tokensUsed
				? CostTracker.estimateCost(
						"claude",
						tokensUsed.input,
						tokensUsed.output,
					)
				: undefined;

			logger.debug(
				`Claude execution completed in ${result.duration.toFixed(2)}s`,
			);

			return createSuccessResponse(result.stdout, {
				tokensUsed: tokensUsed
					? tokensUsed.input + tokensUsed.output
					: undefined,
				cost,
				metadata: {
					duration: result.duration,
					exitCode: result.exitCode,
					model: options?.model,
				},
			});
		} catch (error) {
			const message = extractErrorMessage(error);
			logger.error(`Claude execution error: ${message}`);
			return createErrorResponse(message);
		}
	}

	/**
	 * Build command arguments
	 */
	private buildArgs(prompt: string, options?: ExecuteOptions): string[] {
		const args: string[] = [];

		// Add print mode for non-interactive output
		args.push("--print");

		// Add model if specified
		if (options?.model) {
			args.push("--model", options.model);
		}

		// Add system prompt if specified
		if (options?.systemPrompt) {
			args.push("--system-prompt", options.systemPrompt);
		}

		// Add allowed tools
		if (options?.allowedTools && options.allowedTools.length > 0) {
			args.push("--allowedTools", options.allowedTools.join(","));
		}

		// Add disallowed tools
		if (options?.disallowedTools && options.disallowedTools.length > 0) {
			args.push("--disallowedTools", options.disallowedTools.join(","));
		}

		// Add verbose flag
		if (options?.verbose) {
			args.push("--verbose");
		}

		// Add additional args from config and options
		mergeAdditionalArgs(args, this.config.args, options?.additionalArgs);

		// Add the prompt as the last argument
		args.push(prompt);

		return args;
	}

	/**
	 * Try to extract token usage from output
	 */
	private extractTokenUsage(
		output: string,
	): { input: number; output: number } | null {
		// Look for token usage patterns in output
		const patterns = [
			/input[_\s]?tokens?:\s*(\d+)/i,
			/output[_\s]?tokens?:\s*(\d+)/i,
			/tokens?[_\s]?used:\s*(\d+)/i,
		];

		let inputTokens = 0;
		let outputTokens = 0;

		for (const pattern of patterns) {
			const match = pattern.exec(output);
			if (match?.[1]) {
				const value = Number.parseInt(match[1], 10);
				if (pattern.source.includes("input")) {
					inputTokens = value;
				} else if (pattern.source.includes("output")) {
					outputTokens = value;
				} else {
					// Generic "tokens used" - estimate split
					inputTokens = Math.floor(value * 0.3);
					outputTokens = Math.floor(value * 0.7);
				}
			}
		}

		if (inputTokens > 0 || outputTokens > 0) {
			return { input: inputTokens, output: outputTokens };
		}

		return null;
	}

	/**
	 * Estimate cost for a prompt
	 */
	override estimateCost(prompt: string): number {
		const inputTokens = estimateTokens(prompt);
		// Assume output is roughly 2x input for estimation
		const outputTokens = inputTokens * 2;

		return CostTracker.estimateCost("claude", inputTokens, outputTokens);
	}

	/**
	 * Get pricing for a model
	 */
	static getPricing(model: string): { input: number; output: number } {
		return CLAUDE_PRICING[model] ?? CLAUDE_PRICING.default!;
	}
}
