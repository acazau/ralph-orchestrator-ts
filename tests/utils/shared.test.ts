/**
 * Tests for shared utility functions
 */

import { describe, expect, test } from "bun:test";
import {
	toJsonString,
	extractErrorMessage,
	estimateTokens,
	estimateBasicCost,
	mergeAdditionalArgs,
} from "../../src/utils/shared.ts";

describe("toJsonString", () => {
	test("should convert object to formatted JSON string", () => {
		const obj = { name: "test", value: 42 };
		const result = toJsonString(obj);
		expect(result).toBe('{\n  "name": "test",\n  "value": 42\n}');
	});

	test("should handle nested objects", () => {
		const obj = { outer: { inner: "value" } };
		const result = toJsonString(obj);
		expect(result).toContain('"outer"');
		expect(result).toContain('"inner"');
	});

	test("should handle arrays", () => {
		const arr = [1, 2, 3];
		const result = toJsonString(arr);
		expect(result).toBe("[\n  1,\n  2,\n  3\n]");
	});

	test("should handle null", () => {
		const result = toJsonString(null);
		expect(result).toBe("null");
	});

	test("should handle primitive values", () => {
		expect(toJsonString("string")).toBe('"string"');
		expect(toJsonString(123)).toBe("123");
		expect(toJsonString(true)).toBe("true");
	});
});

describe("extractErrorMessage", () => {
	test("should extract message from Error instance", () => {
		const error = new Error("Test error message");
		const result = extractErrorMessage(error);
		expect(result).toBe("Test error message");
	});

	test("should convert string to string", () => {
		const result = extractErrorMessage("String error");
		expect(result).toBe("String error");
	});

	test("should convert number to string", () => {
		const result = extractErrorMessage(404);
		expect(result).toBe("404");
	});

	test("should convert object to string", () => {
		const result = extractErrorMessage({ code: "ERR" });
		expect(result).toBe("[object Object]");
	});

	test("should handle null", () => {
		const result = extractErrorMessage(null);
		expect(result).toBe("null");
	});

	test("should handle undefined", () => {
		const result = extractErrorMessage(undefined);
		expect(result).toBe("undefined");
	});

	test("should handle TypeError", () => {
		const error = new TypeError("Type mismatch");
		const result = extractErrorMessage(error);
		expect(result).toBe("Type mismatch");
	});
});

describe("estimateTokens", () => {
	test("should estimate tokens from text (4 chars per token)", () => {
		const text = "12345678"; // 8 characters = 2 tokens
		const result = estimateTokens(text);
		expect(result).toBe(2);
	});

	test("should round up partial tokens", () => {
		const text = "123456789"; // 9 characters = 2.25 tokens -> 3
		const result = estimateTokens(text);
		expect(result).toBe(3);
	});

	test("should handle empty string", () => {
		const result = estimateTokens("");
		expect(result).toBe(0);
	});

	test("should handle single character", () => {
		const result = estimateTokens("a");
		expect(result).toBe(1);
	});

	test("should handle long text", () => {
		const text = "a".repeat(1000); // 1000 chars = 250 tokens
		const result = estimateTokens(text);
		expect(result).toBe(250);
	});
});

describe("estimateBasicCost", () => {
	test("should estimate cost with default multiplier", () => {
		const result = estimateBasicCost(100);
		expect(result.inputTokens).toBe(100);
		expect(result.outputTokens).toBe(200); // 2x default
	});

	test("should estimate cost with custom multiplier", () => {
		const result = estimateBasicCost(100, 3);
		expect(result.inputTokens).toBe(100);
		expect(result.outputTokens).toBe(300);
	});

	test("should handle zero input tokens", () => {
		const result = estimateBasicCost(0);
		expect(result.inputTokens).toBe(0);
		expect(result.outputTokens).toBe(0);
	});

	test("should handle multiplier of 1", () => {
		const result = estimateBasicCost(50, 1);
		expect(result.inputTokens).toBe(50);
		expect(result.outputTokens).toBe(50);
	});
});

describe("mergeAdditionalArgs", () => {
	test("should merge config args into array", () => {
		const args: string[] = ["--flag"];
		mergeAdditionalArgs(args, ["--config", "value"]);
		expect(args).toEqual(["--flag", "--config", "value"]);
	});

	test("should merge optional args into array", () => {
		const args: string[] = ["--flag"];
		mergeAdditionalArgs(args, [], ["--optional"]);
		expect(args).toEqual(["--flag", "--optional"]);
	});

	test("should merge both config and optional args", () => {
		const args: string[] = [];
		mergeAdditionalArgs(args, ["--config"], ["--optional"]);
		expect(args).toEqual(["--config", "--optional"]);
	});

	test("should handle empty config args", () => {
		const args: string[] = ["--existing"];
		mergeAdditionalArgs(args, []);
		expect(args).toEqual(["--existing"]);
	});

	test("should handle undefined optional args", () => {
		const args: string[] = ["--existing"];
		mergeAdditionalArgs(args, ["--config"]);
		expect(args).toEqual(["--existing", "--config"]);
	});

	test("should handle empty optional args array", () => {
		const args: string[] = ["--existing"];
		mergeAdditionalArgs(args, ["--config"], []);
		expect(args).toEqual(["--existing", "--config"]);
	});

	test("should preserve order of arguments", () => {
		const args: string[] = ["first"];
		mergeAdditionalArgs(args, ["second", "third"], ["fourth"]);
		expect(args).toEqual(["first", "second", "third", "fourth"]);
	});
});
