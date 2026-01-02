/**
 * Tests for QChat adapter
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { QChatAdapter } from "../../src/adapters/qchat.ts";

describe("QChatAdapter", () => {
	let adapter: QChatAdapter;

	beforeEach(() => {
		adapter = new QChatAdapter();
	});

	test("should have correct name", () => {
		expect(adapter.name).toBe("qchat");
	});

	test("should initially be unavailable", () => {
		expect(adapter.available).toBe(false);
	});

	test("should return string representation", () => {
		const str = adapter.toString();
		expect(str).toContain("qchat");
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

	test("should estimate zero cost (Q is free)", () => {
		const cost = adapter.estimateCost("Hello, this is a test prompt");
		expect(cost).toBe(0);
	});

	test("should estimate zero cost for any prompt length", () => {
		const shortCost = adapter.estimateCost("Short");
		const longCost = adapter.estimateCost("Long".repeat(1000));
		expect(shortCost).toBe(0);
		expect(longCost).toBe(0);
	});
});

describe("QChatAdapter configuration", () => {
	test("should accept custom config in constructor", () => {
		const adapter = new QChatAdapter({
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
		const adapter = new QChatAdapter({ timeout: 600 });
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
		expect(config.enabled).toBe(true); // default
	});
});

describe("QChatAdapter.executeWithFile", () => {
	test("should return error for non-existent file", async () => {
		const adapter = new QChatAdapter();
		const result = await adapter.executeWithFile("/nonexistent/file.txt");
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});
