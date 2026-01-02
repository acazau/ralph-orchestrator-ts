/**
 * ACP (Agent Client Protocol) models and types
 */

/**
 * Update kinds for ACP messages
 */
export enum UpdateKind {
	AGENT_MESSAGE_CHUNK = "agent_message_chunk",
	AGENT_THOUGHT_CHUNK = "agent_thought_chunk",
	TOOL_CALL = "tool_call",
	TOOL_CALL_UPDATE = "tool_call_update",
	PLAN = "plan",
}

/**
 * Tool call status
 */
export enum ToolCallStatus {
	PENDING = "pending",
	RUNNING = "running",
	COMPLETED = "completed",
	FAILED = "failed",
}

/**
 * Permission modes for tool execution
 */
export enum PermissionMode {
	AUTO_APPROVE = "auto_approve",
	DENY_ALL = "deny_all",
	ALLOWLIST = "allowlist",
	INTERACTIVE = "interactive",
}

/**
 * ACP JSON-RPC request
 */
export interface ACPRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: Record<string, unknown>;
}

/**
 * ACP JSON-RPC response
 */
export interface ACPResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: ACPError;
}

/**
 * ACP error
 */
export interface ACPError {
	code: number;
	message: string;
	data?: unknown;
}

/**
 * Update payload from ACP
 */
export interface UpdatePayload {
	kind: UpdateKind;
	content?: string;
	toolName?: string;
	toolCallId?: string;
	arguments?: Record<string, unknown>;
	status?: ToolCallStatus;
	result?: unknown;
	error?: string;
}

/**
 * Tool call information
 */
export interface ToolCall {
	toolCallId: string;
	toolName: string;
	arguments: Record<string, unknown>;
	status: ToolCallStatus;
	result?: unknown;
	error?: string;
}

/**
 * ACP session state
 */
export interface ACPSession {
	sessionId: string;
	output: string;
	thoughts: string;
	toolCalls: ToolCall[];
	completed: boolean;
	error?: string;
}

/**
 * Permission request for tool use
 */
export interface PermissionRequest {
	toolName: string;
	toolCallId: string;
	arguments: Record<string, unknown>;
}

/**
 * Permission response
 */
export interface PermissionResponse {
	allowed: boolean;
	reason?: string;
}

/**
 * Create a new ACP request
 */
export function createACPRequest(
	id: number,
	method: string,
	params?: Record<string, unknown>,
): ACPRequest {
	return {
		jsonrpc: "2.0",
		id,
		method,
		params,
	};
}

/**
 * Parse ACP response from JSON
 */
export function parseACPResponse(json: string): ACPResponse {
	return JSON.parse(json) as ACPResponse;
}

/**
 * Check if response is an error
 */
export function isACPError(response: ACPResponse): boolean {
	return response.error !== undefined;
}

/**
 * Create empty session
 */
export function createEmptySession(sessionId: string): ACPSession {
	return {
		sessionId,
		output: "",
		thoughts: "",
		toolCalls: [],
		completed: false,
	};
}
