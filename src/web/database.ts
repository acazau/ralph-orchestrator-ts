/**
 * SQLite database for Ralph Orchestrator web dashboard
 */

import { Database } from "bun:sqlite";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("ralph-orchestrator.web.database");

/**
 * User record
 */
export interface User {
	id: number;
	username: string;
	passwordHash: string;
	role: "admin" | "user" | "viewer";
	createdAt: string;
	lastLoginAt?: string;
}

/**
 * Session record
 */
export interface Session {
	id: number;
	userId: number;
	token: string;
	expiresAt: string;
	createdAt: string;
}

/**
 * Run record (orchestration run history)
 */
export interface RunRecord {
	id: number;
	status: "running" | "completed" | "error" | "stopped";
	agent: string;
	promptFile: string;
	iterations: number;
	runtime: number;
	totalCost: number;
	startedAt: string;
	completedAt?: string;
	errorMessage?: string;
}

/**
 * Iteration record
 */
export interface IterationRecord {
	id: number;
	runId: number;
	iteration: number;
	success: boolean;
	duration: number;
	tokensUsed?: number;
	cost?: number;
	outputPreview?: string;
	error?: string;
	createdAt: string;
}

/**
 * Input for adding an iteration (excludes auto-generated fields)
 */
export interface AddIterationInput {
	runId: number;
	iteration: number;
	success: boolean;
	duration: number;
	tokensUsed?: number;
	cost?: number;
	outputPreview?: string;
	error?: string;
}

/**
 * Database manager
 */
export class DatabaseManager {
	private readonly db: Database;
	private static instance: DatabaseManager | null = null;

	private constructor(dbPath = ".agent/ralph.db") {
		this.db = new Database(dbPath);
		this.initialize();
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(dbPath?: string): DatabaseManager {
		DatabaseManager.instance ??= new DatabaseManager(dbPath);
		return DatabaseManager.instance;
	}

	/**
	 * Initialize database schema
	 */
	private initialize(): void {
		logger.debug("Initializing database schema");

		// Users table
		this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at TEXT
      )
    `);

		// Sessions table
		this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

		// Runs table
		this.db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL DEFAULT 'running',
        agent TEXT NOT NULL,
        prompt_file TEXT NOT NULL,
        iterations INTEGER NOT NULL DEFAULT 0,
        runtime REAL NOT NULL DEFAULT 0,
        total_cost REAL NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        error_message TEXT
      )
    `);

		// Iterations table
		this.db.run(`
      CREATE TABLE IF NOT EXISTS iterations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        iteration INTEGER NOT NULL,
        success INTEGER NOT NULL,
        duration REAL NOT NULL,
        tokens_used INTEGER,
        cost REAL,
        output_preview TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      )
    `);

		// Create indexes
		this.db.run(
			"CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)",
		);
		this.db.run(
			"CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)",
		);
		this.db.run("CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status)");
		this.db.run(
			"CREATE INDEX IF NOT EXISTS idx_iterations_run ON iterations(run_id)",
		);

