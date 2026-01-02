/**
 * Logging utilities for Ralph Orchestrator
 */

import chalk from "chalk";

/**
 * Log levels
 */
export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	SILENT = 4,
}

/**
 * Current log level (can be changed at runtime)
 */
let currentLogLevel: LogLevel = LogLevel.INFO;

/**
 * Set the current log level
 */
export function setLogLevel(level: LogLevel): void {
	currentLogLevel = level;
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
	return currentLogLevel;
}

/**
 * Format a timestamp for logging
 */
function formatTimestamp(): string {
	return new Date().toISOString();
}

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string) {
	const formatMessage = (level: string, message: string): string => {
		return `${formatTimestamp()} - ${prefix} - ${level} - ${message}`;
	};

	return {
		debug: (message: string, ...args: unknown[]) => {
			if (currentLogLevel <= LogLevel.DEBUG) {
				console.debug(chalk.gray(formatMessage("DEBUG", message)), ...args);
			}
		},

		info: (message: string, ...args: unknown[]) => {
			if (currentLogLevel <= LogLevel.INFO) {
				console.info(chalk.blue(formatMessage("INFO", message)), ...args);
			}
		},

		warn: (message: string, ...args: unknown[]) => {
			if (currentLogLevel <= LogLevel.WARN) {
				console.warn(chalk.yellow(formatMessage("WARN", message)), ...args);
			}
		},

		error: (message: string, ...args: unknown[]) => {
			if (currentLogLevel <= LogLevel.ERROR) {
				console.error(chalk.red(formatMessage("ERROR", message)), ...args);
			}
		},

		success: (message: string, ...args: unknown[]) => {
			if (currentLogLevel <= LogLevel.INFO) {
				console.info(chalk.green(formatMessage("SUCCESS", message)), ...args);
			}
		},
	};
}

/**
 * Default logger instance
 */
export const logger = createLogger("ralph-orchestrator");

/**
 * Mask sensitive data in strings (API keys, tokens, etc.)
 */
export function maskSensitiveData(text: string): string {
	// Mask API keys (various patterns)
	// Note: Patterns are designed to avoid ReDoS by limiting backtracking
	const patterns = [
		// API key patterns - simplified to avoid nested quantifiers
		/((?:api[-_]?key|token|secret|password|credential)[=:]\s*)(['"]?)([^\s'"]{8,})\2/gi,
		// Bearer tokens
		/(Bearer\s+)([^\s]{8,})/gi,
		// Generic long alphanumeric strings that look like tokens
		/\b(sk-[a-zA-Z0-9]{20,})\b/g,
		/\b(pk-[a-zA-Z0-9]{20,})\b/g,
	];

	let masked = text;
	for (const pattern of patterns) {
		masked = masked.replace(pattern, (match, prefix, ...rest) => {
			if (rest.length >= 2) {
				const value = rest.at(-3) || rest[0];
				if (typeof value === "string" && value.length > 8) {
					const suffix = rest.at(-2) || "";
					return `${prefix}${value.substring(0, 4)}${"*".repeat(Math.min(value.length - 8, 20))}${value.substring(value.length - 4)}${suffix}`;
				}
			}
			return match;
		});
	}

	return masked;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${Math.round(seconds)}s`;
	}
	if (seconds < 3600) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return `${mins}m ${secs}s`;
	}
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = Math.round(seconds % 60);
	return `${hours}h ${mins}m ${secs}s`;
}
