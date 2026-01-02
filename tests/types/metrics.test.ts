/**
 * Tests for metrics types
 */

import { describe, expect, test } from "bun:test";
import {
	TriggerReason,
	createMetrics,
	elapsedHours,
	successRate,
	metricsToDict,
	type Metrics,
	type IterationData,
	type CostEntry,
	type CostSummary,
	type IterationStatsSummary,
	type MetricsSummary,
} from "../../src/types/metrics.ts";

describe("TriggerReason enum", () => {
	test("should have INITIAL value", () => {
		expect(TriggerReason.INITIAL).toBe("initial");
	});

	test("should have TASK_INCOMPLETE value", () => {
		expect(TriggerReason.TASK_INCOMPLETE).toBe("task_incomplete");
	});

	test("should have PREVIOUS_SUCCESS value", () => {
		expect(TriggerReason.PREVIOUS_SUCCESS).toBe("previous_success");
	});

	test("should have RECOVERY value", () => {
		expect(TriggerReason.RECOVERY).toBe("recovery");
	});

	test("should have LOOP_DETECTED value", () => {
		expect(TriggerReason.LOOP_DETECTED).toBe("loop_detected");
	});

	test("should have SAFETY_LIMIT value", () => {
		expect(TriggerReason.SAFETY_LIMIT).toBe("safety_limit");
	});

	test("should have USER_STOP value", () => {
		expect(TriggerReason.USER_STOP).toBe("user_stop");
	});

	test("should have exactly 7 values", () => {
		const values = Object.values(TriggerReason);
		expect(values.length).toBe(7);
	});
});

describe("createMetrics", () => {
	test("should create metrics with zero iterations", () => {
		const metrics = createMetrics();
		expect(metrics.iterations).toBe(0);
	});

	test("should create metrics with zero successful iterations", () => {
		const metrics = createMetrics();
		expect(metrics.successfulIterations).toBe(0);
	});

	test("should create metrics with zero failed iterations", () => {
		const metrics = createMetrics();
		expect(metrics.failedIterations).toBe(0);
	});

	test("should create metrics with zero errors", () => {
		const metrics = createMetrics();
		expect(metrics.errors).toBe(0);
	});

	test("should create metrics with zero checkpoints", () => {
		const metrics = createMetrics();
		expect(metrics.checkpoints).toBe(0);
	});

	test("should create metrics with zero rollbacks", () => {
		const metrics = createMetrics();
		expect(metrics.rollbacks).toBe(0);
	});

	test("should set startTime to current timestamp", () => {
		const before = Date.now();
		const metrics = createMetrics();
		const after = Date.now();
		expect(metrics.startTime).toBeGreaterThanOrEqual(before);
		expect(metrics.startTime).toBeLessThanOrEqual(after);
	});

	test("should create independent instances", () => {
		const metrics1 = createMetrics();
		const metrics2 = createMetrics();
		metrics1.iterations = 5;
		expect(metrics2.iterations).toBe(0);
	});
});

describe("elapsedHours", () => {
	test("should return 0 for just created metrics", () => {
		const metrics = createMetrics();
		const hours = elapsedHours(metrics);
		expect(hours).toBeCloseTo(0, 4);
	});

	test("should calculate elapsed hours correctly", () => {
		const metrics: Metrics = {
			iterations: 0,
			successfulIterations: 0,
			failedIterations: 0,
			errors: 0,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now() - 3600000, // 1 hour ago
		};
		const hours = elapsedHours(metrics);
		expect(hours).toBeCloseTo(1, 1);
	});

	test("should handle 2 hours elapsed", () => {
		const metrics: Metrics = {
			iterations: 0,
			successfulIterations: 0,
			failedIterations: 0,
			errors: 0,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now() - 7200000, // 2 hours ago
		};
		const hours = elapsedHours(metrics);
		expect(hours).toBeCloseTo(2, 1);
	});

	test("should handle fractional hours", () => {
		const metrics: Metrics = {
			iterations: 0,
			successfulIterations: 0,
			failedIterations: 0,
			errors: 0,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now() - 1800000, // 30 minutes ago
		};
		const hours = elapsedHours(metrics);
		expect(hours).toBeCloseTo(0.5, 1);
	});
});

