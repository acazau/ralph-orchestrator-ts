/**
 * SonarQube Executor - Ralph Orchestrator Integration
 *
 * This module provides the integration point between Ralph orchestrator
 * and the SonarQube scanning ADW system. It handles spawning the
 * scan scripts at appropriate times during orchestration.
 */

import { join } from "node:path";
import { spawn } from "bun";
import type { SonarQubeConfig } from "../types/config.ts";
import { createLogger } from "../utils/logger.ts";
import { extractErrorMessage } from "../utils/shared.ts";

const logger = createLogger("ralph-orchestrator.sonarqube");

/**
 * SonarQube scan mode.
 */
export type ScanMode = "changed" | "full";

/**
 * SonarQube executor for Ralph orchestrator.
 *
 * Handles triggering SonarQube scans from within the orchestration loop.
 */
export class SonarQubeExecutor {
	private readonly config: SonarQubeConfig;
	private readonly workingDir: string;

	constructor(config: SonarQubeConfig, workingDir: string = process.cwd()) {
		this.config = config;
		this.workingDir = workingDir;
	}

	/**
	 * Execute a SonarQube scan.
	 *
	 * Spawns the adw_sonar_scan.ts script with the specified mode.
	 *
	 * @param mode - Scan mode ('changed' or 'full')
	 * @returns Promise that resolves when scan completes
	 */
	async executeScan(mode: ScanMode): Promise<void> {
		logger.info(`Executing SonarQube scan: ${mode}`);

		try {
			const scriptPath = join(this.workingDir, ".adws", "adw_sonar_scan.ts");

			// Spawn ADW script
			const proc = spawn({
				cmd: ["bun", "run", scriptPath, mode],
				cwd: this.workingDir,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Capture output
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;

			if (exitCode === 0) {
				logger.info("Scan completed successfully");
				logger.debug(stdout);
			} else {
				logger.warn(`Scan failed with exit code ${exitCode}`);
				logger.error(stderr);
			}
		} catch (error) {
			logger.error(`Scan execution failed: ${extractErrorMessage(error)}`);
		}
	}

	/**
	 * Execute scan after a checkpoint (if enabled).
	 *
	 * This is called by the orchestrator after creating a git checkpoint.
	 *
	 * @param iteration - Current iteration number
	 * @returns Promise that resolves when scan completes
	 */
	async scanAfterCheckpoint(iteration: number): Promise<void> {
		if (!this.config.scanOnCheckpoint) {
			return;
		}

		logger.info(`Triggering scan after checkpoint (iteration ${iteration})`);

		// Use changed mode for checkpoint scans (incremental)
		const mode: ScanMode = this.config.scanMode || "changed";
		await this.executeScan(mode);
	}

	/**
	 * Execute scan after an iteration (if enabled).
	 *
	 * This is called by the orchestrator after each iteration completes.
	 *
	 * @param iteration - Current iteration number
	 * @returns Promise that resolves when scan completes
	 */
	async scanAfterIteration(iteration: number): Promise<void> {
		if (!this.config.scanAfterIteration) {
			return;
		}

		logger.info(`Triggering scan after iteration ${iteration}`);

		// Use changed mode for iteration scans (incremental)
		const mode: ScanMode = this.config.scanMode || "changed";
		await this.executeScan(mode);
	}

	/**
	 * Check if scans are enabled.
	 *
	 * @returns true if any scan trigger is enabled
	 */
	isEnabled(): boolean {
		return this.config.scanOnCheckpoint || this.config.scanAfterIteration;
	}

	/**
	 * Get executor configuration.
	 *
	 * @returns SonarQube configuration
	 */
	getConfig(): SonarQubeConfig {
		return { ...this.config };
	}
}
