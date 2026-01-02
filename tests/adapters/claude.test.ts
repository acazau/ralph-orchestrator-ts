/**
 * Tests for Claude adapter
 */

import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { ClaudeAdapter } from "../../src/adapters/claude.ts";

const TEST_DIR = join(process.cwd(), ".test-claude-adapter-temp");

describe("ClaudeAdapter", () => {
	let adapter: ClaudeAdapter;

	beforeEach(() => {
		adapter = new ClaudeAdapter();
	});

	test("should have correct name", () => {
		expect(adapter.name).toBe("claude");
	});

	test("should initially be unavailable", () => {
		// Before checkAvailability is called, available is false
		expect(adapter.available).toBe(false);
	});

	test("should return string representation", () => {
		const str = adapter.toString();
		expect(str).toContain("claude");
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
		expect(cost).toBeGreaterThan(0);
	});

	test("should estimate higher cost for longer prompt", () => {
		const shortCost = adapter.estimateCost("Short");
		const longCost = adapter.estimateCost("Long".repeat(1000));
		expect(longCost).toBeGreaterThan(shortCost);
	});
});

describe("ClaudeAdapter.getPricing", () => {
	test("should return pricing for known model", () => {
		const pricing = ClaudeAdapter.getPricing("claude-sonnet-4-5-20250929");
		expect(pricing.input).toBe(3);
		expect(pricing.output).toBe(15);
	});

	test("should return pricing for claude-opus-4-5", () => {
		const pricing = ClaudeAdapter.getPricing("claude-opus-4-5-20251101");
		expect(pricing.input).toBe(15);
		expect(pricing.output).toBe(75);
	});

	test("should return pricing for claude-haiku-4-5", () => {
		const pricing = ClaudeAdapter.getPricing("claude-haiku-4-5-20251001");
		expect(pricing.input).toBe(0.8);
		expect(pricing.output).toBe(4);
	});

	test("should return default pricing for unknown model", () => {
		const pricing = ClaudeAdapter.getPricing("unknown-model");
		expect(pricing.input).toBe(3);
		expect(pricing.output).toBe(15);
	});
});

describe("ClaudeAdapter configuration", () => {
	test("should accept custom config in constructor", () => {
		const adapter = new ClaudeAdapter({
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
		const adapter = new ClaudeAdapter({ timeout: 600 });
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
		expect(config.enabled).toBe(true); // default
	});
});

describe("ClaudeAdapter.executeWithFile", () => {
	beforeEach(async () => {
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	test("should return error for non-existent file", async () => {
		const adapter = new ClaudeAdapter();
		const result = await adapter.executeWithFile(
			join(TEST_DIR, "nonexistent.txt"),
		);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});