describe("successRate", () => {
	test("should return 0 for no iterations", () => {
		const metrics = createMetrics();
		expect(successRate(metrics)).toBe(0);
	});

	test("should return 1 for all successful iterations", () => {
		const metrics: Metrics = {
			iterations: 10,
			successfulIterations: 10,
			failedIterations: 0,
			errors: 0,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now(),
		};
		expect(successRate(metrics)).toBe(1);
	});

	test("should return 0 for all failed iterations", () => {
		const metrics: Metrics = {
			iterations: 10,
			successfulIterations: 0,
			failedIterations: 10,
			errors: 10,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now(),
		};
		expect(successRate(metrics)).toBe(0);
	});

	test("should calculate 50% success rate", () => {
		const metrics: Metrics = {
			iterations: 10,
			successfulIterations: 5,
			failedIterations: 5,
			errors: 5,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now(),
		};
		expect(successRate(metrics)).toBe(0.5);
	});

	test("should calculate 75% success rate", () => {
		const metrics: Metrics = {
			iterations: 8,
			successfulIterations: 6,
			failedIterations: 2,
			errors: 2,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now(),
		};
		expect(successRate(metrics)).toBe(0.75);
	});

	test("should handle single successful iteration", () => {
		const metrics: Metrics = {
			iterations: 1,
			successfulIterations: 1,
			failedIterations: 0,
			errors: 0,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now(),
		};
		expect(successRate(metrics)).toBe(1);
	});

	test("should handle single failed iteration", () => {
		const metrics: Metrics = {
			iterations: 1,
			successfulIterations: 0,
			failedIterations: 1,
			errors: 1,
			checkpoints: 0,
			rollbacks: 0,
			startTime: Date.now(),
		};
		expect(successRate(metrics)).toBe(0);
	});
});

describe("metricsToDict", () => {
	test("should include iterations", () => {
		const metrics = createMetrics();
		metrics.iterations = 5;
		const dict = metricsToDict(metrics);
		expect(dict.iterations).toBe(5);
	});

	test("should include successfulIterations", () => {
		const metrics = createMetrics();
		metrics.successfulIterations = 3;
		const dict = metricsToDict(metrics);
		expect(dict.successfulIterations).toBe(3);
	});

	test("should include failedIterations", () => {
		const metrics = createMetrics();
		metrics.failedIterations = 2;
		const dict = metricsToDict(metrics);
		expect(dict.failedIterations).toBe(2);
	});

	test("should include errors", () => {
		const metrics = createMetrics();
		metrics.errors = 1;
		const dict = metricsToDict(metrics);
		expect(dict.errors).toBe(1);
	});

	test("should include checkpoints", () => {
		const metrics = createMetrics();
		metrics.checkpoints = 4;
		const dict = metricsToDict(metrics);
		expect(dict.checkpoints).toBe(4);
	});

	test("should include rollbacks", () => {
		const metrics = createMetrics();
		metrics.rollbacks = 1;
		const dict = metricsToDict(metrics);
		expect(dict.rollbacks).toBe(1);
	});

	test("should include elapsedHours", () => {
		const metrics = createMetrics();
		const dict = metricsToDict(metrics);
		expect(dict.elapsedHours).toBeDefined();
		expect(typeof dict.elapsedHours).toBe("number");
	});

	test("should include successRate", () => {
		const metrics = createMetrics();
		metrics.successfulIterations = 3;
		metrics.failedIterations = 1;
		const dict = metricsToDict(metrics);
		expect(dict.successRate).toBe(0.75);
	});

	test("should return all 8 properties", () => {
		const metrics = createMetrics();
		const dict = metricsToDict(metrics);
		expect(Object.keys(dict).length).toBe(8);
	});
});

