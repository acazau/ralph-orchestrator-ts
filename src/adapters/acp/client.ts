/**
 * ACP (Agent Client Protocol) client implementation
 */

import { createLogger } from "../../utils/logger.ts";
import {
	type ACPResponse,
	type ACPSession,
	ToolCallStatus,
	UpdateKind,
	type UpdatePayload,
	createACPRequest,
	createEmptySession,
} from "./models.ts";

const logger = createLogger("ralph-orchestrator.acp.client");

/**
 * ACP client options
 */
export interface ACPClientOptions {
	/** Command to spawn ACP agent */
	command: string[];
	/** Working directory */
	cwd?: string;
	/** Environment variables */
	env?: Record<string, string>;
	/** Timeout in milliseconds */
	timeout?: number;
}

/**
 * Subprocess type with pipe configuration
 */
interface ACPProcess {
	stdin: WritableStream<Uint8Array>;
	stdout: ReadableStream<Uint8Array>;
	stderr: ReadableStream<Uint8Array>;
	exited: Promise<number>;
	kill(signal?: number): void;
}

/**
 * ACP client for communicating with ACP-compliant agents
 */
export class ACPClient {
	private readonly options: ACPClientOptions;
	private process: ACPProcess | null = null;
	private stdinWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;
	private requestId = 0;
	private session: ACPSession | null = null;
	private readonly pendingRequests: Map<
		number,
		{
			resolve: (value: ACPResponse) => void;
			reject: (error: Error) => void;
		}
	> = new Map();

	constructor(options: ACPClientOptions) {
		this.options = options;
	}

