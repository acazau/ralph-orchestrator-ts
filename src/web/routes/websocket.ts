/**
 * WebSocket routes for real-time updates
 */

import type { ServerWebSocket } from "bun";
import { createLogger } from "../../utils/logger.ts";
import {
	type AuthConfig,
	type TokenPayload,
	verifyToken,
} from "../middleware/auth.ts";
import { getActiveOrchestrator, getActiveOrchestratorIds } from "./api.ts";

const logger = createLogger("ralph-orchestrator.web.websocket");

/**
 * WebSocket message types
 */
export enum MessageType {
	// Client -> Server
	AUTH = "auth",
	SUBSCRIBE = "subscribe",
	UNSUBSCRIBE = "unsubscribe",
	PING = "ping",

	// Server -> Client
	AUTH_SUCCESS = "auth_success",
	AUTH_ERROR = "auth_error",
	SUBSCRIBED = "subscribed",
	UNSUBSCRIBED = "unsubscribed",
	PONG = "pong",
	ERROR = "error",

	// Updates
	RUN_UPDATE = "run_update",
	ITERATION_UPDATE = "iteration_update",
	STATE_UPDATE = "state_update",
	METRICS_UPDATE = "metrics_update",
}

/**
 * WebSocket message structure
 */
export interface WSMessage {
	type: MessageType;
	payload?: unknown;
	runId?: number;
	timestamp?: string;
}

/**
 * WebSocket client data
 */
export interface WSClientData {
	id: string;
	user?: TokenPayload;
	subscriptions: Set<number>;
	authenticated: boolean;
}

/**
 * WebSocket server configuration
 */
export interface WebSocketConfig {
	auth: AuthConfig;
	/** Send state updates at this interval (ms) */
	updateInterval?: number;
	/** Ping interval (ms) */
	pingInterval?: number;
}

/**
 * Connected clients
 */
const clients = new Map<string, ServerWebSocket<WSClientData>>();

/**
 * Update interval handle
 */
let updateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Generate client ID
 */
