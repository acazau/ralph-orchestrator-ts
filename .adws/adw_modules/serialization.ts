/**
 * Serialization Module - Message Serialization for Observability
 *
 * This module handles serialization of SDK messages to structured file formats
 * (JSONL and JSON) for observability, debugging, and audit trails.
 *
 * Key Functions:
 * - serializeMessageToDict - Convert SDK messages to dictionaries
 * - saveMessagesAsJsonl - Save messages as JSONL stream
 * - convertJsonlToJson - Convert JSONL to JSON array
 * - saveLastEntryAsRawResult - Extract final result object
 */

import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type {
    SDKMessage,
    SerializedMessage,
} from './data_types';
import { OUTPUT_JSON, FINAL_OBJECT_JSON } from './data_types';
import { isAssistantMessage, isResultMessage, isTextBlock, isToolUseBlock } from './utils';

// ============================================================================
// MESSAGE SERIALIZATION
// ============================================================================

/**
 * Convert SDK message to dictionary (for JSONL serialization).
 *
 * Transforms SDK message objects into a serializable dictionary format
 * that preserves the essential information for observability.
 *
 * @param message - SDK message object
 * @returns Serialized message dictionary
 */
export function serializeMessageToDict(message: SDKMessage): SerializedMessage {
    if (isAssistantMessage(message)) {
        const contentBlocks = message.message.content.map((block) => {
            if (isTextBlock(block)) {
                return {
                    type: 'text',
                    text: block.text,
                };
            } else if (isToolUseBlock(block)) {
                return {
                    type: 'tool_use',
                    name: block.name,
                    id: block.id,
                    input: block.input,
                };
            } else {
                return { type: 'unknown' };
            }
        });

        return {
            type: 'assistant',
            message: {
                content: contentBlocks,
            },
        };
    } else if (isResultMessage(message)) {
        return {
            type: 'result',
            subtype: message.subtype,
            is_error: message.is_error,
            result: message.subtype === 'success' ? message.result : '',
            session_id: message.session_id,
            total_cost_usd: message.total_cost_usd,
            duration_ms: message.duration_ms,
            duration_api_ms: message.duration_api_ms,
            num_turns: message.num_turns,
        };
    } else if (message.type === 'user') {
        return {
            type: 'user',
            message: { content: [] },
        };
    } else {
        return {
            type: 'unknown',
        };
    }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Save SDK messages as JSONL file (preserves observability format).
 *
 * Writes messages in JSONL (JSON Lines) format where each line is a valid JSON object.
 * This format is ideal for streaming and log-style data.
 *
 * @param messages - Array of SDK messages
 * @param outputFile - Path to output JSONL file
 * @throws Error if file write fails
 */
export async function saveMessagesAsJsonl(messages: SDKMessage[], outputFile: string): Promise<void> {
    try {
        await mkdir(dirname(outputFile), { recursive: true });

        const jsonlLines = messages.map((msg) => {
            const serialized = serializeMessageToDict(msg);
            return JSON.stringify(serialized);
        });

        await writeFile(outputFile, jsonlLines.join('\n') + '\n');
    } catch (error) {
        throw new Error(`Failed to save JSONL to ${outputFile}: ${(error as Error).message}`);
    }
}

/**
 * Convert JSONL file to JSON array file.
 *
 * Reads a JSONL file and converts it to a JSON array for easier programmatic access.
 * Creates cc_raw_output.json alongside the JSONL file.
 *
 * @param jsonlFile - Path to JSONL file
 * @returns Path to created JSON file
 * @throws Error if file operations fail
 */
export async function convertJsonlToJson(jsonlFile: string): Promise<string> {
    try {
        const outputDir = dirname(jsonlFile);
        const jsonFile = join(outputDir, OUTPUT_JSON);

        // Read JSONL and parse messages
        const jsonlContent = await Bun.file(jsonlFile).text();
        const messages = jsonlContent
            .split('\n')
            .filter((line: string) => line.trim())
            .map((line: string) => JSON.parse(line));

        // Write as JSON array
        await writeFile(jsonFile, JSON.stringify(messages, null, 2));

        return jsonFile;
    } catch (error) {
        throw new Error(`Failed to convert JSONL to JSON: ${(error as Error).message}`);
    }
}

/**
 * Save the last entry from JSON array file as cc_final_object.json.
 *
 * Extracts the final message (usually the result) from the JSON array
 * and saves it separately for easy access to the final output.
 *
 * @param jsonFile - Path to JSON array file
 * @returns Path to final object file, or null if failed
 */
export async function saveLastEntryAsRawResult(jsonFile: string): Promise<string | null> {
    try {
        const content = await Bun.file(jsonFile).text();
        const messages = JSON.parse(content);

        if (!Array.isArray(messages) || messages.length === 0) {
            return null;
        }

        const lastEntry = messages[messages.length - 1];

        const outputDir = dirname(jsonFile);
        const finalObjectFile = join(outputDir, FINAL_OBJECT_JSON);

        await writeFile(finalObjectFile, JSON.stringify(lastEntry, null, 2));

        return finalObjectFile;
    } catch (error) {
        console.error(`Error saving final object: ${(error as Error).message}`);
        return null;
    }
}
