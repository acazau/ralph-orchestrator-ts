/**
 * Shared utility functions to reduce code duplication
 */

/**
 * Convert an object to a JSON string with consistent formatting
 */
export function toJsonString(data: unknown): string {
	return JSON.stringify(data, null, 2);
}

/**
 * Extract error message from any error type
 */
export function extractErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Estimate tokens from text (approximately 4 characters per token)
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Estimate cost for AI execution
 * @param toolName - The AI tool name
 * @param inputTokens - Number of input tokens
 * @param outputMultiplier - Multiplier for output tokens (default 2x input)
 */
export function estimateBasicCost(
	inputTokens: number,
	outputMultiplier = 2,
): { inputTokens: number; outputTokens: number } {
	return {
		inputTokens,
		outputTokens: inputTokens * outputMultiplier,
	};
}

/**
 * Merge additional arguments into an args array
 */
export function mergeAdditionalArgs(
	args: string[],
	configArgs: string[],
	optionalArgs?: string[],
): void {
	if (configArgs.length > 0) {
		args.push(...configArgs);
	}
	if (optionalArgs && optionalArgs.length > 0) {
		args.push(...optionalArgs);
	}
}
