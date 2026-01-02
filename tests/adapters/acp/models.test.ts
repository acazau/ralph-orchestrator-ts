/**
 * Tests for ACP models and types
 */

import { describe, expect, test } from "bun:test";
import {
	UpdateKind,
	ToolCallStatus,
	PermissionMode,
	createACPRequest,
	parseACPResponse,
	isACPError,
	createEmptySession,
	type ACPResponse,
} from "../../../src/adapters/acp/models.ts";

describe("ACP Enums", () => {
	test("UpdateKind should have correct values", () => {
		expect(UpdateKind.AGENT_MESSAGE_CHUNK).toBe("agent_message_chunk");
		expect(UpdateKind.AGENT_THOUGHT_CHUNK).toBe("agent_thought_chunk");
		expect(UpdateKind.TOOL_CALL).toBe("tool_call");
		expect(UpdateKind.TOOL_CALL_UPDATE).toBe("tool_call_update");
		expect(UpdateKind.PLAN).toBe("plan");
	});

	test("ToolCallStatus should have correct values", () => {
		expect(ToolCallStatus.PENDING).toBe("pending");
		expect(ToolCallStatus.RUNNING).toBe("running");
		expect(ToolCallStatus.COMPLETED).toBe("completed");
		expect(ToolCallStatus.FAILED).toBe("failed");
	});

	test("PermissionMode should have correct values", () => {
		expect(PermissionMode.AUTO_APPROVE).toBe("auto_approve");
		expect(PermissionMode.DENY_ALL).toBe("deny_all");
		expect(PermissionMode.ALLOWLIST).toBe("allowlist");
		expect(PermissionMode.INTERACTIVE).toBe("interactive");
	});
});

describe("createACPRequest", () => {
	test("should create request without params", () => {
		const request = createACPRequest(1, "test_method");
		expect(request.jsonrpc).toBe("2.0");
		expect(request.id).toBe(1);
		expect(request.method).toBe("test_method");
		expect(request.params).toBeUndefined();
	});

	test("should create request with params", () => {
		const params = { key: "value", count: 42 };
		const request = createACPRequest(2, "another_method", params);
		expect(request.jsonrpc).toBe("2.0");
		expect(request.id).toBe(2);
		expect(request.method).toBe("another_method");
		expect(request.params).toEqual(params);
	});

	test("should create request with complex params", () => {
		const params = {
			nested: { inner: "data" },
			array: [1, 2, 3],
			boolean: true,
		};
		const request = createACPRequest(3, "complex_method", params);
		expect(request.params).toEqual(params);
	});
});

describe("parseACPResponse", () => {
	test("should parse success response", () => {
		const json = JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			result: { output: "test result" },
		});
		const response = parseACPResponse(json);
		expect(response.jsonrpc).toBe("2.0");
		expect(response.id).toBe(1);
		expect(response.result).toEqual({ output: "test result" });
		expect(response.error).toBeUndefined();
	});

	test("should parse error response", () => {
		const json = JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			error: {
				code: -32600,
				message: "Invalid Request",
			},
		});
		const response = parseACPResponse(json);
		expect(response.error?.code).toBe(-32600);
		expect(response.error?.message).toBe("Invalid Request");
	});

	test("should parse response with error data", () => {
		const json = JSON.stringify({
			jsonrpc: "2.0",
			id: 3,
			error: {
				code: -32000,
				message: "Server error",
				data: { details: "Additional info" },
			},
		});
		const response = parseACPResponse(json);
		expect(response.error?.data).toEqual({ details: "Additional info" });
	});
});

describe("isACPError", () => {
	test("should return true for error response", () => {
		const response: ACPResponse = {
			jsonrpc: "2.0",
			id: 1,
			error: { code: -32600, message: "Invalid" },
		};
		expect(isACPError(response)).toBe(true);
	});

	test("should return false for success response", () => {
		const response: ACPResponse = {
			jsonrpc: "2.0",
			id: 1,
			result: "success",
		};
		expect(isACPError(response)).toBe(false);
	});

	test("should return false when error is undefined", () => {
		const response: ACPResponse = {
			jsonrpc: "2.0",
			id: 1,
		};
		expect(isACPError(response)).toBe(false);
	});
});

describe("createEmptySession", () => {
	test("should create empty session with session ID", () => {
		const session = createEmptySession("test-session-123");
		expect(session.sessionId).toBe("test-session-123");
		expect(session.output).toBe("");
		expect(session.thoughts).toBe("");
		expect(session.toolCalls).toEqual([]);
		expect(session.completed).toBe(false);
		expect(session.error).toBeUndefined();
	});

	test("should create unique sessions", () => {
		const session1 = createEmptySession("session-1");
		const session2 = createEmptySession("session-2");
		expect(session1.sessionId).not.toBe(session2.sessionId);
	});
});
