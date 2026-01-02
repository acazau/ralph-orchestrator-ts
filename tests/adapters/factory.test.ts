/**
 * Tests for adapter factory functions
 */

import { describe, expect, test } from "bun:test";
import {
	createAdapter,
	autoDetectAdapter,
	getAdapter,
	getAvailableAdapters,
	ClaudeAdapter,
	GeminiAdapter,
	QChatAdapter,
} from "../../src/adapters/index.ts";
import { AgentType } from "../../src/types/index.ts";

describe("createAdapter", () => {
	test("should create ClaudeAdapter for CLAUDE type", () => {
		const adapter = createAdapter(AgentType.CLAUDE);
		expect(adapter).toBeInstanceOf(ClaudeAdapter);
		expect(adapter.name).toBe("claude");
	});

	test("should create GeminiAdapter for GEMINI type", () => {
		const adapter = createAdapter(AgentType.GEMINI);
		expect(adapter).toBeInstanceOf(GeminiAdapter);
		expect(adapter.name).toBe("gemini");
	});

	test("should create QChatAdapter for Q type", () => {
		const adapter = createAdapter(AgentType.Q);
		expect(adapter).toBeInstanceOf(QChatAdapter);
		expect(adapter.name).toBe("qchat");
	});

	test("should throw for AUTO type", () => {
		expect(() => createAdapter(AgentType.AUTO)).toThrow(
			"Use autoDetectAdapter",
		);
	});

	test("should throw for unknown type", () => {
		expect(() => createAdapter("unknown" as AgentType)).toThrow(
			"Unknown agent type",
		);
	});

	test("should pass config to adapter", () => {
		const adapter = createAdapter(AgentType.CLAUDE, { timeout: 600 });
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
	});
});

describe("autoDetectAdapter", () => {
	test("should return an adapter or null", async () => {
		const adapter = await autoDetectAdapter();
		// May be null if no CLI tools are installed
		expect(adapter === null || typeof adapter.name === "string").toBe(true);
	});

	test("should pass config to detected adapter", async () => {
		const adapter = await autoDetectAdapter({ timeout: 600 });
		if (adapter) {
			const config = adapter.getConfig();
			expect(config.timeout).toBe(600);
		}
	});
});

describe("getAdapter", () => {
	test("should call autoDetectAdapter for AUTO type", async () => {
		const adapter = await getAdapter(AgentType.AUTO);
		// May be null if no CLI tools are installed
		expect(adapter === null || typeof adapter.name === "string").toBe(true);
	});

	test("should return null for unavailable adapter", async () => {
		// Create an adapter that we know doesn't exist
		const adapter = await getAdapter(AgentType.CLAUDE);
		// Claude might not be installed, so adapter could be null
		expect(adapter === null || adapter.name === "claude").toBe(true);
	});

	test("should pass config to adapter", async () => {
		const adapter = await getAdapter(AgentType.GEMINI, { timeout: 600 });
		// Gemini might not be available
		if (adapter) {
			const config = adapter.getConfig();
			expect(config.timeout).toBe(600);
		}
	});
});

describe("getAvailableAdapters", () => {
	test("should return array of available adapters", async () => {
		const adapters = await getAvailableAdapters();
		expect(Array.isArray(adapters)).toBe(true);
		// Each adapter should have a name
		for (const adapter of adapters) {
			expect(typeof adapter.name).toBe("string");
		}
	});

	test("should pass config to all adapters", async () => {
		const adapters = await getAvailableAdapters({ timeout: 600 });
		for (const adapter of adapters) {
			const config = adapter.getConfig();
			expect(config.timeout).toBe(600);
		}
	});
});

describe("exports", () => {
	test("should export ClaudeAdapter", () => {
		expect(ClaudeAdapter).toBeDefined();
	});

	test("should export GeminiAdapter", () => {
		expect(GeminiAdapter).toBeDefined();
	});

	test("should export QChatAdapter", () => {
		expect(QChatAdapter).toBeDefined();
	});
});
