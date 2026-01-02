/**
 * Context manager for Ralph Orchestrator
 */

import { createLogger } from "../utils/logger.ts";

const logger = createLogger("ralph-orchestrator.context");

/**
 * Context manager options
 */
export interface ContextManagerOptions {
	/** Path to prompt file */
	promptFile?: string;
	/** Direct prompt text (overrides promptFile) */
	promptText?: string;
	/** Maximum context size in characters */
	maxContextSize?: number;
	/** Cache directory path */
	cacheDir?: string;
}

/**
 * Context statistics
 */
export interface ContextStats {
	promptLength: number;
	contextLength: number;
	errorCount: number;
	lastUpdated: string | null;
}

/**
 * Context manager for handling prompts and context
 */
export class ContextManager {
	private promptFile: string | null;
	private promptText: string | null;
	private readonly maxContextSize: number;
	private readonly cacheDir: string;
	private context = "";
	private errorHistory: string[] = [];
	private lastUpdated: Date | null = null;

	constructor(options: ContextManagerOptions = {}) {
		this.promptFile = options.promptFile ?? null;
		this.promptText = options.promptText ?? null;
		this.maxContextSize = options.maxContextSize ?? 8000;
		this.cacheDir = options.cacheDir ?? ".agent/cache";
	}

	/**
	 * Get the current prompt
	 */
	async getPrompt(): Promise<string> {
		// Direct prompt text takes precedence
		if (this.promptText) {
			return this.promptText;
		}

		// Read from file
		if (this.promptFile) {
			const file = Bun.file(this.promptFile);
			if (await file.exists()) {
				return await file.text();
			}
			throw new Error(`Prompt file not found: ${this.promptFile}`);
		}

		throw new Error("No prompt text or file specified");
	}

	/**
	 * Set direct prompt text
	 */
	setPromptText(text: string): void {
		this.promptText = text;
	}

	/**
	 * Set prompt file path
	 */
	setPromptFile(path: string): void {
		this.promptFile = path;
		this.promptText = null; // Clear direct text when setting file
	}

	/**
	 * Update context with new output
	 */
	updateContext(output: string): void {
		this.context = output;
		this.lastUpdated = new Date();

		// Trim if too long
		if (this.context.length > this.maxContextSize) {
			const trimmed = this.context.slice(-this.maxContextSize);
			this.context = `[...truncated...]\n${trimmed}`;
			logger.debug("Context truncated due to size limit");
		}
	}

	/**
	 * Add error feedback to context
	 */
	addErrorFeedback(error: string): void {
		this.errorHistory.push(error);

		// Keep only recent errors
		if (this.errorHistory.length > 10) {
			this.errorHistory.shift();
		}
	}

	/**
	 * Get current context
	 */
	getContext(): string {
		return this.context;
	}

	/**
	 * Get error history
	 */
	getErrorHistory(): string[] {
		return [...this.errorHistory];
	}

	/**
	 * Get last error
	 */
	getLastError(): string | null {
		return this.errorHistory.length > 0
			? (this.errorHistory.at(-1) ?? null)
			: null;
	}

	/**
	 * Clear error history
	 */
	clearErrors(): void {
		this.errorHistory = [];
	}

	/**
	 * Reset context
	 */
	reset(): void {
		this.context = "";
		this.errorHistory = [];
		this.lastUpdated = null;
	}

	/**
	 * Get context statistics
	 */
	async getStats(): Promise<ContextStats> {
		let promptLength = 0;
		try {
			const prompt = await this.getPrompt();
			promptLength = prompt.length;
		} catch {
			// Ignore errors getting prompt length
		}

		return {
			promptLength,
			contextLength: this.context.length,
			errorCount: this.errorHistory.length,
			lastUpdated: this.lastUpdated?.toISOString() ?? null,
		};
	}

	/**
	 * Check if prompt file has completion marker
	 */
	async hasCompletionMarker(): Promise<boolean> {
		try {
			const prompt = await this.getPrompt();
			const markers = [
				"TASK_COMPLETE",
				"[x] All tasks completed",
				"## COMPLETED",
				"All items have been completed",
			];

			for (const marker of markers) {
				if (prompt.includes(marker)) {
					return true;
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Write updated prompt back to file
	 */
	async writePrompt(content: string): Promise<void> {
		if (!this.promptFile) {
			throw new Error("No prompt file specified");
		}

		await Bun.write(this.promptFile, content);
		logger.debug(`Updated prompt file: ${this.promptFile}`);
	}

	/**
	 * Ensure cache directory exists
	 */
	async ensureCacheDir(): Promise<void> {
		const { mkdir } = await import("node:fs/promises");
		await mkdir(this.cacheDir, { recursive: true });
	}

	/**
	 * Save context to cache
	 */
	async saveToCache(key: string): Promise<void> {
		await this.ensureCacheDir();
		const cachePath = `${this.cacheDir}/${key}.json`;
		const data = {
			context: this.context,
			errorHistory: this.errorHistory,
			lastUpdated: this.lastUpdated?.toISOString(),
			savedAt: new Date().toISOString(),
		};
		await Bun.write(cachePath, JSON.stringify(data, null, 2));
	}

	/**
	 * Load context from cache
	 */
	async loadFromCache(key: string): Promise<boolean> {
		const cachePath = `${this.cacheDir}/${key}.json`;
		const file = Bun.file(cachePath);

		if (!(await file.exists())) {
			return false;
		}

		try {
			const data = await file.json();
			this.context = data.context ?? "";
			this.errorHistory = data.errorHistory ?? [];
			this.lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : null;
			return true;
		} catch (error) {
			logger.warn(`Failed to load cache: ${error}`);
			return false;
		}
	}
}
