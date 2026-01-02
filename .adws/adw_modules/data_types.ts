/**
 * Data Types Module - Type Definitions for SonarQube ADW Workflows
 *
 * This module contains all TypeScript interfaces, types, and enums used across
 * the SonarQube scanning ADW system. Centralizing types here ensures consistency
 * and makes it easy to understand the data structures.
 *
 * Key Types:
 * - AgentPromptRequest/Response - Core agent execution types
 * - AgentTemplateRequest - Slash command execution types
 * - RetryCode - Error retry classification
 * - SerializedMessage - Message serialization format
 * - SonarQube-specific types - Scan results, issues, quality gates
 */

import type {
    Options,
    SDKMessage,
    SDKAssistantMessage,
    SDKResultMessage,
    AgentDefinition,
    HookInput,
    SettingSource,
} from '@anthropic-ai/claude-agent-sdk';
import type { TextBlock, ToolUseBlock } from '@anthropic-ai/sdk/resources';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Retry code classification for error handling.
 * Determines whether an operation should be retried and what type of error occurred.
 */
export enum RetryCode {
    /** Claude Code CLI error - retryable */
    CLAUDE_CODE_ERROR = 'claude_code_error',
    /** Timeout during execution - retryable */
    TIMEOUT_ERROR = 'timeout_error',
    /** Generic execution error - retryable */
    EXECUTION_ERROR = 'execution_error',
    /** Error occurred during agent execution - retryable */
    ERROR_DURING_EXECUTION = 'error_during_execution',
    /** Non-retryable error or success */
    NONE = 'none',
}

// ============================================================================
// AGENT REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * System prompt configuration.
 * Can be a simple string or a preset with optional append.
 */
export type SystemPromptConfig = string | {
    type: 'preset';
    preset: 'claude_code';
    append?: string;
};

/**
 * Agent prompt request with full SDK feature support.
 */
export interface AgentPromptRequest {
    /** The prompt text to send to Claude */
    prompt: string;

    /** Unique identifier for this ADW execution */
    adwId: string;

    /** Optional agent name for output organization */
    agentName?: string;

    /** Bypass permission prompts (use with caution) */
    dangerouslySkipPermissions?: boolean;

    /** Path where output files will be written */
    outputFile: string;

    /** Working directory for execution */
    workingDir?: string;

    // Advanced SDK features
    agents?: Record<string, AgentDefinition>;
    allowedTools?: string[];
    systemPrompt?: SystemPromptConfig;
    maxTurns?: number;
    mcpServers?: Record<string, any>;
    hooks?: Partial<Record<string, (input: HookInput) => Promise<any> | any>>;
    settingSources?: SettingSource[];
    slashCommand?: string;
}

/**
 * Response from agent prompt execution.
 */
export interface AgentPromptResponse {
    /** The output text from the agent */
    output: string;
    /** Whether the execution was successful */
    success: boolean;
    /** Session ID from Claude Code (for debugging) */
    sessionId?: string;
    /** Retry code indicating if/how to retry on failure */
    retryCode: RetryCode;
}

/**
 * Request to execute a slash command template.
 */
export interface AgentTemplateRequest {
    /** Name of the agent executing this template */
    agentName: string;
    /** The slash command to execute (e.g., "/sonar-scan") */
    slashCommand: string;
    /** Arguments to pass to the slash command */
    args: string[];
    /** Unique identifier for this ADW execution */
    adwId: string;
    /** Working directory for execution */
    workingDir?: string;

    // Advanced features
    agents?: Record<string, AgentDefinition>;
    allowedTools?: string[];
    dangerouslySkipPermissions?: boolean;
    systemPrompt?: SystemPromptConfig;
    maxTurns?: number;
    mcpServers?: Record<string, any>;
    hooks?: Partial<Record<string, (input: HookInput) => Promise<any> | any>>;
    settingSources?: SettingSource[];
}

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

/**
 * Serialized message format for JSONL/JSON output.
 */