describe("Metrics interface", () => {
	test("should have correct structure", () => {
		const metrics: Metrics = {
			iterations: 10,
			successfulIterations: 8,
			failedIterations: 2,
			errors: 2,
			checkpoints: 5,
			rollbacks: 1,
			startTime: Date.now(),
		};
		expect(metrics.iterations).toBe(10);
		expect(metrics.successfulIterations).toBe(8);
		expect(metrics.failedIterations).toBe(2);
		expect(metrics.errors).toBe(2);
		expect(metrics.checkpoints).toBe(5);
		expect(metrics.rollbacks).toBe(1);
	});
});

describe("IterationData interface", () => {
	test("should have correct structure", () => {
		const data: IterationData = {
			iteration: 1,
			duration: 5.5,
			success: true,
			error: "",
			timestamp: new Date().toISOString(),
			triggerReason: TriggerReason.INITIAL,
			outputPreview: "Test output",
			tokensUsed: 1000,
			cost: 0.05,
			toolsUsed: ["tool1", "tool2"],
		};
		expect(data.iteration).toBe(1);
		expect(data.duration).toBe(5.5);
		expect(data.success).toBe(true);
		expect(data.triggerReason).toBe(TriggerReason.INITIAL);
		expect(data.toolsUsed).toEqual(["tool1", "tool2"]);
	});

	test("should accept string trigger reason", () => {
		const data: IterationData = {
			iteration: 1,
			duration: 1,
			success: false,
			error: "Test error",
			timestamp: new Date().toISOString(),
			triggerReason: "custom_reason",
			outputPreview: "",
			tokensUsed: 0,
			cost: 0,
			toolsUsed: [],
		};
		expect(data.triggerReason).toBe("custom_reason");
	});
});

describe("CostEntry interface", () => {
	test("should have correct structure", () => {
		const entry: CostEntry = {
			timestamp: Date.now(),
			tool: "claude",
			inputTokens: 500,
			outputTokens: 1000,
			cost: 0.025,
		};
		expect(entry.tool).toBe("claude");
		expect(entry.inputTokens).toBe(500);
		expect(entry.outputTokens).toBe(1000);
		expect(entry.cost).toBe(0.025);
	});
});

describe("CostSummary interface", () => {
	test("should have correct structure", () => {
		const summary: CostSummary = {
			totalCost: 0.5,
			costsByTool: { claude: 0.3, gemini: 0.2 },
			usageCount: 10,
			averageCost: 0.05,
		};
		expect(summary.totalCost).toBe(0.5);
		expect(summary.costsByTool.claude).toBe(0.3);
		expect(summary.usageCount).toBe(10);
		expect(summary.averageCost).toBe(0.05);
	});
});

describe("IterationStatsSummary interface", () => {
	test("should have correct structure", () => {
		const summary: IterationStatsSummary = {
			total: 100,
			current: 50,
			successes: 45,
			failures: 5,
			successRate: 0.9,
			runtime: "1h 30m",
			startTime: new Date().toISOString(),
		};
		expect(summary.total).toBe(100);
		expect(summary.current).toBe(50);
		expect(summary.successRate).toBe(0.9);
		expect(summary.runtime).toBe("1h 30m");
	});

	test("should accept null startTime", () => {
		const summary: IterationStatsSummary = {
			total: 0,
			current: 0,
			successes: 0,
			failures: 0,
			successRate: 0,
			runtime: "0s",
			startTime: null,
		};
		expect(summary.startTime).toBeNull();
	});
});

describe("MetricsSummary interface", () => {
	test("should have correct structure", () => {
		const summary: MetricsSummary = {
			summary: {
				iterations: 10,
				successful: 8,
				failed: 2,
				errors: 2,
				checkpoints: 3,
				rollbacks: 0,
			},
			iterations: [],
			cost: {
				totalCost: 0.25,
				costsByTool: { claude: 0.25 },
				usageCount: 10,
				averageCost: 0.025,
			},
			analysis: {
				avgIterationDuration: 5.5,
				successRate: 0.8,
			},
		};
		expect(summary.summary.iterations).toBe(10);
		expect(summary.summary.successful).toBe(8);
		expect(summary.cost.totalCost).toBe(0.25);
		expect(summary.analysis.successRate).toBe(0.8);
	});
});