	/**
	 * Start the ACP agent process
	 */
	async start(): Promise<void> {
		if (this.process) {
			throw new Error("ACP client already started");
		}

		logger.debug(`Starting ACP agent: ${this.options.command.join(" ")}`);

		const proc = Bun.spawn(this.options.command, {
			cwd: this.options.cwd,
			env: { ...process.env, ...this.options.env },
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		});

		// Cast to our expected type
		this.process = proc as unknown as ACPProcess;
		this.stdinWriter = this.process.stdin.getWriter();

		// Start reading responses
		this.readResponses();

		// Generate session ID using cryptographically secure random
		const sessionId = `session-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
		this.session = createEmptySession(sessionId);

		logger.debug(`ACP agent started with session ${sessionId}`);
	}

	/**
	 * Stop the ACP agent process
	 */
	async stop(): Promise<void> {
		if (!this.process) {
			return;
		}

		logger.debug("Stopping ACP agent");

		try {
			// Close stdin to signal EOF
			if (this.stdinWriter) {
				await this.stdinWriter.close();
				this.stdinWriter = null;
			}

			// Kill the process
			this.process.kill();

			// Wait for exit
			await this.process.exited;
		} catch (error) {
			logger.warn(`Error stopping ACP agent: ${error}`);
		}

		this.process = null;
		this.session = null;
		this.pendingRequests.clear();
	}

	/**
	 * Send a request to the ACP agent
	 */
	async sendRequest(
		method: string,
		params?: Record<string, unknown>,
	): Promise<ACPResponse> {
		if (!this.process || !this.stdinWriter) {
			throw new Error("ACP client not started");
		}

		const id = ++this.requestId;
		const request = createACPRequest(id, method, params);

		return new Promise((resolve, reject) => {
			// Store pending request
			this.pendingRequests.set(id, { resolve, reject });

			// Set timeout
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Request ${id} timed out`));
			}, this.options.timeout ?? 300000);

			// Send request
			const line = JSON.stringify(request) + "\n";
			const encoder = new TextEncoder();
			this.stdinWriter!.write(encoder.encode(line));

			logger.debug(`Sent ACP request: ${method} (id=${id})`);

			// Clear timeout on response
			this.pendingRequests.set(id, {
				resolve: (response) => {
					clearTimeout(timeout);
					resolve(response);
				},
				reject: (error) => {
					clearTimeout(timeout);
					reject(error);
				},
			});
		});
	}

	/**
	 * Send a prompt to the ACP agent
	 */
	async sendPrompt(prompt: string): Promise<ACPSession> {
		if (!this.session) {
			throw new Error("No active session");
		}

		// Clear previous output
		this.session.output = "";
		this.session.thoughts = "";
		this.session.toolCalls = [];
		this.session.completed = false;
		this.session.error = undefined;

		// Send the prompt
		const response = await this.sendRequest("agent/run", {
			prompt,
		});

		if (response.error) {
			this.session.error = response.error.message;
			throw new Error(response.error.message);
		}

		// Wait for completion
		await this.waitForCompletion();

		return this.session;
	}

	/**
	 * Get current session
	 */
	getSession(): ACPSession | null {
		return this.session;
	}

	/**
	 * Read responses from the ACP agent
	 */
	private async readResponses(): Promise<void> {
		if (!this.process) {
			return;
		}

		const reader = this.process.stdout.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Process complete lines
				let newlineIndex: number;
				while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
					const line = buffer.substring(0, newlineIndex).trim();
					buffer = buffer.substring(newlineIndex + 1);

					if (line) {
						this.handleLine(line);
					}
				}
			}
		} catch (error) {
			logger.error(`Error reading ACP responses: ${error}`);
		}
	}

	/**
	 * Handle a line of output from the ACP agent
	 */
	private handleLine(line: string): void {
		try {
			const data = JSON.parse(line);

			// Check if it's a response to a pending request
			if ("id" in data && this.pendingRequests.has(data.id)) {
				const pending = this.pendingRequests.get(data.id)!;
				this.pendingRequests.delete(data.id);
				pending.resolve(data as ACPResponse);
				return;
			}

			// Check if it's an update notification
			if ("method" in data && data.method === "update") {
				this.handleUpdate(data.params as UpdatePayload);
				return;
			}

			logger.debug(`Unhandled ACP message: ${line}`);
		} catch {
			logger.warn(`Failed to parse ACP response: ${line}`);
		}
	}

	/**
	 * Handle an update notification
	 */
	private handleUpdate(payload: UpdatePayload): void {
		if (!this.session) return;

		const handlers: Record<string, () => void> = {
			[UpdateKind.AGENT_MESSAGE_CHUNK]: () => this.handleMessageChunk(payload),
			[UpdateKind.AGENT_THOUGHT_CHUNK]: () => this.handleThoughtChunk(payload),
			[UpdateKind.TOOL_CALL]: () => this.handleToolCall(payload),
			[UpdateKind.TOOL_CALL_UPDATE]: () => this.handleToolCallUpdate(payload),
		};

		const handler = handlers[payload.kind];
		if (handler) {
			handler();
		} else {
			logger.debug(`Unknown update kind: ${payload.kind}`);
		}
	}

	private handleMessageChunk(payload: UpdatePayload): void {
		if (payload.content && this.session) {
			this.session.output += payload.content;
		}
	}

	private handleThoughtChunk(payload: UpdatePayload): void {
		if (payload.content && this.session) {
			this.session.thoughts += payload.content;
		}
	}

	private handleToolCall(payload: UpdatePayload): void {
		if (!payload.toolCallId || !payload.toolName || !this.session) return;

		this.session.toolCalls.push({
			toolCallId: payload.toolCallId,
			toolName: payload.toolName,
			arguments: payload.arguments ?? {},
			status: ToolCallStatus.PENDING,
		});
	}

	private handleToolCallUpdate(payload: UpdatePayload): void {
		if (!payload.toolCallId || !this.session) return;

		const toolCall = this.session.toolCalls.find(
			(tc) => tc.toolCallId === payload.toolCallId,
		);
		if (!toolCall) return;

		if (payload.status) toolCall.status = payload.status;
		if (payload.result !== undefined) toolCall.result = payload.result;
		if (payload.error) toolCall.error = payload.error;
	}

	/**
	 * Wait for the current operation to complete
	 */
	private async waitForCompletion(): Promise<void> {
		// Poll for completion or implement proper waiting mechanism
		const maxWait = this.options.timeout ?? 300000;
		const startTime = Date.now();

		while (Date.now() - startTime < maxWait) {
			if (this.session?.completed || this.session?.error) {
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		throw new Error("Timed out waiting for ACP completion");
	}
}