		logger.debug("Database schema initialized");
	}

	/**
	 * Create a user
	 */
	createUser(
		username: string,
		passwordHash: string,
		role: User["role"] = "viewer",
	): User | null {
		try {
			const stmt = this.db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, ?)
      `);
			const result = stmt.run(username, passwordHash, role);
			return this.getUserById(Number(result.lastInsertRowid));
		} catch (error) {
			logger.error(`Failed to create user: ${error}`);
			return null;
		}
	}

	/**
	 * Get user by ID
	 */
	getUserById(id: number): User | null {
		const row = this.db
			.prepare("SELECT * FROM users WHERE id = ?")
			.get(id) as Record<string, unknown> | null;
		return row ? this.mapUser(row) : null;
	}

	/**
	 * Get user by username
	 */
	getUserByUsername(username: string): User | null {
		const row = this.db
			.prepare("SELECT * FROM users WHERE username = ?")
			.get(username) as Record<string, unknown> | null;
		return row ? this.mapUser(row) : null;
	}

	/**
	 * Update last login
	 */
	updateLastLogin(userId: number): void {
		this.db
			.prepare(
				"UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
			)
			.run(userId);
	}

	/**
	 * Create a session
	 */
	createSession(
		userId: number,
		token: string,
		expiresAt: Date,
	): Session | null {
		try {
			const stmt = this.db.prepare(`
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `);
			const result = stmt.run(userId, token, expiresAt.toISOString());
			return this.getSessionById(Number(result.lastInsertRowid));
		} catch (error) {
			logger.error(`Failed to create session: ${error}`);
			return null;
		}
	}

	/**
	 * Get session by ID
	 */
	getSessionById(id: number): Session | null {
		const row = this.db
			.prepare("SELECT * FROM sessions WHERE id = ?")
			.get(id) as Record<string, unknown> | null;
		return row ? this.mapSession(row) : null;
	}

	/**
	 * Get session by token
	 */
	getSessionByToken(token: string): Session | null {
		const row = this.db
			.prepare(
				'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")',
			)
			.get(token) as Record<string, unknown> | null;
		return row ? this.mapSession(row) : null;
	}

	/**
	 * Delete expired sessions
	 */
	cleanupExpiredSessions(): void {
		this.db
			.prepare('DELETE FROM sessions WHERE expires_at <= datetime("now")')
			.run();
	}

	/**
	 * Create a run record
	 */
	createRun(agent: string, promptFile: string): RunRecord | null {
		try {
			const stmt = this.db.prepare(`
        INSERT INTO runs (agent, prompt_file)
        VALUES (?, ?)
      `);
			const result = stmt.run(agent, promptFile);
			return this.getRunById(Number(result.lastInsertRowid));
		} catch (error) {
			logger.error(`Failed to create run: ${error}`);
			return null;
		}
	}

	/**
	 * Get run by ID
	 */
	getRunById(id: number): RunRecord | null {
		const row = this.db
			.prepare("SELECT * FROM runs WHERE id = ?")
			.get(id) as Record<string, unknown> | null;
		return row ? this.mapRun(row) : null;
	}

	/**
	 * Get recent runs
	 */
	getRecentRuns(limit = 10): RunRecord[] {
		const rows = this.db
			.prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?")
			.all(limit) as Record<string, unknown>[];
		return rows.map((row) => this.mapRun(row));
	}

	/**
	 * Get running runs
	 */
	getRunningRuns(): RunRecord[] {
		const rows = this.db
			.prepare(
				'SELECT * FROM runs WHERE status = "running" ORDER BY started_at DESC',
			)
			.all() as Record<string, unknown>[];
		return rows.map((row) => this.mapRun(row));
	}

	/**
	 * Update run status
	 */
	updateRunStatus(
		id: number,
		status: RunRecord["status"],
		iterations?: number,
		runtime?: number,
		totalCost?: number,
		errorMessage?: string,
	): void {
		const completedAt = status === "running" ? null : new Date().toISOString();
		this.db
			.prepare(`
      UPDATE runs
      SET status = ?,
          iterations = COALESCE(?, iterations),
          runtime = COALESCE(?, runtime),
          total_cost = COALESCE(?, total_cost),
          completed_at = COALESCE(?, completed_at),
          error_message = ?
      WHERE id = ?
    `)
			.run(
				status,
				iterations ?? null,
				runtime ?? null,
				totalCost ?? null,
				completedAt,
				errorMessage ?? null,
				id,
			);
	}

	/**
	 * Add iteration record
	 */
	addIteration(input: AddIterationInput): IterationRecord | null {
		try {
			const stmt = this.db.prepare(`
        INSERT INTO iterations (run_id, iteration, success, duration, tokens_used, cost, output_preview, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
			const result = stmt.run(
				input.runId,
				input.iteration,
				input.success ? 1 : 0,
				input.duration,
				input.tokensUsed ?? null,
				input.cost ?? null,
				input.outputPreview ?? null,
				input.error ?? null,
			);
			return this.getIterationById(Number(result.lastInsertRowid));
		} catch (error) {
			logger.error(`Failed to add iteration: ${error}`);
			return null;
		}
	}

	/**
	 * Get iteration by ID
	 */
	getIterationById(id: number): IterationRecord | null {
		const row = this.db
			.prepare("SELECT * FROM iterations WHERE id = ?")
			.get(id) as Record<string, unknown> | null;
		return row ? this.mapIteration(row) : null;
	}

	/**
	 * Get iterations for a run
	 */
	getIterationsForRun(runId: number): IterationRecord[] {
		const rows = this.db
			.prepare(
				"SELECT * FROM iterations WHERE run_id = ? ORDER BY iteration ASC",
			)
			.all(runId) as Record<string, unknown>[];
		return rows.map((row) => this.mapIteration(row));
	}

	/**
	 * Get statistics
	 */
	getStats(): {
		totalRuns: number;
		runningRuns: number;
		completedRuns: number;
		errorRuns: number;
		totalIterations: number;
		totalCost: number;
	} {
		const stats = this.db
			.prepare(`
      SELECT
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_runs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_runs,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_runs,
        SUM(iterations) as total_iterations,
        SUM(total_cost) as total_cost
      FROM runs
    `)
			.get() as Record<string, unknown>;

		return {
			totalRuns: Number(stats.total_runs) || 0,
			runningRuns: Number(stats.running_runs) || 0,
			completedRuns: Number(stats.completed_runs) || 0,
			errorRuns: Number(stats.error_runs) || 0,
			totalIterations: Number(stats.total_iterations) || 0,
			totalCost: Number(stats.total_cost) || 0,
		};
	}

	/**
	 * Close database
	 */
	close(): void {
		this.db.close();
		DatabaseManager.instance = null;
	}

	// Mapping helpers
	private mapUser(row: Record<string, unknown>): User {
		return {
			id: row.id as number,
			username: row.username as string,
			passwordHash: row.password_hash as string,
			role: row.role as User["role"],
			createdAt: row.created_at as string,
			lastLoginAt: row.last_login_at as string | undefined,
		};
	}

	private mapSession(row: Record<string, unknown>): Session {
		return {
			id: row.id as number,
			userId: row.user_id as number,
			token: row.token as string,
			expiresAt: row.expires_at as string,
			createdAt: row.created_at as string,
		};
	}

	private mapRun(row: Record<string, unknown>): RunRecord {
		return {
			id: row.id as number,
			status: row.status as RunRecord["status"],
			agent: row.agent as string,
			promptFile: row.prompt_file as string,
			iterations: row.iterations as number,
			runtime: row.runtime as number,
			totalCost: row.total_cost as number,
			startedAt: row.started_at as string,
			completedAt: row.completed_at as string | undefined,
			errorMessage: row.error_message as string | undefined,
		};
	}

	private mapIteration(row: Record<string, unknown>): IterationRecord {
		return {
			id: row.id as number,
			runId: row.run_id as number,
			iteration: row.iteration as number,
			success: Boolean(row.success),
			duration: row.duration as number,
			tokensUsed: row.tokens_used as number | undefined,
			cost: row.cost as number | undefined,
			outputPreview: row.output_preview as string | undefined,
			error: row.error as string | undefined,
			createdAt: row.created_at as string,
		};
	}
}
