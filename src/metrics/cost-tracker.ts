/**
 * Cost tracking for Ralph Orchestrator
 */

import type { CostEntry, CostSummary } from "../types/index.ts";
import { toJsonString } from "../utils/shared.ts";

/**
 * Cost per 1K tokens by tool (approximate)
 */
export const TOOL_COSTS: Record<string, { input: number; output: number }> = {
	claude: {
		input: 0.003, // $3 per 1M input tokens
		output: 0.015, // $15 per 1M output tokens
	},
	gemini: {
		input: 0.00025, // $0.25 per 1M input tokens
		output: 0.001, // $1 per 1M output tokens
	},
	qchat: {
		input: 0, // Free/local
		output: 0,
	},
	acp: {
		input: 0, // ACP doesn't provide billing info
		output: 0, // Cost depends on underlying agent
	},
	"gpt-4": {
		input: 0.03, // $30 per 1M input tokens
		output: 0.06, // $60 per 1M output tokens
	},
};

/**
 * Cost tracker class
 */
export class CostTracker {
	private totalCost = 0;
	private readonly costsByTool: Map<string, number> = new Map();
	private usageHistory: CostEntry[] = [];

	/**
	 * Add usage and calculate cost
	 * @param tool Name of the AI tool
	 * @param inputTokens Number of input tokens
	 * @param outputTokens Number of output tokens
	 * @returns Cost for this usage
	 */
	addUsage(tool: string, inputTokens: number, outputTokens: number): number {
		const costs = TOOL_COSTS[tool] ?? TOOL_COSTS.qchat!;

		const inputCost = (inputTokens / 1000) * costs.input;
		const outputCost = (outputTokens / 1000) * costs.output;
		const total = inputCost + outputCost;

		// Update tracking
		this.totalCost += total;
		const currentToolCost = this.costsByTool.get(tool) ?? 0;
		this.costsByTool.set(tool, currentToolCost + total);

		// Add to history
		this.usageHistory.push({
			timestamp: Date.now(),
			tool,
			inputTokens,
			outputTokens,
			cost: total,
		});

		return total;
	}

	/**
	 * Get total cost
	 */
	getTotalCost(): number {
		return this.totalCost;
	}

	/**
	 * Get cost by tool
	 */
	getCostByTool(tool: string): number {
		return this.costsByTool.get(tool) ?? 0;
	}

	/**
	 * Get all costs by tool
	 */
	getAllCostsByTool(): Record<string, number> {
		const result: Record<string, number> = {};
		for (const [tool, cost] of this.costsByTool) {
			result[tool] = cost;
		}
		return result;
	}

	/**
	 * Get usage count
	 */
	getUsageCount(): number {
		return this.usageHistory.length;
	}

	/**
	 * Get average cost per usage
	 */
	getAverageCost(): number {
		if (this.usageHistory.length === 0) return 0;
		return this.totalCost / this.usageHistory.length;
	}

	/**
	 * Get usage history
	 */
	getHistory(): CostEntry[] {
		return [...this.usageHistory];
	}

	/**
	 * Get recent usage entries
	 */
	getRecentUsage(count: number): CostEntry[] {
		return this.usageHistory.slice(-count);
	}

	/**
	 * Get cost summary
	 */
	getSummary(): CostSummary {
		return {
			totalCost: this.totalCost,
			costsByTool: this.getAllCostsByTool(),
			usageCount: this.usageHistory.length,
			averageCost: this.getAverageCost(),
		};
	}

	/**
	 * Convert to JSON string
	 */
	toJson(): string {
		return toJsonString(this.getSummary());
	}

	/**
	 * Reset tracker
	 */
	reset(): void {
		this.totalCost = 0;
		this.costsByTool.clear();
		this.usageHistory = [];
	}

	/**
	 * Estimate cost for a prompt
	 */
	static estimateCost(
		tool: string,
		inputTokens: number,
		estimatedOutputTokens: number,
	): number {
		const costs = TOOL_COSTS[tool] ?? TOOL_COSTS.qchat!;
		return (
			(inputTokens / 1000) * costs.input +
			(estimatedOutputTokens / 1000) * costs.output
		);
	}
}
