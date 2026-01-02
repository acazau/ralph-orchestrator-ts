/**
 * Tests for Gemini adapter
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { GeminiAdapter } from "../../src/adapters/gemini.ts";

describe("GeminiAdapter", () => {
	let adapter: GeminiAdapter;

	beforeEach(() => {
		adapter = new GeminiAdapter();
	});

	test("should have correct name", () => {
		expect(adapter.name).toBe("gemini");
	});

	test("should initially be unavailable", () => {
		expect(adapter.available).toBe(false);
	});

	test("should return string representation", () => {
		const str = adapter.toString();
		expect(str).toContain("gemini");
		expect(str).toContain("available");
	});

	test("should get config", () => {
		const config = adapter.getConfig();
		expect(config).toHaveProperty("timeout");
		expect(config).toHaveProperty("enabled");
	});

	test("should update config", () => {
		adapter.updateConfig({ timeout: 600 });
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
	});

	test("should estimate cost for prompt", () => {
		const cost = adapter.estimateCost("Hello, this is a test prompt");
		expect(cost).toBeGreaterThanOrEqual(0);
	});

	test("should estimate higher cost for longer prompt", () => {
		const shortCost = adapter.estimateCost("Short");
		const longCost = adapter.estimateCost("Long".repeat(1000));
		expect(longCost).toBeGreaterThan(shortCost);
	});
});

describe("GeminiAdapter configuration", () => {
	test("should accept custom config in constructor", () => {
		const adapter = new GeminiAdapter({
			timeout: 900,
			enabled: false,
			maxRetries: 5,
		});
		const config = adapter.getConfig();
		expect(config.timeout).toBe(900);
		expect(config.enabled).toBe(false);
		expect(config.maxRetries).toBe(5);
	});

	test("should merge custom config with defaults", () => {
		const adapter = new GeminiAdapter({ timeout: 600 });
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
		expect(config.enabled).toBe(true); // default
	});
});

describe("GeminiAdapter.executeWithFile", () => {
	test("should return error for non-existent file", async () => {
		const adapter = new GeminiAdapter();
		const result = await adapter.executeWithFile("/nonexistent/file.txt");
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});
