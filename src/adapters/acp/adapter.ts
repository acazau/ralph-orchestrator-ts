/**
 * ACP (Agent Client Protocol) adapter for Ralph Orchestrator
 */

import {
	type AdapterConfig,
	type ExecuteOptions,
	type ToolResponse,
	createErrorResponse,
	createSuccessResponse,
} from "../../types/index.ts";
import { createLogger } from "../../utils/logger.ts";
import {
	extractErrorMessage,
	mergeAdditionalArgs,
} from "../../utils/shared.ts";
import { ToolAdapter, commandExists } from "../base.ts";
import { ACPClient, type ACPClientOptions } from "./client.ts";
import { PermissionMode } from "./models.ts";

const logger = createLogger("ralph-orchestrator.acp");

/**
 * ACP adapter options
 */
export interface ACPAdapterOptions {
	/** ACP agent command */
	agentCommand?: string;
	/** Permission mode for tool execution */
	permissionMode?: PermissionMode;
	/** Allowed tools list (for allowlist mode) */
	allowedTools?: string[];
	/** Timeout in milliseconds */
	timeout?: number;
}

/**
 * ACP adapter implementation
 */
export class ACPAdapter extends ToolAdapter {
	private readonly agentCommand: string;
	private permissionMode: PermissionMode;
	private allowedTools: Set<string>;
	private client: ACPClient | null = null;

	constructor(config?: Partial<AdapterConfig>, options?: ACPAdapterOptions) {
		super("acp", config);
		this.agentCommand = options?.agentCommand ?? "gemini";
		this.permissionMode =
			options?.permissionMode ?? PermissionMode.AUTO_APPROVE;
		this.allowedTools = new Set(options?.allowedTools ?? []);
	}

	/**
	 * Check if the ACP agent is available
	 */
	async checkAvailability(): Promise<boolean> {
		const available = await commandExists(this.agentCommand);
		this.setAvailable(available);

		if (!available) {
			logger.debug(`ACP agent command not found: ${this.agentCommand}`);
		}

		return available;
	}

	/**
	 * Execute with the ACP agent
	 */
	async execute(
		prompt: string,
		options?: ExecuteOptions,
	): Promise<ToolResponse> {
		if (!this.available && !(await this.checkAvailability())) {
			return createErrorResponse(
				`ACP agent command not available: ${this.agentCommand}`,
			);
		}

		const enhancedPrompt = this.enhancePromptWithInstructions(prompt);

		logger.debug(`Executing ACP with agent: ${this.agentCommand}`);

		try {
			const startTime = Date.now();

			// Create and start client
			const clientOptions: ACPClientOptions = {
				command: this.buildCommand(options),
				cwd: process.cwd(),
				env: options?.env,
				timeout: options?.timeout ?? this.config.timeout * 1000,
			};

			this.client = new ACPClient(clientOptions);
			await this.client.start();

			// Send prompt and wait for completion
			const session = await this.client.sendPrompt(enhancedPrompt);

			// Stop client
			await this.client.stop();
			this.client = null;

			const duration = (Date.now() - startTime) / 1000;

			if (session.error) {
				logger.error(`ACP execution failed: ${session.error}`);
				return createErrorResponse(session.error, session.output, {
					duration,
					toolCalls: session.toolCalls,
				});
			}

			logger.debug(`ACP execution completed in ${duration.toFixed(2)}s`);

			return createSuccessResponse(session.output, {
				metadata: {
					duration,
					thoughts: session.thoughts,
					toolCalls: session.toolCalls,
					sessionId: session.sessionId,
				},
			});
		} catch (error) {
			// Cleanup on error
			if (this.client) {
				await this.client.stop();
				this.client = null;
			}

			const message = extractErrorMessage(error);
			logger.error(`ACP execution error: ${message}`);
			return createErrorResponse(message);
		}
	}

	/**
	 * Build command for ACP agent
	 */
	private buildCommand(options?: ExecuteOptions): string[] {
		const args: string[] = [this.agentCommand];

		// Add experimental ACP flag (for gemini)
		if (this.agentCommand === "gemini") {
			args.push("--experimental-acp");
		}

		// Add model if specified
		if (options?.model) {
			args.push("--model", options.model);
		}

		// Add additional args from config and options
		mergeAdditionalArgs(args, this.config.args, options?.additionalArgs);

		return args;
	}

	/**
	 * Check if a tool is allowed
	 */
	checkToolPermission(toolName: string): boolean {
		switch (this.permissionMode) {
			case PermissionMode.AUTO_APPROVE:
				return true;

			case PermissionMode.DENY_ALL:
				return false;

			case PermissionMode.ALLOWLIST:
				return this.allowedTools.has(toolName);

			case PermissionMode.INTERACTIVE:
				// In interactive mode, we'd need to prompt the user
				// For now, default to auto-approve
				logger.warn(
					"Interactive permission mode not implemented, auto-approving",
				);
				return true;

			default:
				return true;
		}
	}

	/**
	 * Set permission mode
	 */
	setPermissionMode(mode: PermissionMode): void {
		this.permissionMode = mode;
	}

	/**
	 * Set allowed tools (for allowlist mode)
	 */
	setAllowedTools(tools: string[]): void {
		this.allowedTools = new Set(tools);
	}

	/**
	 * Add tool to allowed list
	 */
	addAllowedTool(tool: string): void {
		this.allowedTools.add(tool);
	}

	/**
	 * Remove tool from allowed list
	 */
	removeAllowedTool(tool: string): void {
		this.allowedTools.delete(tool);
	}

	/**
	 * Get current allowed tools
	 */
	getAllowedTools(): string[] {
		return Array.from(this.allowedTools);
	}

	/**
	 * Estimate cost (ACP doesn't provide cost info directly)
	 */
	override estimateCost(_prompt: string): number {
		return 0;
	}
}
