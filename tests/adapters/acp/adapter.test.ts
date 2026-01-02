/**
 * Tests for ACP adapter
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { ACPAdapter } from "../../../src/adapters/acp/adapter.ts";
import { PermissionMode } from "../../../src/adapters/acp/models.ts";

describe("ACPAdapter", () => {
	let adapter: ACPAdapter;

	beforeEach(() => {
		adapter = new ACPAdapter();
	});

	test("should have correct name", () => {
		expect(adapter.name).toBe("acp");
	});

	test("should initially be unavailable", () => {
		expect(adapter.available).toBe(false);
	});

	test("should return string representation", () => {
		const str = adapter.toString();
		expect(str).toContain("acp");
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

	test("should estimate zero cost (ACP doesn't track cost)", () => {
		const cost = adapter.estimateCost("Hello, this is a test prompt");
		expect(cost).toBe(0);
	});
});

describe("ACPAdapter options", () => {
	test("should use default agent command", () => {
		const adapter = new ACPAdapter();
		expect(adapter.name).toBe("acp");
	});

	test("should accept custom agent command", () => {
		const adapter = new ACPAdapter(undefined, {
			agentCommand: "custom-agent",
		});
		expect(adapter.name).toBe("acp");
	});

	test("should accept permission mode option", () => {
		const adapter = new ACPAdapter(undefined, {
			permissionMode: PermissionMode.DENY_ALL,
		});
		expect(adapter.name).toBe("acp");
	});

	test("should accept allowed tools list", () => {
		const adapter = new ACPAdapter(undefined, {
			permissionMode: PermissionMode.ALLOWLIST,
			allowedTools: ["read", "write"],
		});
		expect(adapter.name).toBe("acp");
	});

	test("should accept timeout option", () => {
		const adapter = new ACPAdapter(undefined, {
			timeout: 60000,
		});
		expect(adapter.name).toBe("acp");
	});

	test("should accept adapter config", () => {
		const adapter = new ACPAdapter({
			timeout: 600,
			enabled: false,
			maxRetries: 3,
		});
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
		expect(config.enabled).toBe(false);
		expect(config.maxRetries).toBe(3);
	});

	test("should combine adapter config with options", () => {
		const adapter = new ACPAdapter(
			{ timeout: 600 },
			{ agentCommand: "my-agent", permissionMode: PermissionMode.AUTO_APPROVE },
		);
		const config = adapter.getConfig();
		expect(config.timeout).toBe(600);
		expect(adapter.name).toBe("acp");
	});
});

describe("ACPAdapter.executeWithFile", () => {
	test("should return error for non-existent file", async () => {
		const adapter = new ACPAdapter();
		const result = await adapter.executeWithFile("/nonexistent/file.txt");
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});

describe("PermissionMode values", () => {
	test("should have AUTO_APPROVE mode", () => {
		expect(PermissionMode.AUTO_APPROVE).toBe("auto_approve");
	});

	test("should have DENY_ALL mode", () => {
		expect(PermissionMode.DENY_ALL).toBe("deny_all");
	});

	test("should have ALLOWLIST mode", () => {
		expect(PermissionMode.ALLOWLIST).toBe("allowlist");
	});

	test("should have INTERACTIVE mode", () => {
		expect(PermissionMode.INTERACTIVE).toBe("interactive");
	});
});
