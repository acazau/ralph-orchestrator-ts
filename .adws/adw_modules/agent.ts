/**
 * Agent Module - Core SDK Execution
 *
 * This module provides the slim, focused interface for executing Claude SDK operations.
 * It handles SDK configuration, message collection, and result extraction.
 *
 * Key Functions:
 * - promptClaudeSdk - Execute SDK with prompt configuration
 * - promptClaudeSdkWithRetry - Execute with automatic retry logic
 * - executeTemplateSdk - Execute slash commands via SDK
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import type {
    AgentPromptRequest,
    AgentPromptResponse,
    AgentTemplateRequest,
    SDKResultMessage,
} from './data_types';
import { RetryCode, OUTPUT_JSONL } from './data_types';
import {
    validatePromptRequest,
    validateTemplateRequest,
    isAssistantMessage,
    isResultMessage,
    extractText,
    mapErrorToRetryCode,
} from './utils';
import {
    saveMessagesAsJsonl,
    convertJsonlToJson,
    saveLastEntryAsRawResult,
} from './serialization';

// ============================================================================
// CORE SDK INTERFACE
// ============================================================================

/**
 * Execute Claude SDK with the given prompt configuration.
 *
 * Primary interface for executing Claude Agent SDK from TypeScript workflows.
 * Provides full access to advanced SDK features including subagents, custom tools,
 * hooks, and more. Outputs structured JSONL/JSON files for observability.
 *
 * @param request - Prompt configuration with optional advanced features
 * @returns Response with output, success status, and retry code
 */
export async function promptClaudeSdk(
    request: AgentPromptRequest
): Promise<AgentPromptResponse> {

    // Validate inputs
    const validationError = validatePromptRequest(request);
    if (validationError) {
        return {
            output: `Validation error: ${validationError}`,
            success: false,
            sessionId: undefined,
            retryCode: RetryCode.NONE,
        };
    }

    try {
        // Configure SDK options with ALL advanced features
        const options: Options = {
            // Basic options
            cwd: request.workingDir,
            permissionMode: request.dangerouslySkipPermissions ? 'bypassPermissions' : 'default',

            // Advanced features
            agents: request.agents,
            allowedTools: request.allowedTools,
            systemPrompt: request.systemPrompt,
            maxTurns: request.maxTurns,
            mcpServers: request.mcpServers,
            hooks: request.hooks,
            settingSources: request.settingSources,
        };

        // Collect all messages from SDK
        const messages: any[] = [];
        let resultMessage: SDKResultMessage | null = null;

        for await (const message of query({ prompt: request.prompt, options })) {
            messages.push(message);
            if (isResultMessage(message)) {
                resultMessage = message;
            }
        }

        // Create output directory
        await mkdir(dirname(request.outputFile), { recursive: true });

        // Save messages as JSONL (preserves observability)
        await saveMessagesAsJsonl(messages, request.outputFile);

        // Convert JSONL to JSON array
        const jsonFile = await convertJsonlToJson(request.outputFile);

        // Save last entry as final object
        await saveLastEntryAsRawResult(jsonFile);

        // Extract result
        if (resultMessage) {
            const success = !resultMessage.is_error;
            const sessionId = resultMessage.session_id;

            // Handle success case - result property only exists on success subtype
            if (resultMessage.subtype === 'success') {
                return {
                    output: resultMessage.result,
                    success,
                    sessionId,
                    retryCode: RetryCode.NONE,
                };
            }

            // Handle error case - no result property
            return {
                output: `Error during execution: ${resultMessage.subtype}`,
                success: false,
                sessionId,
                retryCode: RetryCode.ERROR_DURING_EXECUTION,
            };
        } else {
            // No result message - extract text from assistant messages
            const outputTexts: string[] = [];
            for (const msg of messages) {
                if (isAssistantMessage(msg)) {
                    const text = extractText(msg);
                    if (text) {
                        outputTexts.push(text);
                    }
                }
            }

            const output = outputTexts.length > 0 ? outputTexts.join('\n') : 'No output from Claude';

            return {
                output,
                success: outputTexts.length > 0,
                sessionId: undefined,
                retryCode: RetryCode.NONE,
            };
        }
    } catch (error) {
        const err = error as Error;
        const errorMsg = `SDK error: ${err.message}`;
        const retryCode = mapErrorToRetryCode(err);

        return {
            output: errorMsg,
            success: false,
            sessionId: undefined,
            retryCode,
        };
    }
}

