/**
 * Ralph Orchestrator - Main entry point
 */

// Export types
export * from "./types/index.ts";

// Export config
export { ConfigValidator, loadConfig, createConfigFromArgs } from "./config.ts";

// Export utilities
export * from "./utils/index.ts";

// Export metrics
export {
	MetricsTracker,
	CostTracker,
	IterationStats,
} from "./metrics/index.ts";

// Export safety
export { SafetyGuard } from "./safety/index.ts";

// Export context
export {
	ContextManager,
	type ContextManagerOptions,
	type ContextStats,
} from "./context/index.ts";

// Export adapters
export {
	ToolAdapter,
	ClaudeAdapter,
	GeminiAdapter,
	QChatAdapter,
	ACPAdapter,
	createAdapter,
	autoDetectAdapter,
	getAdapter,
	getAvailableAdapters,
} from "./adapters/index.ts";

// Export orchestrator
export { RalphOrchestrator, type OrchestratorState } from "./orchestrator.ts";

// Version
export const VERSION = "1.0.0";
