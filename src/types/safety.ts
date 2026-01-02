/**
 * Safety types for Ralph Orchestrator
 */

/**
 * Result of a safety check
 */
export interface SafetyCheckResult {
	/** Whether the check passed */
	passed: boolean;
	/** Reason for failure if check didn't pass */
	reason?: string;
}

/**
 * Create a passed safety check result
 */
export function safePassed(): SafetyCheckResult {
	return { passed: true };
}

/**
 * Create a failed safety check result
 */
export function safeFailed(reason: string): SafetyCheckResult {
	return { passed: false, reason };
}

/**
 * Options for SafetyGuard initialization
 */
export interface SafetyGuardOptions {
	/** Maximum allowed iterations (default: 100) */
	maxIterations?: number;
	/** Maximum runtime in seconds (default: 14400 = 4 hours) */
	maxRuntime?: number;
	/** Maximum allowed cost in USD (default: 10) */
	maxCost?: number;
	/** Maximum consecutive failures before stopping (default: 5) */
	consecutiveFailureLimit?: number;
	/** Similarity threshold for loop detection (default: 0.9 = 90%) */
	loopThreshold?: number;
	/** Maximum recent outputs to store for loop detection (default: 5) */
	maxRecentOutputs?: number;
}

/**
 * Default safety guard options
 */
export const DEFAULT_SAFETY_OPTIONS: Required<SafetyGuardOptions> = {
	maxIterations: 100,
	maxRuntime: 14400, // 4 hours
	maxCost: 10,
	consecutiveFailureLimit: 5,
	loopThreshold: 0.9,
	maxRecentOutputs: 5,
};

/**
 * Safety check input parameters
 */
export interface SafetyCheckParams {
	/** Current iteration count */
	iterations: number;
	/** Elapsed time in seconds */
	elapsedTime: number;
	/** Total cost so far in USD */
	totalCost: number;
}
