/**
 * Tests for base adapter functionality
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import {
	ToolAdapter,
	commandExists,
	executeCommand,
	executeCLICommand,
} from "../../src/adapters/base.ts";
import {
	DEFAULT_ADAPTER_CONFIG,
	type ExecuteOptions,
	type ToolResponse,
	createSuccessResponse,
} from "../../src/types/index.ts";

/**
 * Concrete test adapter for testing base class functionality
 */
class TestAdapter extends ToolAdapter {
	private _checkResult = true;

	constructor() {
		super("test-adapter");
	}

	setCheckResult(value: boolean): void {
		this._checkResult = value;
	}

	async checkAvailability(): Promise<boolean> {
		this.setAvailable(this._checkResult);
		return this._checkResult;
	}

	async execute(
		prompt: string,
		_options?: ExecuteOptions,
	): Promise<ToolResponse> {
		// Call enhancePromptWithInstructions to test it
		const enhanced = this.enhancePromptWithInstructions(prompt);
		return createSuccessResponse(enhanced);
	}

	// Expose protected method for testing
	public testEnhancePrompt(prompt: string): string {
		return this.enhancePromptWithInstructions(prompt);
	}
}

const TEST_DIR = join(process.cwd(), ".test-adapter-temp");

describe("commandExists", () => {
	test("should return true for existing commands", async () => {
		const exists = await commandExists("ls");
		expect(exists).toBe(true);
	});

	test("should return false for non-existing commands", async () => {
		const exists = await commandExists("nonexistent-command-xyz123");
		expect(exists).toBe(false);
	});

	test("should return true for git", async () => {
		const exists = await commandExists("git");
		expect(exists).toBe(true);
	});
});

describe("executeCommand", () => {
	test("should execute simple command", async () => {
		const result = await executeCommand(["echo", "hello"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("hello");
		expect(result.stderr).toBe("");
	});

	test("should capture stderr", async () => {
		const result = await executeCommand(["ls", "nonexistent-file-xyz123"]);
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.length).toBeGreaterThan(0);
	});

	test("should handle environment variables", async () => {
		const result = await executeCommand(["sh", "-c", "echo $TEST_VAR"], {
			env: { TEST_VAR: "test_value" },
		});
		expect(result.stdout.trim()).toBe("test_value");
	});

	test("should handle working directory", async () => {
		const result = await executeCommand(["pwd"], {
			cwd: "/tmp",
		});
		expect(result.stdout.trim()).toContain("tmp");
	});

	test("should handle stdin", async () => {
		const result = await executeCommand(["cat"], {
			stdin: "hello from stdin",
		});
		expect(result.stdout).toBe("hello from stdin");
	});

	test("should handle timeout", async () => {
		const result = await executeCommand(["sleep", "10"], {
			timeout: 100,
		});
		// Process should be killed due to timeout
		expect(result.exitCode).not.toBe(0);
	});
});

describe("executeCLICommand", () => {
	test("should execute and return duration", async () => {
		const result = await executeCLICommand(["echo", "test"]);
		expect(result.success).toBe(true);
		expect(result.duration).toBeGreaterThan(0);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("test");
	});

	test("should return success false for failed commands", async () => {
		const result = await executeCLICommand(["ls", "nonexistent-xyz123"]);
		expect(result.success).toBe(false);
		expect(result.exitCode).not.toBe(0);
	});

	test("should handle env option", async () => {
		const result = await executeCLICommand(["sh", "-c", "echo $MY_VAR"], {
			env: { MY_VAR: "my_value" },
		});
		expect(result.success).toBe(true);
		expect(result.stdout.trim()).toBe("my_value");
	});

	test("should handle timeout option", async () => {
		const result = await executeCLICommand(["sleep", "10"], {
			timeout: 100,
		});
		expect(result.success).toBe(false);
	});
});

describe("DEFAULT_ADAPTER_CONFIG", () => {
	test("should have default timeout", () => {
		expect(DEFAULT_ADAPTER_CONFIG.timeout).toBeGreaterThan(0);
	});

	test("should have default enabled true", () => {
		expect(DEFAULT_ADAPTER_CONFIG.enabled).toBe(true);
	});

	test("should have empty args array", () => {
		expect(DEFAULT_ADAPTER_CONFIG.args).toEqual([]);
	});
});

describe("ToolAdapter base class", () => {
	let adapter: TestAdapter;

	beforeEach(() => {
		adapter = new TestAdapter();
	});

	test("should have correct name", () => {
		expect(adapter.name).toBe("test-adapter");
	});

	test("should be unavailable before checkAvailability", () => {
		expect(adapter.available).toBe(false);
	});

	test("should be available after checkAvailability returns true", async () => {
		adapter.setCheckResult(true);
		await adapter.checkAvailability();
		expect(adapter.available).toBe(true);
	});

	test("should be unavailable after checkAvailability returns false", async () => {
		adapter.setCheckResult(false);
		await adapter.checkAvailability();
		expect(adapter.available).toBe(false);
	});

	test("should return default cost of 0", () => {
		const cost = adapter.estimateCost("test prompt");
		expect(cost).toBe(0);
	});

	test("should enhance prompt with orchestration instructions", () => {
		const enhanced = adapter.testEnhancePrompt("Test prompt");
		expect(enhanced).toContain("ORCHESTRATION CONTEXT:");
		expect(enhanced).toContain("Test prompt");
	});

	test("should not add instructions if already present", () => {
		const promptWithInstructions = "ORCHESTRATION CONTEXT: Test prompt";
		const result = adapter.testEnhancePrompt(promptWithInstructions);
		expect(result).toBe(promptWithInstructions);
	});

	test("should detect IMPORTANT INSTRUCTIONS marker", () => {
		const prompt = "IMPORTANT INSTRUCTIONS: Do this";
		const result = adapter.testEnhancePrompt(prompt);
		expect(result).toBe(prompt);
	});

	test("should detect focused task marker", () => {
		const prompt = "Implement only ONE small, focused task here";
		const result = adapter.testEnhancePrompt(prompt);
		expect(result).toBe(prompt);
	});

	test("should execute and return enhanced prompt", async () => {
		adapter.setCheckResult(true);
		await adapter.checkAvailability();

		const response = await adapter.execute("Hello");
		expect(response.success).toBe(true);
		expect(response.output).toContain("ORCHESTRATION CONTEXT:");
		expect(response.output).toContain("Hello");
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

	test("should convert to string", () => {
		const str = adapter.toString();
		expect(str).toContain("test-adapter");
		expect(str).toContain("available");
	});
});

describe("ToolAdapter.executeWithFile", () => {
	const TEST_PROMPT_DIR = join(process.cwd(), ".test-adapter-prompt-temp");

	beforeEach(async () => {
		await mkdir(TEST_PROMPT_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_PROMPT_DIR, { recursive: true, force: true });
	});

	test("should execute with file content", async () => {
		const promptFile = join(TEST_PROMPT_DIR, "prompt.txt");
		await writeFile(promptFile, "Test file content");

		const adapter = new TestAdapter();
		adapter.setCheckResult(true);
		await adapter.checkAvailability();

		const response = await adapter.executeWithFile(promptFile);
		expect(response.success).toBe(true);
		expect(response.output).toContain("Test file content");
	});

	test("should return error for non-existent file", async () => {
		const adapter = new TestAdapter();
		const response = await adapter.executeWithFile(
			join(TEST_PROMPT_DIR, "nonexistent.txt"),
		);
		expect(response.success).toBe(false);
		expect(response.error).toContain("not found");
	});
});
