/**
 * Web dashboard exports
 */

export {
	createServer,
	startServer,
	type ServerConfig,
} from "./server.ts";

export {
	createAPIRoutes,
	getActiveOrchestrator,
	getActiveOrchestratorIds,
	type APIConfig,
} from "./routes/api.ts";

export {
	createWebSocketHandlers,
	broadcastToSubscribers,
	broadcastToAll,
	getClientCount,
	getAuthenticatedClientCount,
	cleanup as cleanupWebSocket,
	MessageType,
	type WSMessage,
	type WSClientData,
	type WebSocketConfig,
} from "./routes/websocket.ts";

export {
	DatabaseManager,
	type User,
	type Session,
	type RunRecord,
	type IterationRecord,
} from "./database.ts";

export {
	authMiddleware,
	requireRole,
	login,
	register,
	generateToken,
	verifyToken,
	hashPassword,
	verifyPassword,
	initDefaultAdmin,
	type AuthConfig,
	type TokenPayload,
} from "./middleware/auth.ts";

export {
	rateLimitMiddleware,
	slidingWindowRateLimiter,
	createRateLimiters,
	defaultRateLimits,
	type RateLimitConfig,
} from "./middleware/rate-limit.ts";
