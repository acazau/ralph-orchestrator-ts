/**
 * Adapter types for Ralph Orchestrator
 */

/**
 * Response from a tool execution
 */
export interface ToolResponse {
	/** Whether the execution was successful */
	success: boolean;
	/** Output from the tool */
	output: string;
	/** Error message if any */
	error?: string;
	/** Number of tokens used */
	tokensUsed?: number;
	/** Cost of the execution in USD */
	cost?: number;
	/** Additional metadata */
	metadata: Record<string, unknown>;
}

/**
 * Create a successful tool response
 */
export function createSuccessResponse(
	output: string,
	options: Partial<Omit<ToolResponse, "success" | "output">> = {},
): ToolResponse {
	return {
		success: true,
		output,
		metadata: options.metadata ?? {},
		tokensUsed: options.tokensUsed,
		cost: options.cost,
	};
}

/**
 * Create a failed tool response
 */
export function createErrorResponse(
	error: string,
	output = "",
	metadata: Record<string, unknown> = {},
): ToolResponse {
	return {
		success: false,
		output,
		error,
		metadata,
	};
}

/**
 * Options for executing a tool
 */
export interface ExecuteOptions {
	/** Path to prompt file */
	promptFile?: string;
	/** Enable verbose output */
	verbose?: boolean;
	/** Timeout in milliseconds */
	timeout?: number;
	/** Model to use */
	model?: string;
	/** System prompt to prepend */
	systemPrompt?: string;
	/** List of allowed tools */
	allowedTools?: string[];
	/** List of disallowed tools */
	disallowedTools?: string[];
	/** Enable all tools */
	enableAllTools?: boolean;
	/** Enable web search */
	enableWebSearch?: boolean;
	/** Additional arguments to pass to the tool */
	additionalArgs?: string[];
	/** Environment variables */
	env?: Record<string, string>;
}

/**
 * Abstract interface for tool adapters
 */
export interface IToolAdapter {
	/** Name of the adapter */
	readonly name: string;
	/** Whether the tool is available */
	readonly available: boolean;

	/**
	 * Check if the tool is available and properly configured
	 */
	checkAvailability(): Promise<boolean>;

	/**
	 * Execute the tool with the given prompt
	 */
	execute(prompt: string, options?: ExecuteOptions): Promise<ToolResponse>;

	/**
	 * Execute the tool with a prompt file
	 */
	executeWithFile(
		promptFile: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse>;

	/**
	 * Estimate the cost of executing this prompt
	 */
	estimateCost(prompt: string): number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	cacheRead?: number;
	cacheCreation?: number;
}

/**
 * Calculate total tokens from usage
 */
export function totalTokens(usage: TokenUsage): number {
	return usage.inputTokens + usage.outputTokens;
}

/**
 * Tool call information
 */
export interface ToolCallInfo {
	toolName: string;
	toolId: string;
	inputParams: Record<string, unknown>;
}
