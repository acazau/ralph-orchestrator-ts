/**
 * Iteration statistics tracking for Ralph Orchestrator
 */

import {
	type IterationData,
	type IterationStatsSummary,
	TriggerReason,
} from "../types/index.ts";
import { toJsonString } from "../utils/shared.ts";

/**
 * Memory-efficient iteration statistics tracking
 */
export class IterationStats {
	total = 0;
	successes = 0;
	failures = 0;
	startTime: Date;
	currentIteration = 0;
	iterations: IterationData[] = [];
	maxIterationsStored: number;
	maxPreviewLength: number;

	constructor(maxIterationsStored = 1000, maxPreviewLength = 500) {
		this.startTime = new Date();
		this.maxIterationsStored = maxIterationsStored;
		this.maxPreviewLength = maxPreviewLength;
	}

	/**
	 * Record iteration start
	 */
	recordStart(iteration: number): void {
		this.currentIteration = iteration;
		this.total = Math.max(this.total, iteration);
	}

	/**
	 * Record successful iteration
	 */
	recordSuccess(iteration: number): void {
		this.total = iteration;
		this.successes++;
	}

	/**
	 * Record failed iteration
	 */
	recordFailure(iteration: number): void {
		this.total = iteration;
		this.failures++;
	}

	/**
	 * Record iteration with full details
	 */
	recordIteration(params: {
		iteration: number;
		duration: number;
		success: boolean;
		error: string;
		triggerReason?: TriggerReason | string;
		outputPreview?: string;
		tokensUsed?: number;
		cost?: number;
		toolsUsed?: string[];
	}): void {
		// Update basic statistics
		this.total = Math.max(this.total, params.iteration);
		this.currentIteration = params.iteration;

		if (params.success) {
			this.successes++;
		} else {
			this.failures++;
		}

		// Truncate output preview
		let outputPreview = params.outputPreview ?? "";
		if (outputPreview.length > this.maxPreviewLength) {
			outputPreview = outputPreview.substring(0, this.maxPreviewLength) + "...";
		}

		// Store detailed iteration information
		const iterationData: IterationData = {
			iteration: params.iteration,
			duration: params.duration,
			success: params.success,
			error: params.error,
			timestamp: new Date().toISOString(),
			triggerReason: params.triggerReason ?? TriggerReason.TASK_INCOMPLETE,
			outputPreview,
			tokensUsed: params.tokensUsed ?? 0,
			cost: params.cost ?? 0,
			toolsUsed: params.toolsUsed ?? [],
		};

		this.iterations.push(iterationData);

		// Enforce memory limit by evicting oldest entries
		if (this.iterations.length > this.maxIterationsStored) {
			const excess = this.iterations.length - this.maxIterationsStored;
			this.iterations = this.iterations.slice(excess);
		}
	}

	/**
	 * Get success rate as percentage (0-100)
	 */
	getSuccessRate(): number {
		const totalAttempts = this.successes + this.failures;
		if (totalAttempts === 0) return 0;
		return (this.successes / totalAttempts) * 100;
	}

	/**
	 * Get human-readable runtime duration
	 */
	getRuntime(): string {
		const delta = Date.now() - this.startTime.getTime();
		const totalSeconds = Math.floor(delta / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		}
		return `${seconds}s`;
	}

	/**
	 * Get runtime in seconds
	 */
	getRuntimeSeconds(): number {
		return (Date.now() - this.startTime.getTime()) / 1000;
	}

	/**
	 * Get most recent iterations
	 */
	getRecentIterations(count: number): IterationData[] {
		if (count >= this.iterations.length) {
			return [...this.iterations];
		}
		return this.iterations.slice(-count);
	}

	/**
	 * Get average iteration duration
	 */
	getAverageDuration(): number {
		if (this.iterations.length === 0) return 0;
		const totalDuration = this.iterations.reduce(
			(sum, it) => sum + it.duration,
			0,
		);
		return totalDuration / this.iterations.length;
	}

	/**
	 * Extract error messages from failed iterations
	 */
	getErrorMessages(): string[] {
		return this.iterations
			.filter((it) => !it.success && it.error)
			.map((it) => it.error);
	}

	/**
	 * Get last error message
	 */
	getLastError(): string | null {
		for (let i = this.iterations.length - 1; i >= 0; i--) {
			const it = this.iterations[i];
			if (it && !it.success && it.error) {
				return it.error;
			}
		}
		return null;
	}

	/**
	 * Convert to summary dictionary
	 */
	toSummary(): IterationStatsSummary {
		return {
			total: this.total,
			current: this.currentIteration,
			successes: this.successes,
			failures: this.failures,
			successRate: this.getSuccessRate(),
			runtime: this.getRuntime(),
			startTime: this.startTime.toISOString(),
		};
	}

	/**
	 * Convert to full dictionary (including iterations)
	 */
	toDict(): Record<string, unknown> {
		return {
			...this.toSummary(),
			iterations: this.iterations,
			averageDuration: this.getAverageDuration(),
		};
	}

	/**
	 * Convert to JSON string
	 */
	toJson(): string {
		return toJsonString(this.toDict());
	}

	/**
	 * Reset statistics
	 */
	reset(): void {
		this.total = 0;
		this.successes = 0;
		this.failures = 0;
		this.startTime = new Date();
		this.currentIteration = 0;
		this.iterations = [];
	}
}
