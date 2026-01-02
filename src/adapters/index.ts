/**
 * Adapter exports for Ralph Orchestrator
 */

import { type AdapterConfig, AgentType } from "../types/index.ts";
import { createLogger } from "../utils/logger.ts";

// Export base classes and utilities
export { ToolAdapter, commandExists, executeCommand } from "./base.ts";

// Export adapters
export { ClaudeAdapter } from "./claude.ts";
export { GeminiAdapter } from "./gemini.ts";
export { QChatAdapter } from "./qchat.ts";
export { ACPAdapter, type ACPAdapterOptions } from "./acp/index.ts";

// Re-export ACP types
export * from "./acp/index.ts";

import { ACPAdapter, type ACPAdapterOptions } from "./acp/index.ts";
import type { ToolAdapter } from "./base.ts";
// Import adapter classes for factory
import { ClaudeAdapter } from "./claude.ts";
import { GeminiAdapter } from "./gemini.ts";
import { QChatAdapter } from "./qchat.ts";

const logger = createLogger("ralph-orchestrator.adapters");

/**
 * Create an adapter by type
 */
export function createAdapter(
	type: AgentType,
	config?: Partial<AdapterConfig>,
	acpOptions?: ACPAdapterOptions,
): ToolAdapter {
	switch (type) {
		case AgentType.CLAUDE:
			return new ClaudeAdapter(config);

		case AgentType.GEMINI:
			return new GeminiAdapter(config);

		case AgentType.Q:
			return new QChatAdapter(config);

		case AgentType.ACP:
			return new ACPAdapter(config, acpOptions);

		case AgentType.AUTO:
			// Will be handled by autoDetectAdapter
			throw new Error("Use autoDetectAdapter for AgentType.AUTO");

		default:
			throw new Error(`Unknown agent type: ${type}`);
	}
}

/**
 * Auto-detect available adapter
 */
export async function autoDetectAdapter(
	config?: Partial<AdapterConfig>,
	acpOptions?: ACPAdapterOptions,
): Promise<ToolAdapter | null> {
	const adapters = [
		new ClaudeAdapter(config),
		new QChatAdapter(config),
		new GeminiAdapter(config),
		new ACPAdapter(config, acpOptions),
	];

	for (const adapter of adapters) {
		logger.debug(`Checking availability of ${adapter.name}...`);
		const available = await adapter.checkAvailability();
		if (available) {
			logger.info(`Auto-detected adapter: ${adapter.name}`);
			return adapter;
		}
	}

	logger.warn("No adapters available");
	return null;
}

/**
 * Get adapter for the specified type, with auto-detection support
 */
export async function getAdapter(
	type: AgentType,
	config?: Partial<AdapterConfig>,
	acpOptions?: ACPAdapterOptions,
): Promise<ToolAdapter | null> {
	if (type === AgentType.AUTO) {
		return autoDetectAdapter(config, acpOptions);
	}

	const adapter = createAdapter(type, config, acpOptions);
	const available = await adapter.checkAvailability();

	if (!available) {
		logger.warn(`Adapter ${adapter.name} is not available`);
		return null;
	}

	return adapter;
}

/**
 * Get all available adapters
 */
export async function getAvailableAdapters(
	config?: Partial<AdapterConfig>,
): Promise<ToolAdapter[]> {
	const adapters = [
		new ClaudeAdapter(config),
		new QChatAdapter(config),
		new GeminiAdapter(config),
		new ACPAdapter(config),
	];

	const available: ToolAdapter[] = [];

	for (const adapter of adapters) {
		if (await adapter.checkAvailability()) {
			available.push(adapter);
		}
	}

	return available;
}
