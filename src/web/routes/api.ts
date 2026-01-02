/**
 * REST API routes for Ralph web dashboard
 */

import { Hono } from "hono";
import { loadConfig } from "../../config.ts";
import { RalphOrchestrator } from "../../orchestrator.ts";
import { createLogger } from "../../utils/logger.ts";
import { extractErrorMessage } from "../../utils/shared.ts";
import { DatabaseManager } from "../database.ts";
import {
	type AuthConfig,
	type TokenPayload,
	authMiddleware,
	login,
	register,
	requireRole,
} from "../middleware/auth.ts";
import {
	defaultRateLimits,
	rateLimitMiddleware,
} from "../middleware/rate-limit.ts";

const logger = createLogger("ralph-orchestrator.web.api");

/**
 * API configuration
 */
export interface APIConfig {
	auth: AuthConfig;
}

/**
 * Active orchestrator instances
 */
const activeOrchestrators = new Map<number, RalphOrchestrator>();

/**
 * Create API routes
 */
export function createAPIRoutes(config: APIConfig) {
	const api = new Hono();

	// Apply rate limiting
	api.use("/*", rateLimitMiddleware(defaultRateLimits.api));

	// Auth routes (no authentication required)
	const authRoutes = new Hono();

	authRoutes.use("/*", rateLimitMiddleware(defaultRateLimits.auth));

	authRoutes.post("/login", async (c) => {
		const body = await c.req.json<{ username: string; password: string }>();

		if (!body.username || !body.password) {
			return c.json(
				{ error: "Bad Request", message: "Username and password required" },
				400,
			);
		}

		const result = await login(body.username, body.password, config.auth);

		if (!result) {
			return c.json(
				{ error: "Unauthorized", message: "Invalid credentials" },
				401,
			);
		}

		return c.json({
			token: result.token,
			user: result.user,
		});
	});

	authRoutes.post("/register", async (c) => {
		// Only allow registration if auth is enabled
		if (config.auth.enabled === false) {
			return c.json(
				{ error: "Forbidden", message: "Registration disabled" },
				403,
			);
		}

		const body = await c.req.json<{ username: string; password: string }>();

		if (!body.username || !body.password) {
			return c.json(
				{ error: "Bad Request", message: "Username and password required" },
				400,
			);
		}

		if (body.password.length < 8) {
			return c.json(
				{
					error: "Bad Request",
					message: "Password must be at least 8 characters",
				},
				400,
			);
		}

		const user = await register(body.username, body.password);

		if (!user) {
			return c.json(
				{ error: "Conflict", message: "Username already exists" },
				409,
			);
		}

		return c.json({ user }, 201);
	});

	api.route("/auth", authRoutes);

	// Protected routes
	const protectedRoutes = new Hono<{ Variables: { user: TokenPayload } }>();

	// Apply auth middleware
	if (config.auth.enabled !== false) {
		protectedRoutes.use("/*", authMiddleware(config.auth));
	}

	// Status endpoint
	protectedRoutes.get("/status", (c) => {
		const db = DatabaseManager.getInstance();
		const stats = db.getStats();
		const running = db.getRunningRuns();

		return c.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			stats,
			activeRuns: running.length,
			version: "1.0.0",
		});
	});

	// User info
	protectedRoutes.get("/me", (c) => {
		const user = c.get("user");
		return c.json({ user });
	});

	// Runs
	protectedRoutes.get("/runs", (c) => {
		const db = DatabaseManager.getInstance();
		const limit = Number.parseInt(c.req.query("limit") ?? "10", 10);
		const runs = db.getRecentRuns(Math.min(limit, 100));
		return c.json({ runs });
	});

	protectedRoutes.get("/runs/active", (c) => {
		const db = DatabaseManager.getInstance();
		const runs = db.getRunningRuns();

		// Add real-time state from active orchestrators
		const enrichedRuns = runs.map((run) => {
			const orchestrator = activeOrchestrators.get(run.id);
			if (orchestrator) {
				return {
					...run,
					state: orchestrator.getState(),
				};
			}
			return run;
		});

		return c.json({ runs: enrichedRuns });
	});

	protectedRoutes.get("/runs/:id", (c) => {
		const db = DatabaseManager.getInstance();
		const id = Number.parseInt(c.req.param("id"), 10);
		const run = db.getRunById(id);

		if (!run) {
			return c.json({ error: "Not Found", message: "Run not found" }, 404);
		}

		const iterations = db.getIterationsForRun(id);
		const orchestrator = activeOrchestrators.get(id);

		return c.json({
			run,
			iterations,
			state: orchestrator?.getState(),
		});
	});

	protectedRoutes.get("/runs/:id/iterations", (c) => {
		const db = DatabaseManager.getInstance();
		const id = Number.parseInt(c.req.param("id"), 10);
		const iterations = db.getIterationsForRun(id);
		return c.json({ iterations });
	});

	// Start new run
	protectedRoutes.post(
		"/runs",
		requireRole("admin", "user"),
		rateLimitMiddleware(defaultRateLimits.start),
		async (c) => {
			try {
				const body = await c.req.json<{
					configFile?: string;
					agent?: string;
					promptFile?: string;
					promptText?: string;
					maxIterations?: number;
					maxRuntime?: number;
				}>();

				// Load config
				let config;
				if (body.configFile) {
					const loaded = await loadConfig(body.configFile);
					config = loaded.config;
				} else {
					const { createConfigFromArgs } = await import("../../config.ts");
					config = createConfigFromArgs({
						agent: body.agent,
						prompt: body.promptFile,
						promptText: body.promptText,
						maxIterations: body.maxIterations,
						maxRuntime: body.maxRuntime,
					});
				}

				// Create database record
				const db = DatabaseManager.getInstance();
				const runRecord = db.createRun(config.agent, config.promptFile);

				if (!runRecord) {
					return c.json(
						{
							error: "Internal Server Error",
							message: "Failed to create run record",
						},
						500,
					);
				}

				// Create orchestrator
				const orchestrator = new RalphOrchestrator(config);
				activeOrchestrators.set(runRecord.id, orchestrator);

				// Start orchestration in background
				orchestrator
					.run()
					.then(() => {
						const state = orchestrator.getState();
						db.updateRunStatus(
							runRecord.id,
							"completed",
							state.iteration,
							state.runtime,
							orchestrator.getCostSummary().totalCost,
						);
						activeOrchestrators.delete(runRecord.id);
						logger.info(`Run ${runRecord.id} completed`);
					})
					.catch((error) => {
						const message = extractErrorMessage(error);
						db.updateRunStatus(
							runRecord.id,
							"error",
							undefined,
							undefined,
							undefined,
							message,
						);
						activeOrchestrators.delete(runRecord.id);
						logger.error(`Run ${runRecord.id} failed: ${message}`);
					});

				return c.json({ run: runRecord, message: "Run started" }, 201);
			} catch (error) {
				const message = extractErrorMessage(error);
				logger.error(`Failed to start run: ${message}`);
				return c.json({ error: "Internal Server Error", message }, 500);
			}
		},
	);

	// Stop run
	protectedRoutes.post(
		"/runs/:id/stop",
		requireRole("admin", "user"),
		async (c) => {
			const id = Number.parseInt(c.req.param("id"), 10);
			const orchestrator = activeOrchestrators.get(id);

			if (!orchestrator) {
				return c.json(
					{ error: "Not Found", message: "Run not found or not active" },
					404,
				);
			}

			orchestrator.stop();

			return c.json({ message: "Stop requested" });
		},
	);

	// Statistics
	protectedRoutes.get("/stats", (c) => {
		const db = DatabaseManager.getInstance();
		const stats = db.getStats();
		return c.json({ stats });
	});

	// Configuration
	protectedRoutes.get("/config", requireRole("admin"), async (c) => {
		try {
			const configFile = c.req.query("file") ?? "ralph.yml";
			const loaded = await loadConfig(configFile);
			return c.json({
				config: loaded.config,
				validation: loaded.validation,
			});
		} catch {
			return c.json(
				{
					error: "Not Found",
					message: "Configuration file not found",
				},
				404,
			);
		}
	});

	api.route("/", protectedRoutes);

	return api;
}

/**
 * Get active orchestrator by run ID
 */
export function getActiveOrchestrator(
	runId: number,
): RalphOrchestrator | undefined {
	return activeOrchestrators.get(runId);
}

/**
 * Get all active orchestrator IDs
 */
export function getActiveOrchestratorIds(): number[] {
	return Array.from(activeOrchestrators.keys());
}
