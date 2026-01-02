/**
 * Hono web server for Ralph Orchestrator dashboard
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { createLogger } from "../utils/logger.ts";
import { DatabaseManager } from "./database.ts";
import { type AuthConfig, initDefaultAdmin } from "./middleware/auth.ts";
import { type APIConfig, createAPIRoutes } from "./routes/api.ts";
import {
	cleanup as cleanupWS,
	createWebSocketHandlers,
} from "./routes/websocket.ts";

const logger = createLogger("ralph-orchestrator.web.server");

/**
 * Server configuration
 */
export interface ServerConfig {
	/** Server port */
	port?: number;
	/** Server hostname */
	hostname?: string;
	/** Enable CORS */
	cors?: boolean;
	/** CORS origin */
	corsOrigin?: string;
	/** Enable pretty JSON responses */
	prettyJson?: boolean;
	/** Enable request logging */
	logging?: boolean;
	/** Database path */
	dbPath?: string;
	/** Authentication configuration */
	auth?: Partial<AuthConfig>;
	/** Default admin password */
	adminPassword?: string;
}

/**
 * Default configuration
 */
const defaultConfig: Required<Omit<ServerConfig, "auth">> & {
	auth: AuthConfig;
} = {
	port: 3000,
	hostname: "0.0.0.0",
	cors: true,
	corsOrigin: "*",
	prettyJson: true,
	logging: true,
	dbPath: ".agent/ralph.db",
	auth: {
		secret:
			process.env.RALPH_JWT_SECRET ??
			"ralph-orchestrator-secret-key-change-in-production",
		expiresIn: 86400,
		enabled: true,
	},
	adminPassword: process.env.RALPH_ADMIN_PASSWORD ?? "admin123",
};

/**
 * Create the web server application
 */
export function createServer(userConfig: ServerConfig = {}) {
	const config = {
		...defaultConfig,
		...userConfig,
		auth: {
			...defaultConfig.auth,
			...userConfig.auth,
		},
	};

	// Initialize database
	DatabaseManager.getInstance(config.dbPath);

	// Create Hono app
	const app = new Hono();

	// Apply middleware
	if (config.cors) {
		app.use(
			"/*",
			cors({
				origin: config.corsOrigin,
				allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
				allowHeaders: ["Content-Type", "Authorization"],
				exposeHeaders: [
					"X-RateLimit-Limit",
					"X-RateLimit-Remaining",
					"X-RateLimit-Reset",
				],
				maxAge: 600,
				credentials: true,
			}),
		);
	}

	if (config.logging) {
		app.use("/*", honoLogger());
	}

	if (config.prettyJson) {
		app.use("/*", prettyJSON());
	}

	// Security headers
	app.use("/*", secureHeaders());

	// Health check endpoint
	app.get("/health", (c) => {
		return c.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			version: "1.0.0",
		});
	});

	// API routes
	const apiConfig: APIConfig = {
		auth: config.auth,
	};
	app.route("/api", createAPIRoutes(apiConfig));

	// Root endpoint
	app.get("/", (c) => {
		return c.json({
			name: "Ralph Orchestrator",
			version: "1.0.0",
			docs: "/api",
			health: "/health",
			websocket: "/ws",
		});
	});

	// 404 handler
	app.notFound((c) => {
		return c.json(
			{
				error: "Not Found",
				message: `Route ${c.req.path} not found`,
			},
			404,
		);
	});

	// Error handler
	app.onError((err, c) => {
		logger.error(`Server error: ${err.message}`);
		return c.json(
			{
				error: "Internal Server Error",
				message: err.message,
			},
			500,
		);
	});

	return {
		app,
		config,
	};
}

/**
 * Start the web server
 */
export async function startServer(
	userConfig: ServerConfig = {},
): Promise<void> {
	const { app, config } = createServer(userConfig);

	// Initialize default admin user
	await initDefaultAdmin(config.adminPassword);

	// Create WebSocket handlers
	const wsHandlers = createWebSocketHandlers({
		auth: config.auth,
		updateInterval: 1000,
		pingInterval: 30000,
	});

	// Start server with WebSocket support
	const server = Bun.serve({
		port: config.port,
		hostname: config.hostname,
		fetch: app.fetch,
		websocket: wsHandlers,
	});

	logger.info(`Server started at http://${config.hostname}:${config.port}`);
	logger.info(
		`WebSocket available at ws://${config.hostname}:${config.port}/ws`,
	);

	// Handle shutdown
	const shutdown = async () => {
		logger.info("Shutting down server...");
		cleanupWS();
		server.stop();
		DatabaseManager.getInstance().close();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

/**
 * Export for use as module
 */
export { createAPIRoutes } from "./routes/api.ts";
export { createWebSocketHandlers } from "./routes/websocket.ts";
export { DatabaseManager } from "./database.ts";
