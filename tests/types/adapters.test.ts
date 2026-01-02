/**
 * Tests for adapter types
 */

import { describe, expect, test } from "bun:test";
import {
	createSuccessResponse,
	createErrorResponse,
	totalTokens,
	type ToolResponse,
	type TokenUsage,
} from "../../src/types/adapters.ts";

describe("createSuccessResponse", () => {
	test("should create basic success response", () => {
		const response = createSuccessResponse("Hello, world!");
		expect(response.success).toBe(true);
		expect(response.output).toBe("Hello, world!");
		expect(response.metadata).toEqual({});
		expect(response.error).toBeUndefined();
	});

	test("should include metadata when provided", () => {
		const response = createSuccessResponse("output", {
			metadata: { key: "value" },
		});
		expect(response.metadata).toEqual({ key: "value" });
	});

	test("should include tokensUsed when provided", () => {
		const response = createSuccessResponse("output", {
			tokensUsed: 100,
		});
		expect(response.tokensUsed).toBe(100);
	});

	test("should include cost when provided", () => {
		const response = createSuccessResponse("output", {
			cost: 0.05,
		});
		expect(response.cost).toBe(0.05);
	});

	test("should include all optional fields", () => {
		const response = createSuccessResponse("output", {
			metadata: { model: "gpt-4" },
			tokensUsed: 500,
			cost: 0.1,
		});
		expect(response).toEqual({
			success: true,
			output: "output",
			metadata: { model: "gpt-4" },
			tokensUsed: 500,
			cost: 0.1,
		});
	});

	test("should handle empty output", () => {
		const response = createSuccessResponse("");
		expect(response.success).toBe(true);
		expect(response.output).toBe("");
	});
});

describe("createErrorResponse", () => {
	test("should create basic error response", () => {
		const response = createErrorResponse("Something went wrong");
		expect(response.success).toBe(false);
		expect(response.error).toBe("Something went wrong");
		expect(response.output).toBe("");
		expect(response.metadata).toEqual({});
	});

	test("should include output when provided", () => {
		const response = createErrorResponse("Error", "partial output");
		expect(response.output).toBe("partial output");
		expect(response.error).toBe("Error");
	});

	test("should include metadata when provided", () => {
		const response = createErrorResponse("Error", "", { exitCode: 1 });
		expect(response.metadata).toEqual({ exitCode: 1 });
	});

	test("should include all parameters", () => {
		const response = createErrorResponse(
			"Network timeout",
			"partial response",
			{ retries: 3, duration: 30 }
		);
		expect(response).toEqual({
			success: false,
			error: "Network timeout",
			output: "partial response",
			metadata: { retries: 3, duration: 30 },
		});
	});

	test("should handle empty error message", () => {
		const response = createErrorResponse("");
		expect(response.error).toBe("");
		expect(response.success).toBe(false);
	});
});

describe("totalTokens", () => {
	test("should sum input and output tokens", () => {
		const usage: TokenUsage = {
			inputTokens: 100,
			outputTokens: 200,
		};
		expect(totalTokens(usage)).toBe(300);
	});

	test("should handle zero tokens", () => {
		const usage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
		};
		expect(totalTokens(usage)).toBe(0);
	});

	test("should ignore cache tokens (not included in total)", () => {
		const usage: TokenUsage = {
			inputTokens: 100,
			outputTokens: 200,
			cacheRead: 50,
			cacheCreation: 25,
		};
		// Total only includes input + output, not cache
		expect(totalTokens(usage)).toBe(300);
	});

	test("should handle only input tokens", () => {
		const usage: TokenUsage = {
			inputTokens: 500,
			outputTokens: 0,
		};
		expect(totalTokens(usage)).toBe(500);
	});

	test("should handle only output tokens", () => {
		const usage: TokenUsage = {
			inputTokens: 0,
			outputTokens: 750,
		};
		expect(totalTokens(usage)).toBe(750);
	});

	test("should handle large token counts", () => {
		const usage: TokenUsage = {
			inputTokens: 100000,
			outputTokens: 100000,
		};
		expect(totalTokens(usage)).toBe(200000);
	});
});

describe("ToolResponse interface", () => {
	test("should have correct structure for success response", () => {
		const response: ToolResponse = {
			success: true,
			output: "result",
			metadata: {},
		};
		expect(response.success).toBe(true);
		expect(response.output).toBe("result");
	});

	test("should have correct structure for error response", () => {
		const response: ToolResponse = {
			success: false,
			output: "",
			error: "failed",
			metadata: {},
		};
		expect(response.success).toBe(false);
		expect(response.error).toBe("failed");
	});
});
