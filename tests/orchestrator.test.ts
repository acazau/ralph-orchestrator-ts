/**
 * Tests for Ralph Orchestrator
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { RalphOrchestrator, type OrchestratorState } from "../src/orchestrator.ts";
import { AgentType, createDefaultConfig } from "../src/types/index.ts";

describe("RalphOrchestrator", () => {
	test("should create orchestrator with default config", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		expect(orchestrator).toBeDefined();
	});

	test("should create orchestrator with custom config", () => {
		const config = createDefaultConfig({
			agent: AgentType.CLAUDE,
			maxIterations: 50,
			maxRuntime: 3600,
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		expect(orchestrator).toBeDefined();
	});

	test("should get initial state", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state).toHaveProperty("status");
		expect(state).toHaveProperty("iteration");
		expect(state).toHaveProperty("maxIterations");
		expect(state).toHaveProperty("runtime");
		expect(state).toHaveProperty("tasks");
	});

	test("should report stopped status initially", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state.status).toBe("stopped");
		expect(state.iteration).toBe(0);
	});

	test("should have correct max iterations from config", () => {
		const config = createDefaultConfig({
			maxIterations: 75,
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state.maxIterations).toBe(75);
	});

	test("should have correct max runtime from config", () => {
		const config = createDefaultConfig({
			maxRuntime: 7200,
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state.maxRuntime).toBe(7200);
	});

	test("should initialize with empty task lists", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state.tasks).toEqual([]);
		expect(state.completedTasks).toEqual([]);
	});
});

describe("RalphOrchestrator state", () => {
	test("should get state with all required fields", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state).toHaveProperty("id");
		expect(state).toHaveProperty("status");
		expect(state).toHaveProperty("primaryTool");
		expect(state).toHaveProperty("promptFile");
		expect(state).toHaveProperty("iteration");
		expect(state).toHaveProperty("maxIterations");
		expect(state).toHaveProperty("runtime");
		expect(state).toHaveProperty("maxRuntime");
		expect(state).toHaveProperty("tasks");
		expect(state).toHaveProperty("completedTasks");
	});

	test("should have valid state types", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(typeof state.id).toBe("number");
		expect(typeof state.status).toBe("string");
		expect(typeof state.primaryTool).toBe("string");
		expect(typeof state.iteration).toBe("number");
		expect(typeof state.maxIterations).toBe("number");
		expect(Array.isArray(state.tasks)).toBe(true);
		expect(Array.isArray(state.completedTasks)).toBe(true);
	});

	test("should report correct prompt file from config", () => {
		const config = createDefaultConfig({
			promptFile: "custom-prompt.md",
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const state = orchestrator.getState();

		expect(state.promptFile).toBe("custom-prompt.md");
	});
});

describe("RalphOrchestrator metrics", () => {
	test("should get iteration stats", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const stats = orchestrator.getIterationStats();

		expect(stats).toHaveProperty("total");
		expect(stats).toHaveProperty("successes");
		expect(stats).toHaveProperty("failures");
	});

	test("should get cost summary", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const summary = orchestrator.getCostSummary();

		expect(summary).toHaveProperty("totalCost");
		expect(summary).toHaveProperty("costsByTool");
	});

	test("should return zero cost initially", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const summary = orchestrator.getCostSummary();

		expect(summary.totalCost).toBe(0);
	});
});

describe("RalphOrchestrator control", () => {
	test("should be able to stop", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);

		// Stop should not throw
		expect(() => orchestrator.stop()).not.toThrow();
	});

	test("should have getMetrics method", () => {
		const config = createDefaultConfig({
			promptText: "Test prompt",
		});
		const orchestrator = new RalphOrchestrator(config);
		const metrics = orchestrator.getMetrics();

		expect(metrics).toHaveProperty("iterations");
		expect(metrics).toHaveProperty("successfulIterations");
		expect(metrics).toHaveProperty("failedIterations");
		expect(metrics).toHaveProperty("checkpoints");
	});
});
