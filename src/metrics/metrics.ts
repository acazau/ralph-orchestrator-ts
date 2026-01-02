/**
 * Basic metrics tracking for Ralph Orchestrator
 */

import type { Metrics } from "../types/index.ts";
import { toJsonString } from "../utils/shared.ts";

/**
 * Create initial metrics object
 */
function createInitialMetrics(): Metrics {
	return {
		iterations: 0,
		successfulIterations: 0,
		failedIterations: 0,
		errors: 0,
		checkpoints: 0,
		rollbacks: 0,
		startTime: Date.now(),
	};
}

/**
 * Metrics tracker class
 */
export class MetricsTracker {
	private metrics: Metrics;

	constructor() {
		this.metrics = createInitialMetrics();
	}

	/**
	 * Record an iteration
	 */
	recordIteration(success: boolean): void {
		this.metrics.iterations++;
		if (success) {
			this.metrics.successfulIterations++;
		} else {
			this.metrics.failedIterations++;
		}
	}

	/**
	 * Record an error
	 */
	recordError(): void {
		this.metrics.errors++;
	}

	/**
	 * Record a checkpoint
	 */
	recordCheckpoint(): void {
		this.metrics.checkpoints++;
	}

	/**
	 * Record a rollback
	 */
	recordRollback(): void {
		this.metrics.rollbacks++;
	}

	/**
	 * Get elapsed time in seconds
	 */
	getElapsedSeconds(): number {
		return (Date.now() - this.metrics.startTime) / 1000;
	}

	/**
	 * Get elapsed time in hours
	 */
	getElapsedHours(): number {
		return this.getElapsedSeconds() / 3600;
	}

	/**
	 * Get success rate (0-1)
	 */
	getSuccessRate(): number {
		const total =
			this.metrics.successfulIterations + this.metrics.failedIterations;
		if (total === 0) return 0;
		return this.metrics.successfulIterations / total;
	}

	/**
	 * Get current metrics
	 */
	getMetrics(): Metrics {
		return { ...this.metrics };
	}

	/**
	 * Convert to dictionary for serialization
	 */
	toDict(): Record<string, unknown> {
		return {
			iterations: this.metrics.iterations,
			successfulIterations: this.metrics.successfulIterations,
			failedIterations: this.metrics.failedIterations,
			errors: this.metrics.errors,
			checkpoints: this.metrics.checkpoints,
			rollbacks: this.metrics.rollbacks,
			elapsedHours: this.getElapsedHours(),
			successRate: this.getSuccessRate(),
		};
	}

	/**
	 * Convert to JSON string
	 */
	toJson(): string {
		return toJsonString(this.toDict());
	}

	/**
	 * Reset metrics
	 */
	reset(): void {
		this.metrics = createInitialMetrics();
	}
}