/**
 * Execute Claude SDK with automatic retry logic for transient errors.
 *
 * Wraps promptClaudeSdk() with intelligent retry handling for connection errors,
 * timeouts, and other transient failures. Retries are exponentially delayed and
 * only attempted for retryable error types.
 *
 * @param request - Prompt configuration with optional advanced features
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelays - Delay in milliseconds between retries (default: [1000, 3000, 5000])
 * @returns Response with output, success status, and retry code
 */
export async function promptClaudeSdkWithRetry(
    request: AgentPromptRequest,
    maxRetries: number = 3,
    retryDelays: number[] = [1000, 3000, 5000]
): Promise<AgentPromptResponse> {

    // Validate maxRetries
    if (maxRetries < 0) {
        return {
            output: 'Validation error: maxRetries cannot be negative',
            success: false,
            sessionId: undefined,
            retryCode: RetryCode.NONE,
        };
    }

    // Ensure we have enough delays for maxRetries
    const delays = [...retryDelays];
    while (delays.length < maxRetries) {
        const lastDelay = delays[delays.length - 1];
        delays.push((lastDelay ?? 1000) + 2000);
    }

    let lastResponse: AgentPromptResponse | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            // This is a retry
            const delay = delays[attempt - 1];
            console.log(`Retrying after ${delay}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const response = await promptClaudeSdk(request);
        lastResponse = response;

        // Check if we should retry based on retry code
        if (response.success || response.retryCode === RetryCode.NONE) {
            // Success or non-retryable error
            return response;
        }

        // Check if this is a retryable error
        const retryableCodes = [
            RetryCode.CLAUDE_CODE_ERROR,
            RetryCode.TIMEOUT_ERROR,
            RetryCode.EXECUTION_ERROR,
            RetryCode.ERROR_DURING_EXECUTION,
        ];

        if (retryableCodes.includes(response.retryCode)) {
            if (attempt < maxRetries) {
                continue; // Retry
            } else {
                return response; // Max retries exceeded
            }
        }
    }

    // Should not reach here, but return last response
    return lastResponse || {
        output: 'No response received',
        success: false,
        sessionId: undefined,
        retryCode: RetryCode.EXECUTION_ERROR,
    };
}

/**
 * Execute a slash command template via Claude SDK.
 *
 * Converts slash commands (like /sonar-scan, /sonar-setup) into SDK prompt requests
 * and executes them with automatic retry logic. Supports all advanced SDK features
 * including subagents, tool restrictions, and custom hooks.
 *
 * @param request - Template execution configuration with slash command and args
 * @returns Response with output, success status, and retry code
 */
export async function executeTemplateSdk(
    request: AgentTemplateRequest
): Promise<AgentPromptResponse> {

    // Validate inputs
    const validationError = validateTemplateRequest(request);
    if (validationError) {
        return {
            output: `Validation error: ${validationError}`,
            success: false,
            sessionId: undefined,
            retryCode: RetryCode.NONE,
        };
    }

    // Construct prompt from slash command and args
    const prompt = `${request.slashCommand} ${request.args.join(' ')}`;

    // Determine output directory using hidden .adws directory
    const projectRoot = request.workingDir || process.cwd();
    const outputDir = join(projectRoot, '.adws', 'agents', request.adwId, request.agentName);

    try {
        await mkdir(outputDir, { recursive: true });
    } catch (error) {
        return {
            output: `Failed to create output directory: ${(error as Error).message}`,
            success: false,
            sessionId: undefined,
            retryCode: RetryCode.NONE,
        };
    }

    // Build output file path
    const outputFile = join(outputDir, OUTPUT_JSONL);

    // Create prompt request with all advanced features
    const promptRequest: AgentPromptRequest = {
        prompt,
        adwId: request.adwId,
        agentName: request.agentName,
        dangerouslySkipPermissions: request.dangerouslySkipPermissions ?? false,
        outputFile,
        workingDir: request.workingDir,

        // Pass through all advanced features
        agents: request.agents,
        allowedTools: request.allowedTools,
        systemPrompt: request.systemPrompt,
        maxTurns: request.maxTurns,
        mcpServers: request.mcpServers,
        hooks: request.hooks,
        settingSources: request.settingSources,
        slashCommand: request.slashCommand,
    };

    // Execute with retry logic
    return promptClaudeSdkWithRetry(promptRequest);
}
