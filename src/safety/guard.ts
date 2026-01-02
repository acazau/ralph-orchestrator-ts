/**
 * Safety guard for Ralph Orchestrator
 */

import {
	DEFAULT_SAFETY_OPTIONS,
	type SafetyCheckParams,
	type SafetyCheckResult,
	type SafetyGuardOptions,
	safeFailed,
	safePassed,
} from "../types/index.ts";
import { similarityRatio } from "../utils/fuzzy-match.ts";
import { createLogger } from "../utils/logger.ts";

const logger = createLogger("ralph-orchestrator.safety");

/**
 * Safety guard class for orchestration
 */
export class SafetyGuard {
	private maxIterations: number;
	private maxRuntime: number;
	private maxCost: number;
	private consecutiveFailureLimit: number;
	private consecutiveFailures = 0;
	private recentOutputs: string[] = [];
	private loopThreshold: number;
	private maxRecentOutputs: number;

	constructor(options: SafetyGuardOptions = {}) {
		const opts = { ...DEFAULT_SAFETY_OPTIONS, ...options };
		this.maxIterations = opts.maxIterations;
		this.maxRuntime = opts.maxRuntime;
		this.maxCost = opts.maxCost;
		this.consecutiveFailureLimit = opts.consecutiveFailureLimit;
		this.loopThreshold = opts.loopThreshold;
		this.maxRecentOutputs = opts.maxRecentOutputs;
	}

	/**
	 * Check all safety conditions
	 */
	check(params: SafetyCheckParams): SafetyCheckResult {
		const { iterations, elapsedTime, totalCost } = params;

		// Check iteration limit
		if (iterations >= this.maxIterations) {
			return safeFailed(`Reached maximum iterations (${this.maxIterations})`);
		}

		// Check runtime limit
		if (elapsedTime >= this.maxRuntime) {
			const hours = (elapsedTime / 3600).toFixed(1);
			return safeFailed(`Reached maximum runtime (${hours} hours)`);
		}

		// Check cost limit
		if (totalCost >= this.maxCost) {
			return safeFailed(`Reached maximum cost ($${totalCost.toFixed(2)})`);
		}

		// Check consecutive failures
		if (this.consecutiveFailures >= this.consecutiveFailureLimit) {
			return safeFailed(
				`Too many consecutive failures (${this.consecutiveFailures})`,
			);
		}

		// Additional safety checks for high iteration counts
		if (iterations > 50) {
			logger.warn(`High iteration count: ${iterations}`);
		}

		if (iterations > 75) {
			// More aggressive checks
			if (elapsedTime / iterations > 300) {
				return safeFailed("Iterations taking too long on average");
			}
		}

		return safePassed();
	}

	/**
	 * Record a successful iteration
	 */
	recordSuccess(): void {
		this.consecutiveFailures = 0;
	}

	/**
	 * Record a failed iteration
	 */
	recordFailure(): void {
		this.consecutiveFailures++;
		logger.warn(`Consecutive failures: ${this.consecutiveFailures}`);
	}

	/**
	 * Get consecutive failure count
	 */
	getConsecutiveFailures(): number {
		return this.consecutiveFailures;
	}

	/**
	 * Reset safety counters
	 */
	reset(): void {
		this.consecutiveFailures = 0;
		this.recentOutputs = [];
	}

	/**
	 * Detect if agent is looping based on output similarity
	 */
	detectLoop(currentOutput: string): boolean {
		if (!currentOutput) {
			return false;
		}

		try {
			for (const prevOutput of this.recentOutputs) {
				const ratio = similarityRatio(currentOutput, prevOutput);
				if (ratio >= this.loopThreshold) {
					logger.warn(
						`Loop detected: ${(ratio * 100).toFixed(1)}% similarity to previous output`,
					);
					return true;
				}
			}

			// Add to recent outputs
			this.recentOutputs.push(currentOutput);
			if (this.recentOutputs.length > this.maxRecentOutputs) {
				this.recentOutputs.shift();
			}

			return false;
		} catch (error) {
			logger.warn(`Error in loop detection: ${error}`);
			return false;
		}
	}

	/**
	 * Clear loop detection history
	 */
	clearLoopHistory(): void {
		this.recentOutputs = [];
	}

	/**
	 * Update configuration
	 */
	updateConfig(options: Partial<SafetyGuardOptions>): void {
		if (options.maxIterations !== undefined) {
			this.maxIterations = options.maxIterations;
		}
		if (options.maxRuntime !== undefined) {
			this.maxRuntime = options.maxRuntime;
		}
		if (options.maxCost !== undefined) {
			this.maxCost = options.maxCost;
		}
		if (options.consecutiveFailureLimit !== undefined) {
			this.consecutiveFailureLimit = options.consecutiveFailureLimit;
		}
		if (options.loopThreshold !== undefined) {
			this.loopThreshold = options.loopThreshold;
		}
		if (options.maxRecentOutputs !== undefined) {
			this.maxRecentOutputs = options.maxRecentOutputs;
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Required<SafetyGuardOptions> {
		return {
			maxIterations: this.maxIterations,
			maxRuntime: this.maxRuntime,
			maxCost: this.maxCost,
			consecutiveFailureLimit: this.consecutiveFailureLimit,
			loopThreshold: this.loopThreshold,
			maxRecentOutputs: this.maxRecentOutputs,
		};
	}
}
