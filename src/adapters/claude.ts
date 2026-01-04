/**
 * Claude adapter for Ralph Orchestrator
 * Uses the Claude Agent SDK for execution
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { CostTracker } from "../metrics/cost-tracker.ts";
import {
	type AdapterConfig,
	type ExecuteOptions,
	type ToolResponse,
	createErrorResponse,
	createSuccessResponse,
} from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";
import { estimateTokens, extractErrorMessage } from "../utils/shared.ts";
import { ToolAdapter } from "./base.ts";

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
 * SDK message types
 */
interface SDKMessage {
	type: string;
	subtype?: string;
	message?: {
		role?: string;
		content?: Array<{ type: string; text?: string }>;
	};
	result?: string;
	is_error?: boolean;
	session_id?: string;
}

/**
 * Extracted output result
 */
interface ExtractedOutput {
	output: string;
	success: boolean;
}

/**
 * Extract output from a result message
 */
function extractFromResultMessage(resultMessage: SDKMessage): ExtractedOutput {
	const success = !resultMessage.is_error;
	const hasSuccessResult =
		resultMessage.subtype === "success" && resultMessage.result;

	const output = hasSuccessResult
		? resultMessage.result!
		: `Execution ${resultMessage.subtype}: ${resultMessage.result ?? "no result"}`;

	return { output, success };
}

/**
 * Extract text content from assistant messages
 */
function extractFromAssistantMessages(messages: SDKMessage[]): ExtractedOutput {
	const outputTexts: string[] = [];

	for (const msg of messages) {
		const texts = extractTextFromMessage(msg);
		outputTexts.push(...texts);
	}

	const hasOutput = outputTexts.length > 0;
	return {
		output: hasOutput ? outputTexts.join("\n") : "No output from Claude",
		success: hasOutput,
	};
}

/**
 * Extract text blocks from a single message
 */
function extractTextFromMessage(msg: SDKMessage): string[] {
	if (msg.type !== "assistant" || !msg.message?.content) {
		return [];
	}

	return msg.message.content
		.filter((block) => block.type === "text" && block.text)
		.map((block) => block.text!);
}

/**
 * Claude adapter implementation using Agent SDK
 */
export class ClaudeAdapter extends ToolAdapter {
	constructor(config?: Partial<AdapterConfig>) {
		super("claude", config);
		// SDK is always available if the package is installed
		this.setAvailable(true);
	}

	/**
	 * Check if Claude SDK is available
	 */
	async checkAvailability(): Promise<boolean> {
		// SDK is available if we can import it (which we already have)
		this.setAvailable(true);
		return true;
	}

	/**
	 * Execute Claude with the given prompt using Agent SDK
	 */
	async execute(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse> {
		const enhancedPrompt = this.enhancePromptWithInstructions(prompt);
		const startTime = Date.now();

		logger.debug("Executing Claude via Agent SDK");

		try {
			const { messages, resultMessage } = await this.runQuery(
				enhancedPrompt,
				options,
			);
			const duration = (Date.now() - startTime) / 1000;

			const extracted = resultMessage
				? extractFromResultMessage(resultMessage)
				: extractFromAssistantMessages(messages);

			if (!extracted.success) {
				logger.error(`Claude SDK execution failed: ${extracted.output}`);
				return createErrorResponse(extracted.output, undefined, { duration });
			}

			return this.buildSuccessResponse(
				enhancedPrompt,
				extracted.output,
				duration,
				options,
				resultMessage,
			);
		} catch (error) {
			const duration = (Date.now() - startTime) / 1000;
			const message = extractErrorMessage(error);
			logger.error(`Claude SDK error: ${message}`);
			return createErrorResponse(message, undefined, { duration });
		}
	}

	/**
	 * Run the SDK query and collect messages
	 */
	private async runQuery(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<{ messages: SDKMessage[]; resultMessage: SDKMessage | null }> {
		const sdkOptions: Options = {
			cwd: process.cwd(),
			permissionMode: "bypassPermissions",
			systemPrompt: options?.systemPrompt,
			allowedTools: options?.allowedTools,
		};

		const messages: SDKMessage[] = [];
		let resultMessage: SDKMessage | null = null;

		for await (const message of query({ prompt, options: sdkOptions })) {
			const sdkMessage = message as SDKMessage;
			messages.push(sdkMessage);

			if (sdkMessage.type === "result") {
				resultMessage = sdkMessage;
			}
		}

		return { messages, resultMessage };
	}

	/**
	 * Build a success response with metrics
	 */
	private buildSuccessResponse(
		prompt: string,
		output: string,
		duration: number,
		options?: ExecuteOptions,
		resultMessage?: SDKMessage | null,
	): ToolResponse {
		const inputTokens = estimateTokens(prompt);
		const outputTokens = estimateTokens(output);
		const cost = CostTracker.estimateCost("claude", inputTokens, outputTokens);

		logger.debug(`Claude SDK execution completed in ${duration.toFixed(2)}s`);

		return createSuccessResponse(output, {
			tokensUsed: inputTokens + outputTokens,
			cost,
			metadata: {
				duration,
				model: options?.model,
				sessionId: resultMessage?.session_id,
			},
		});
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
