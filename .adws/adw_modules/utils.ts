/**
 * Utilities Module - Shared Helper Functions
 *
 * This module provides utility functions used across the SonarQube ADW system including:
 * - ID generation
 * - Error mapping
 * - Type guards for SDK messages
 * - Validation functions
 * - Text extraction helpers
 */

import { randomUUID } from 'crypto';
import type {
    AgentPromptRequest,
    AgentTemplateRequest,
    SDKMessage,
    SDKAssistantMessage,
    SDKResultMessage,
    TextBlock,
    ToolUseBlock,
} from './data_types';
import { RetryCode } from './data_types';

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate a unique 8-character ID for workflow tracking.
 *
 * Used to create unique ADW IDs that track workflow execution across phases.
 * The short format (8 chars) is easy to reference in logs and filenames.
 *
 * @returns A random UUID prefix (first 8 characters)
 */
export function generateShortId(): string {
    return randomUUID().substring(0, 8);
}

// ============================================================================
// ERROR MAPPING
// ============================================================================

/**
 * Map SDK error to RetryCode for retry decision-making.
 *
 * Analyzes error messages to determine if an error is retryable and what
 * category it falls into. This enables intelligent retry logic.
 *
 * @param error - Error object from SDK
 * @returns Appropriate retry code
 */
export function mapErrorToRetryCode(error: Error): RetryCode {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('not found') || errorMessage.includes('enoent')) {
        return RetryCode.NONE; // Not retryable - CLI not installed
    } else if (errorMessage.includes('connection') || errorMessage.includes('econnrefused')) {
        return RetryCode.CLAUDE_CODE_ERROR; // Retryable connection error
    } else if (errorMessage.includes('timeout')) {
        return RetryCode.TIMEOUT_ERROR; // Retryable timeout
    } else if (errorMessage.includes('process') || errorMessage.includes('exit code')) {
        return RetryCode.EXECUTION_ERROR; // Retryable process error
    }

    return RetryCode.EXECUTION_ERROR; // Default to retryable
}

// ============================================================================
// TYPE GUARDS (Safe Type Narrowing)
// ============================================================================

/**
 * Type guard for SDKAssistantMessage.
 */
export function isAssistantMessage(message: SDKMessage): message is SDKAssistantMessage {
    return message.type === 'assistant';
}

/**
 * Type guard for SDKResultMessage.
 */
export function isResultMessage(message: SDKMessage): message is SDKResultMessage {
    return message.type === 'result';
}

/**
 * Type guard for TextBlock.
 */
export function isTextBlock(block: unknown): block is TextBlock {
    return typeof block === 'object' && block !== null && 'type' in block && block.type === 'text';
}

/**
 * Type guard for ToolUseBlock.
 */
export function isToolUseBlock(block: unknown): block is ToolUseBlock {
    return typeof block === 'object' && block !== null && 'type' in block && block.type === 'tool_use';
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate AgentPromptRequest inputs.
 *
 * Ensures all required fields are present and valid before attempting
 * SDK execution. Prevents runtime errors from invalid configurations.
 *
 * @param request - Request object to validate
 * @returns Error message if invalid, null if valid
 */
export function validatePromptRequest(request: AgentPromptRequest): string | null {
    if (!request.prompt || request.prompt.trim().length === 0) {
        return 'Prompt cannot be empty';
    }

    if (!request.adwId || request.adwId.trim().length === 0) {
        return 'ADW ID cannot be empty';
    }

    if (!request.outputFile || request.outputFile.trim().length === 0) {
        return 'Output file path cannot be empty';
    }

    return null;
}

/**
 * Validate AgentTemplateRequest inputs.
 *
 * Ensures slash command template requests are properly formatted with
 * valid commands, agent names, and arguments.
 *
 * @param request - Request object to validate
 * @returns Error message if invalid, null if valid
 */
export function validateTemplateRequest(request: AgentTemplateRequest): string | null {
    if (!request.slashCommand || request.slashCommand.trim().length === 0) {
        return 'Slash command cannot be empty';
    }

    if (!request.slashCommand.startsWith('/')) {
        return `Slash command must start with '/': ${request.slashCommand}`;
    }

    if (!request.agentName || request.agentName.trim().length === 0) {
        return 'Agent name cannot be empty';
    }

    if (!request.adwId || request.adwId.trim().length === 0) {
        return 'ADW ID cannot be empty';
    }

    if (!Array.isArray(request.args)) {
        return 'Args must be an array';
    }

    return null;
}

// ============================================================================
// TEXT EXTRACTION
// ============================================================================

/**
 * Extract text from SDKAssistantMessage.
 *
 * Concatenates all text blocks from an assistant message into a single string.
 * Useful for getting the actual text response from Claude.
 *
 * @param message - Assistant message object
 * @returns Concatenated text from all text blocks
 */
export function extractText(message: SDKAssistantMessage): string {
    const texts: string[] = [];
    for (const block of message.message.content) {
        if (isTextBlock(block)) {
            texts.push(block.text);
        }
    }
    return texts.join('\n');
}