function generateClientId(): string {
	// Use cryptographically secure random for client ID generation
	return `ws-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
}

/**
 * Send message to client
 */
function sendMessage(
	ws: ServerWebSocket<WSClientData>,
	message: WSMessage,
): void {
	try {
		ws.send(
			JSON.stringify({
				...message,
				timestamp: message.timestamp ?? new Date().toISOString(),
			}),
		);
	} catch (error) {
		logger.error(`Failed to send message: ${error}`);
	}
}

/**
 * Broadcast to all subscribed clients
 */
export function broadcastToSubscribers(
	runId: number,
	message: WSMessage,
): void {
	for (const [, ws] of clients) {
		if (ws.data.subscriptions.has(runId)) {
			sendMessage(ws, { ...message, runId });
		}
	}
}

/**
 * Broadcast to all authenticated clients
 */
export function broadcastToAll(message: WSMessage): void {
	for (const [, ws] of clients) {
		if (ws.data.authenticated) {
			sendMessage(ws, message);
		}
	}
}

/**
 * Handle authentication message
 */
async function handleAuth(
	ws: ServerWebSocket<WSClientData>,
	token: string,
	config: WebSocketConfig,
): Promise<void> {
	// Skip auth if disabled
	if (config.auth.enabled === false) {
		ws.data.authenticated = true;
		ws.data.user = {
			userId: 0,
			username: "anonymous",
			role: "viewer",
		} as TokenPayload;
		sendMessage(ws, {
			type: MessageType.AUTH_SUCCESS,
			payload: { user: ws.data.user },
		});
		return;
	}

	const payload = await verifyToken(token, config.auth);

	if (!payload) {
		sendMessage(ws, {
			type: MessageType.AUTH_ERROR,
			payload: { message: "Invalid or expired token" },
		});
		return;
	}

	ws.data.authenticated = true;
	ws.data.user = payload;

	sendMessage(ws, {
		type: MessageType.AUTH_SUCCESS,
		payload: { user: { username: payload.username, role: payload.role } },
	});

	logger.debug(`WebSocket client authenticated: ${payload.username}`);
}

/**
 * Handle subscribe message
 */
function handleSubscribe(
	ws: ServerWebSocket<WSClientData>,
	runId: number,
): void {
	if (!ws.data.authenticated) {
		sendMessage(ws, {
			type: MessageType.ERROR,
			payload: { message: "Authentication required" },
		});
		return;
	}

	ws.data.subscriptions.add(runId);

	sendMessage(ws, {
		type: MessageType.SUBSCRIBED,
		runId,
		payload: { message: `Subscribed to run ${runId}` },
	});

	// Send initial state
	const orchestrator = getActiveOrchestrator(runId);
	if (orchestrator) {
		sendMessage(ws, {
			type: MessageType.STATE_UPDATE,
			runId,
			payload: orchestrator.getState(),
		});
	}

	logger.debug(`Client ${ws.data.id} subscribed to run ${runId}`);
}

/**
 * Handle unsubscribe message
 */
function handleUnsubscribe(
	ws: ServerWebSocket<WSClientData>,
	runId: number,
): void {
	ws.data.subscriptions.delete(runId);

	sendMessage(ws, {
		type: MessageType.UNSUBSCRIBED,
		runId,
		payload: { message: `Unsubscribed from run ${runId}` },
	});

	logger.debug(`Client ${ws.data.id} unsubscribed from run ${runId}`);
}

/**
 * Handle incoming message
 */
async function handleMessage(
	ws: ServerWebSocket<WSClientData>,
	message: string,
	config: WebSocketConfig,
): Promise<void> {
	try {
		const parsed = JSON.parse(message) as WSMessage;

		switch (parsed.type) {
			case MessageType.AUTH:
				await handleAuth(ws, parsed.payload as string, config);
				break;

			case MessageType.SUBSCRIBE:
				handleSubscribe(ws, parsed.runId ?? (parsed.payload as number));
				break;

			case MessageType.UNSUBSCRIBE:
				handleUnsubscribe(ws, parsed.runId ?? (parsed.payload as number));
				break;

			case MessageType.PING:
				sendMessage(ws, { type: MessageType.PONG });
				break;

			default:
				sendMessage(ws, {
					type: MessageType.ERROR,
					payload: { message: `Unknown message type: ${parsed.type}` },
				});
		}
	} catch (error) {
		logger.error(`Failed to handle message: ${error}`);
		sendMessage(ws, {
			type: MessageType.ERROR,
			payload: { message: "Invalid message format" },
		});
	}
}

/**
 * Start periodic update broadcasts
 */
function startUpdateBroadcasts(intervalMs: number): void {
	if (updateInterval) return;

	updateInterval = setInterval(() => {
		const activeIds = getActiveOrchestratorIds();

		for (const runId of activeIds) {
			const orchestrator = getActiveOrchestrator(runId);
			if (orchestrator) {
				broadcastToSubscribers(runId, {
					type: MessageType.STATE_UPDATE,
					payload: orchestrator.getState(),
				});
			}
		}
	}, intervalMs);
}

/**
 * Stop periodic broadcasts
 */
function stopUpdateBroadcasts(): void {
	if (updateInterval) {
		clearInterval(updateInterval);
		updateInterval = null;
	}
}

/**
 * Create WebSocket handlers for Bun
 */
export function createWebSocketHandlers(config: WebSocketConfig) {
	// Start update broadcasts
	startUpdateBroadcasts(config.updateInterval ?? 1000);

	return {
		/**
		 * Handle new WebSocket connection
		 */
		open(ws: ServerWebSocket<WSClientData>): void {
			ws.data = {
				id: generateClientId(),
				subscriptions: new Set(),
				authenticated: false,
			};

			clients.set(ws.data.id, ws);

			logger.debug(`WebSocket client connected: ${ws.data.id}`);

			// If auth is disabled, auto-authenticate
			if (config.auth.enabled === false) {
				ws.data.authenticated = true;
				ws.data.user = {
					userId: 0,
					username: "anonymous",
					role: "viewer",
				} as TokenPayload;
				sendMessage(ws, {
					type: MessageType.AUTH_SUCCESS,
					payload: { user: ws.data.user },
				});
			}
		},

		/**
		 * Handle incoming message
		 */
		message(ws: ServerWebSocket<WSClientData>, message: string | Buffer): void {
			const messageStr =
				typeof message === "string" ? message : message.toString();
			handleMessage(ws, messageStr, config);
		},

		/**
		 * Handle WebSocket close
		 */
		close(ws: ServerWebSocket<WSClientData>): void {
			clients.delete(ws.data.id);
			logger.debug(`WebSocket client disconnected: ${ws.data.id}`);
		},

		/**
		 * Handle WebSocket error
		 */
		error(ws: ServerWebSocket<WSClientData>, error: Error): void {
			logger.error(`WebSocket error for ${ws.data.id}: ${error.message}`);
		},
	};
}

/**
 * Get connected client count
 */
export function getClientCount(): number {
	return clients.size;
}

/**
 * Get authenticated client count
 */
export function getAuthenticatedClientCount(): number {
	let count = 0;
	for (const [, ws] of clients) {
		if (ws.data.authenticated) count++;
	}
	return count;
}

/**
 * Cleanup on shutdown
 */
export function cleanup(): void {
	stopUpdateBroadcasts();
	for (const [, ws] of clients) {
		ws.close(1000, "Server shutdown");
	}
	clients.clear();
}

// Cleanup on process exit
process.on("exit", cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
