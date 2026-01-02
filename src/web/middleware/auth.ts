/**
 * Authentication middleware for Ralph web dashboard
 */

import type { Context, Next } from "hono";
import { type JWTPayload, SignJWT, jwtVerify } from "jose";
import { createLogger } from "../../utils/logger.ts";
import { DatabaseManager, type User } from "../database.ts";

const logger = createLogger("ralph-orchestrator.web.auth");

/**
 * JWT payload with user info
 */
export interface TokenPayload extends JWTPayload {
	userId: number;
	username: string;
	role: User["role"];
}

/**
 * Auth configuration
 */
export interface AuthConfig {
	/** JWT secret key */
	secret: string;
	/** Token expiration time in seconds */
	expiresIn?: number;
	/** Enable authentication (default: true) */
	enabled?: boolean;
}

/**
 * Get secret key as Uint8Array
 */
function getSecretKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

/**
 * Generate JWT token for user
 */
export async function generateToken(
	user: User,
	config: AuthConfig,
): Promise<string> {
	const secretKey = getSecretKey(config.secret);
	const expiresIn = config.expiresIn ?? 86400; // 24 hours default

	const token = await new SignJWT({
		userId: user.id,
		username: user.username,
		role: user.role,
	} as TokenPayload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(`${expiresIn}s`)
		.sign(secretKey);

	return token;
}

/**
 * Verify JWT token
 */
export async function verifyToken(
	token: string,
	config: AuthConfig,
): Promise<TokenPayload | null> {
	try {
		const secretKey = getSecretKey(config.secret);
		const { payload } = await jwtVerify(token, secretKey);
		return payload as TokenPayload;
	} catch (error) {
		logger.debug(`Token verification failed: ${error}`);
		return null;
	}
}

/**
 * Hash password using Bun's native crypto
 */
export async function hashPassword(password: string): Promise<string> {
	return await Bun.password.hash(password, {
		algorithm: "bcrypt",
		cost: 10,
	});
}

/**
 * Verify password
 */
export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return await Bun.password.verify(password, hash);
}

/**
 * Create authentication middleware
 */
export function authMiddleware(config: AuthConfig) {
	return async (c: Context, next: Next) => {
		// Skip if auth is disabled
		if (config.enabled === false) {
			return next();
		}

		// Get token from Authorization header
		const authHeader = c.req.header("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return c.json(
				{
					error: "Unauthorized",
					message: "Missing or invalid authorization header",
				},
				401,
			);
		}

		const token = authHeader.substring(7);
		const payload = await verifyToken(token, config);

		if (!payload) {
			return c.json(
				{ error: "Unauthorized", message: "Invalid or expired token" },
				401,
			);
		}

		// Attach user info to context
		c.set("user", payload);

		return next();
	};
}

/**
 * Create role-based authorization middleware
 */
export function requireRole(...roles: User["role"][]) {
	return async (c: Context, next: Next) => {
		const user = c.get("user") as TokenPayload | undefined;

		if (!user) {
			return c.json(
				{ error: "Unauthorized", message: "Authentication required" },
				401,
			);
		}

		if (!roles.includes(user.role)) {
			return c.json(
				{ error: "Forbidden", message: "Insufficient permissions" },
				403,
			);
		}

		return next();
	};
}

/**
 * Login handler
 */
export async function login(
	username: string,
	password: string,
	config: AuthConfig,
): Promise<{ token: string; user: Omit<User, "passwordHash"> } | null> {
	const db = DatabaseManager.getInstance();
	const user = db.getUserByUsername(username);

	if (!user) {
		logger.debug(`Login failed: user not found - ${username}`);
		return null;
	}

	const valid = await verifyPassword(password, user.passwordHash);
	if (!valid) {
		logger.debug(`Login failed: invalid password - ${username}`);
		return null;
	}

	// Update last login
	db.updateLastLogin(user.id);

	// Generate token
	const token = await generateToken(user, config);

	logger.info(`User logged in: ${username}`);

	// Return token and user info (without password hash)
	const { passwordHash: _, ...safeUser } = user;
	return { token, user: safeUser };
}

/**
 * Register new user
 */
export async function register(
	username: string,
	password: string,
	role: User["role"] = "viewer",
): Promise<Omit<User, "passwordHash"> | null> {
	const db = DatabaseManager.getInstance();

	// Check if user exists
	const existing = db.getUserByUsername(username);
	if (existing) {
		logger.debug(`Registration failed: user exists - ${username}`);
		return null;
	}

	// Hash password
	const passwordHash = await hashPassword(password);

	// Create user
	const user = db.createUser(username, passwordHash, role);
	if (!user) {
		return null;
	}

	logger.info(`User registered: ${username}`);

	// Return user info (without password hash)
	const { passwordHash: _, ...safeUser } = user;
	return safeUser;
}

/**
 * Initialize default admin user if none exists
 */
export async function initDefaultAdmin(adminPassword?: string): Promise<void> {
	const db = DatabaseManager.getInstance();

	// Check if any admin exists
	const admin = db.getUserByUsername("admin");
	if (admin) {
		logger.debug("Admin user already exists");
		return;
	}

	// Create default admin
	const password =
		adminPassword ?? process.env.RALPH_ADMIN_PASSWORD ?? "admin123";
	const user = await register("admin", password, "admin");

	if (user) {
		logger.info("Default admin user created");
	}
}
