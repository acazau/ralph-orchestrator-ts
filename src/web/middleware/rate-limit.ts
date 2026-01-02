/**
 * Rate limiting middleware for Ralph web dashboard
 */

import type { Context, Next } from "hono";
import { createLogger } from "../../utils/logger.ts";

const logger = createLogger("ralph-orchestrator.web.rate-limit");

/**
 * Rate limit entry
 */
interface RateLimitEntry {
	count: number;
	resetAt: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
	/** Maximum requests per window */
	maxRequests: number;
	/** Window duration in milliseconds */
	windowMs: number;
	/** Custom key extractor (default: IP address) */
	keyExtractor?: (c: Context) => string;
	/** Skip rate limiting for certain requests */
	skip?: (c: Context) => boolean;
	/** Custom error response */
	errorResponse?: (c: Context, retryAfter: number) => Response;
}

/**
 * In-memory store for rate limit entries
 */
const store = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
	if (cleanupInterval) return;

	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (entry.resetAt <= now) {
				store.delete(key);
			}
		}
	}, 60000); // Clean every minute
}

function stopCleanup(): void {
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
}

/**
 * Default key extractor - uses IP address
 */
function defaultKeyExtractor(c: Context): string {
	// Try various headers for IP address
	const forwarded = c.req.header("X-Forwarded-For");
	if (forwarded) {
		return forwarded.split(",")[0]!.trim();
	}

	const realIp = c.req.header("X-Real-IP");
	if (realIp) {
		return realIp;
	}

	// Fallback to connected address (if available)
	return "unknown";
}

/**
 * Create rate limiting middleware
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
	// Start cleanup if not already running
	startCleanup();

	return async (c: Context, next: Next) => {
		// Check if should skip
		if (config.skip?.(c)) {
			return next();
		}

		const key = (config.keyExtractor ?? defaultKeyExtractor)(c);
		const now = Date.now();

		// Get or create entry
		let entry = store.get(key);

		if (!entry || entry.resetAt <= now) {
			// Create new entry
			entry = {
				count: 0,
				resetAt: now + config.windowMs,
			};
			store.set(key, entry);
		}

		// Increment count
		entry.count++;

		// Set rate limit headers
		const remaining = Math.max(0, config.maxRequests - entry.count);
		const resetAt = Math.ceil(entry.resetAt / 1000);
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

		c.header("X-RateLimit-Limit", String(config.maxRequests));
		c.header("X-RateLimit-Remaining", String(remaining));
		c.header("X-RateLimit-Reset", String(resetAt));

		// Check if over limit
		if (entry.count > config.maxRequests) {
			logger.warn(`Rate limit exceeded for key: ${key}`);

			c.header("Retry-After", String(retryAfter));

			if (config.errorResponse) {
				return config.errorResponse(c, retryAfter);
			}

			return c.json(
				{
					error: "Too Many Requests",
					message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
					retryAfter,
				},
				429,
			);
		}

		return next();
	};
}

/**
 * Create a sliding window rate limiter (more accurate but uses more memory)
 */
export function slidingWindowRateLimiter(config: RateLimitConfig) {
	const windowStore = new Map<string, number[]>();

	// Start cleanup (interval is stored for potential future cleanup)
	setInterval(() => {
		const now = Date.now();
		const windowStart = now - config.windowMs;

		for (const [key, timestamps] of windowStore) {
			const validTimestamps = timestamps.filter((t) => t > windowStart);
			if (validTimestamps.length === 0) {
				windowStore.delete(key);
			} else {
				windowStore.set(key, validTimestamps);
			}
		}
	}, 60000);

	// Return middleware
	return async (c: Context, next: Next) => {
		// Check if should skip
		if (config.skip?.(c)) {
			return next();
		}

		const key = (config.keyExtractor ?? defaultKeyExtractor)(c);
		const now = Date.now();
		const windowStart = now - config.windowMs;

		// Get or create timestamps array
		let timestamps = windowStore.get(key) ?? [];

		// Filter to only include timestamps in current window
		timestamps = timestamps.filter((t) => t > windowStart);

		// Set rate limit headers
		const remaining = Math.max(0, config.maxRequests - timestamps.length);

		c.header("X-RateLimit-Limit", String(config.maxRequests));
		c.header("X-RateLimit-Remaining", String(remaining));

		// Check if over limit
		if (timestamps.length >= config.maxRequests) {
			const oldestInWindow = Math.min(...timestamps);
			const retryAfter = Math.ceil(
				(oldestInWindow + config.windowMs - now) / 1000,
			);

			logger.warn(`Sliding rate limit exceeded for key: ${key}`);

			c.header("Retry-After", String(retryAfter));

			if (config.errorResponse) {
				return config.errorResponse(c, retryAfter);
			}

			return c.json(
				{
					error: "Too Many Requests",
					message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
					retryAfter,
				},
				429,
			);
		}

		// Add current timestamp
		timestamps.push(now);
		windowStore.set(key, timestamps);

		return next();
	};
}

/**
 * Create rate limiter with different limits per endpoint
 */
export function createRateLimiters(configs: Record<string, RateLimitConfig>) {
	const limiters = new Map<string, ReturnType<typeof rateLimitMiddleware>>();

	for (const [name, config] of Object.entries(configs)) {
		limiters.set(name, rateLimitMiddleware(config));
	}

	return limiters;
}

/**
 * Default rate limit configurations
 */
export const defaultRateLimits = {
	// General API
	api: {
		maxRequests: 100,
		windowMs: 60000, // 1 minute
	},

	// Authentication endpoints
	auth: {
		maxRequests: 10,
		windowMs: 60000, // 1 minute
	},

	// Start orchestration
	start: {
		maxRequests: 5,
		windowMs: 60000, // 1 minute
	},

	// WebSocket connections
	websocket: {
		maxRequests: 10,
		windowMs: 60000, // 1 minute
	},
};

// Cleanup on process exit
process.on("exit", stopCleanup);
process.on("SIGINT", stopCleanup);
process.on("SIGTERM", stopCleanup);