export interface SerializedMessage {
    type: string;
    message?: {
        content?: Array<{
            type: string;
            text?: string;
            name?: string;
            id?: string;
            input?: unknown
        }>;
    };
    subtype?: string;
    is_error?: boolean;
    result?: string;
    session_id?: string;
    total_cost_usd?: number;
    duration_ms?: number;
    duration_api_ms?: number;
    num_turns?: number;
}

// ============================================================================
// SONARQUBE-SPECIFIC TYPES
// ============================================================================

/**
 * SonarQube scan mode.
 */
export type ScanMode = 'changed' | 'full';

/**
 * SonarQube issue severity levels.
 */
export type IssueSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';

/**
 * SonarQube issue types.
 */
export type IssueType = 'BUG' | 'VULNERABILITY' | 'CODE_SMELL' | 'SECURITY_HOTSPOT';

/**
 * SonarQube quality gate status.
 */
export type QualityGateStatus = 'OK' | 'WARN' | 'ERROR' | 'NONE';

/**
 * A single SonarQube issue.
 */
export interface SonarQubeIssue {
    key: string;
    rule: string;
    severity: IssueSeverity;
    component: string;
    project: string;
    line?: number;
    message: string;
    type: IssueType;
    status: string;
    effort?: string;
}

/**
 * Security hotspot vulnerability probability.
 */
export type HotspotProbability = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Security hotspot status.
 */
export type HotspotStatus = 'TO_REVIEW' | 'ACKNOWLEDGED' | 'FIXED' | 'SAFE';

/**
 * A single SonarQube security hotspot.
 */
export interface SecurityHotspot {
    key: string;
    component: string;
    project: string;
    securityCategory: string;
    vulnerabilityProbability: HotspotProbability;
    status: HotspotStatus;
    line?: number;
    message: string;
    rule: string;
    ruleKey: string;
}

/**
 * SonarQube quality gate result.
 */
export interface QualityGate {
    status: QualityGateStatus;
    conditions: Array<{
        status: QualityGateStatus;
        metricKey: string;
        comparator: string;
        errorThreshold?: string;
        actualValue?: string;
    }>;
}

/**
 * SonarQube project status.
 */
export interface ProjectStatus {
    status: string;
    conditions?: Array<{
        status: string;
        metricKey: string;
        comparator: string;
        periodIndex?: number;
        errorThreshold?: string;
        actualValue?: string;
    }>;
}

/**
 * SonarQube scan result.
 */
export interface ScanResult {
    success: boolean;
    projectKey: string;
    bugs: number;
    vulnerabilities: number;
    codeSmells: number;
    securityHotspots: number;
    coverage?: string;
    duplications?: string;
    qualityGate: QualityGateStatus;
    dashboardUrl: string;
    issues?: SonarQubeIssue[];
    scanTime?: number;
    taskId?: string;
}

/**
 * Docker container health status.
 */
export interface HealthStatus {
    healthy: boolean;
    status: string;
    message?: string;
}

/**
 * Docker operation result.
 */
export interface DockerResult {
    success: boolean;
    containerId?: string;
    message?: string;
    error?: string;
}

/**
 * SonarQube configuration.
 */
export interface SonarQubeConfig {
    url: string;
    token: string;
    projectKey?: string;
    container: {
        name: string;
        image: string;
        port: number;
    };
    scanner: {
        exclusions: string[];
    };
}

// ============================================================================
// OUTPUT FILE CONSTANTS
// ============================================================================

/** Raw JSONL output from agent execution */
export const OUTPUT_JSONL = 'cc_raw_output.jsonl';
/** Parsed JSON array from JSONL */
export const OUTPUT_JSON = 'cc_raw_output.json';
/** Final result object (last message) */
export const FINAL_OBJECT_JSON = 'cc_final_object.json';
/** Scan results JSON */
export const SCAN_RESULTS_JSON = 'scan_results.json';
/** Scan report markdown */
export const SCAN_REPORT_MD = 'scan_report.md';

// ============================================================================
// RE-EXPORTS FROM SDK
// ============================================================================

export type {
    Options,
    SDKMessage,
    SDKAssistantMessage,
    SDKResultMessage,
    AgentDefinition,
    HookInput,
    SettingSource,
    TextBlock,
    ToolUseBlock,
};
