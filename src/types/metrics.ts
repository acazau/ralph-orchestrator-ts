/**
 * Metrics types for Ralph Orchestrator
 */

/**
 * Reasons why an iteration was triggered
 */
export enum TriggerReason {
	/** First iteration of a session */
	INITIAL = "initial",
	/** Previous iteration didn't complete task */
	TASK_INCOMPLETE = "task_incomplete",
	/** Previous iteration succeeded, continuing */
	PREVIOUS_SUCCESS = "previous_success",
	/** Recovering from a previous failure */
	RECOVERY = "recovery",
	/** Loop detection triggered intervention */
	LOOP_DETECTED = "loop_detected",
	/** Safety limits triggered */
	SAFETY_LIMIT = "safety_limit",
	/** User requested stop */
	USER_STOP = "user_stop",
}

/**
 * Basic orchestration metrics
 */
export interface Metrics {
	iterations: number;
	successfulIterations: number;
	failedIterations: number;
	errors: number;
	checkpoints: number;
	rollbacks: number;
	startTime: number;
}

/**
 * Create default metrics
 */
export function createMetrics(): Metrics {
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
 * Calculate elapsed time in hours
 */
export function elapsedHours(metrics: Metrics): number {
	return (Date.now() - metrics.startTime) / 3600000;
}

/**
 * Calculate success rate (0-1)
 */
export function successRate(metrics: Metrics): number {
	const total = metrics.successfulIterations + metrics.failedIterations;
	if (total === 0) return 0;
	return metrics.successfulIterations / total;
}

/**
 * Convert metrics to dictionary
 */
export function metricsToDict(metrics: Metrics): Record<string, unknown> {
	return {
		iterations: metrics.iterations,
		successfulIterations: metrics.successfulIterations,
		failedIterations: metrics.failedIterations,
		errors: metrics.errors,
		checkpoints: metrics.checkpoints,
		rollbacks: metrics.rollbacks,
		elapsedHours: elapsedHours(metrics),
		successRate: successRate(metrics),
	};
}

/**
 * Single iteration data
 */
export interface IterationData {
	iteration: number;
	duration: number;
	success: boolean;
	error: string;
	timestamp: string;
	triggerReason: TriggerReason | string;
	outputPreview: string;
	tokensUsed: number;
	cost: number;
	toolsUsed: string[];
}

/**
 * Cost entry for tracking
 */
export interface CostEntry {
	timestamp: number;
	tool: string;
	inputTokens: number;
	outputTokens: number;
	cost: number;
}

/**
 * Cost summary
 */
export interface CostSummary {
	totalCost: number;
	costsByTool: Record<string, number>;
	usageCount: number;
	averageCost: number;
}

/**
 * Iteration statistics summary
 */
export interface IterationStatsSummary {
	total: number;
	current: number;
	successes: number;
	failures: number;
	successRate: number;
	runtime: string;
	startTime: string | null;
}

/**
 * Full metrics summary for serialization
 */
export interface MetricsSummary {
	summary: {
		iterations: number;
		successful: number;
		failed: number;
		errors: number;
		checkpoints: number;
		rollbacks: number;
	};
	iterations: IterationData[];
	cost: CostSummary;
	analysis: {
		avgIterationDuration: number;
		successRate: number;
	};
}
