/**
 * Base adapter for Ralph Orchestrator
 */

import type {
	AdapterConfig,
	ExecuteOptions,
	IToolAdapter,
	ToolResponse,
} from "../types/index.ts";
import { DEFAULT_ADAPTER_CONFIG, createErrorResponse } from "../types/index.ts";

/**
 * Orchestration instructions to prepend to prompts
 */
const ORCHESTRATION_INSTRUCTIONS = `
ORCHESTRATION CONTEXT:
You are running within the Ralph Orchestrator loop. This system will call you repeatedly
for multiple iterations until the overall task is complete. Each iteration is a separate
execution where you should make incremental progress.

The final output must be well-tested, documented, and production ready.

IMPORTANT INSTRUCTIONS:
1. Implement only ONE small, focused task from this prompt per iteration.
   - Each iteration is independent - focus on a single atomic change
   - The orchestrator will handle calling you again for the next task
   - Mark subtasks complete as you finish them
   - You must commit your changes after each iteration, for checkpointing.
2. Use the .agent/workspace/ directory for any temporary files or workspaces if not already instructed in the prompt.
3. Follow this workflow for implementing features:
   - Explore: Research and understand the codebase
   - Plan: Design your implementation approach
   - Implement: Use Test-Driven Development (TDD) - write tests first, then code
   - Commit: Commit your changes with clear messages
4. When you complete a subtask, document it in the prompt file so the next iteration knows what's done.
5. For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.
6. If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task.
---
ORIGINAL PROMPT:

`;

/**
 * Markers that indicate orchestration instructions are already present
 */
const INSTRUCTION_MARKERS = [
	"ORCHESTRATION CONTEXT:",
	"IMPORTANT INSTRUCTIONS:",
	"Implement only ONE small, focused task",
];

/**
 * Abstract base class for tool adapters
 */
export abstract class ToolAdapter implements IToolAdapter {
	readonly name: string;
	protected config: AdapterConfig;
	private _available: boolean | null = null;

	constructor(name: string, config?: Partial<AdapterConfig>) {
		this.name = name;
		this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config };
	}

	/**
	 * Check if the tool is available
	 */
	get available(): boolean {
		if (this._available === null) {
			// Synchronously return false, let checkAvailability set the real value
			return false;
		}
		return this._available;
	}

	/**
	 * Set availability (called after async check)
	 */
	protected setAvailable(value: boolean): void {
		this._available = value;
	}

	/**
	 * Helper method for CLI adapters to check if a command exists
	 * @param command - The command to check for in PATH
	 * @param notFoundLog - Optional debug message when command is not found
	 * @returns Whether the command exists
	 */
	protected async checkCommandExists(
		command: string,
		notFoundLog?: string,
	): Promise<boolean> {
		const available = await commandExists(command);
		this.setAvailable(available);

		if (!available && notFoundLog) {
			const { logger } = await import("../utils/logger.ts");
			logger.debug(notFoundLog);
		}

		return available;
	}

	/**
	 * Check if the tool is available and properly configured
	 */
	abstract checkAvailability(): Promise<boolean>;

	/**
	 * Execute the tool with the given prompt
	 */
	abstract execute(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse>;

	/**
	 * Execute the tool with a prompt file
	 */
	async executeWithFile(
		promptFile: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse> {
		const file = Bun.file(promptFile);

		if (!(await file.exists())) {
			return createErrorResponse(`Prompt file ${promptFile} not found`);
		}

		const prompt = await file.text();
		return this.execute(prompt, { ...options, promptFile });
	}

	/**
	 * Estimate the cost of executing this prompt
	 */
	estimateCost(_prompt: string): number {
		// Default implementation - subclasses can override
		return 0;
	}

	/**
	 * Enhance prompt with orchestration context and instructions
	 */
	protected enhancePromptWithInstructions(prompt: string): string {
		// Check if instructions already exist in the prompt
		for (const marker of INSTRUCTION_MARKERS) {
			if (prompt.includes(marker)) {
				return prompt;
			}
		}

		return ORCHESTRATION_INSTRUCTIONS + prompt;
	}

	/**
	 * Get string representation
	 */
	toString(): string {
		return `${this.name} (available: ${this.available})`;
	}

	/**
	 * Get adapter configuration
	 */
	getConfig(): AdapterConfig {
		return { ...this.config };
	}

	/**
	 * Update adapter configuration
	 */
	updateConfig(config: Partial<AdapterConfig>): void {
		this.config = { ...this.config, ...config };
	}
}

/**
 * Result from CLI execution helper
 */
export interface CLIExecutionResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number;
	duration: number;
}

/**
 * Execute a CLI command with common error handling and timing
 */
export async function executeCLICommand(
	command: string[],
	options?: {
		timeout?: number;
		env?: Record<string, string>;
		stdin?: string;
	},
): Promise<CLIExecutionResult> {
	const startTime = Date.now();
	const result = await executeCommand(command, {
		timeout: options?.timeout,
		env: options?.env,
		stdin: options?.stdin,
	});
	const duration = (Date.now() - startTime) / 1000;

	return {
		success: result.exitCode === 0,
		stdout: result.stdout,
		stderr: result.stderr,
		exitCode: result.exitCode,
		duration,
	};
}

/**
 * Check if a command exists in PATH
 */
export async function commandExists(command: string): Promise<boolean> {
	try {
		const proc = Bun.spawn(["which", command], {
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;
		return proc.exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Execute a command and capture output
 */
export async function executeCommand(
	command: string[],
	options: {
		cwd?: string;
		env?: Record<string, string>;
		timeout?: number;
		stdin?: string;
	} = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn(command, {
		cwd: options.cwd,
		env: { ...process.env, ...options.env },
		stdout: "pipe",
		stderr: "pipe",
		stdin: options.stdin ? "pipe" : undefined,
	});

	// Write to stdin if provided
	if (options.stdin && proc.stdin) {
		proc.stdin.write(options.stdin);
		proc.stdin.end();
	}

	// Handle timeout
	let timeoutId: Timer | undefined;
	if (options.timeout) {
		timeoutId = setTimeout(() => {
			proc.kill();
		}, options.timeout);
	}

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	if (timeoutId) {
		clearTimeout(timeoutId);
	}

	return { stdout, stderr, exitCode };
}
