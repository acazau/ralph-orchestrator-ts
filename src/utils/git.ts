/**
 * Git utilities for Ralph Orchestrator
 */

import { createLogger } from "./logger.ts";

const logger = createLogger("ralph-orchestrator.git");

/**
 * Result of a git command execution
 */
export interface GitResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number;
}

/**
 * Execute a git command
 */
export async function execGit(
	args: string[],
	cwd?: string,
): Promise<GitResult> {
	const proc = Bun.spawn(["git", ...args], {
		cwd: cwd || process.cwd(),
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;

	return {
		success: exitCode === 0,
		stdout: stdout.trim(),
		stderr: stderr.trim(),
		exitCode,
	};
}

/**
 * Check if the current directory is a git repository
 */
export async function isGitRepo(cwd?: string): Promise<boolean> {
	const result = await execGit(["rev-parse", "--is-inside-work-tree"], cwd);
	return result.success && result.stdout === "true";
}

/**
 * Get the current git branch
 */
export async function getCurrentBranch(cwd?: string): Promise<string | null> {
	const result = await execGit(["branch", "--show-current"], cwd);
	return result.success ? result.stdout : null;
}

/**
 * Get the current git commit hash
 */
export async function getCurrentCommit(cwd?: string): Promise<string | null> {
	const result = await execGit(["rev-parse", "HEAD"], cwd);
	return result.success ? result.stdout : null;
}

/**
 * Get the short commit hash
 */
export async function getShortCommit(cwd?: string): Promise<string | null> {
	const result = await execGit(["rev-parse", "--short", "HEAD"], cwd);
	return result.success ? result.stdout : null;
}

/**
 * Stage all changes
 */
export async function stageAll(cwd?: string): Promise<GitResult> {
	return execGit(["add", "-A"], cwd);
}

/**
 * Stage specific files
 */
export async function stageFiles(
	files: string[],
	cwd?: string,
): Promise<GitResult> {
	return execGit(["add", ...files], cwd);
}

/**
 * Create a commit with the given message
 */
export async function commit(
	message: string,
	cwd?: string,
): Promise<GitResult> {
	return execGit(["commit", "-m", message], cwd);
}

/**
 * Create a checkpoint commit
 */
export async function createCheckpoint(
	iteration: number,
	message?: string,
	cwd?: string,
): Promise<GitResult> {
	// Stage all changes first
	const stageResult = await stageAll(cwd);
	if (!stageResult.success) {
		logger.warn(`Failed to stage changes: ${stageResult.stderr}`);
		// Continue anyway - might be nothing to stage
	}

	// Create the commit
	const commitMessage =
		message ||
		`[Ralph Checkpoint] Iteration ${iteration}\n\nAutomated checkpoint by Ralph Orchestrator`;

	const commitResult = await commit(commitMessage, cwd);

	if (commitResult.success) {
		logger.info(`Created checkpoint for iteration ${iteration}`);
	} else if (commitResult.stderr.includes("nothing to commit")) {
		logger.debug("No changes to commit");
		return { ...commitResult, success: true }; // Treat as success
	} else {
		logger.warn(`Failed to create checkpoint: ${commitResult.stderr}`);
	}

	return commitResult;
}

/**
 * Get the status of the working directory
 */
export async function getStatus(cwd?: string): Promise<GitResult> {
	return execGit(["status", "--porcelain"], cwd);
}

/**
 * Check if there are uncommitted changes
 */
export async function hasUncommittedChanges(cwd?: string): Promise<boolean> {
	const result = await getStatus(cwd);
	return result.success && result.stdout.length > 0;
}

/**
 * Get recent commits
 */
export async function getRecentCommits(
	count = 5,
	cwd?: string,
): Promise<string[]> {
	const result = await execGit(
		["log", "--oneline", `-n${count}`, "--pretty=format:%h %s"],
		cwd,
	);
	if (!result.success) return [];
	return result.stdout.split("\n").filter((line) => line.length > 0);
}

/**
 * Reset to a specific commit
 */
export async function resetToCommit(
	commit: string,
	hard = false,
	cwd?: string,
): Promise<GitResult> {
	const args = ["reset", hard ? "--hard" : "--soft", commit];
	return execGit(args, cwd);
}

/**
 * Create a tag
 */
export async function createTag(
	name: string,
	message?: string,
	cwd?: string,
): Promise<GitResult> {
	const args = message ? ["tag", "-a", name, "-m", message] : ["tag", name];
	return execGit(args, cwd);
}

/**
 * Initialize a git repository
 */
export async function initRepo(cwd?: string): Promise<GitResult> {
	return execGit(["init"], cwd);
}

/**
 * Get the git root directory
 */
export async function getGitRoot(cwd?: string): Promise<string | null> {
	const result = await execGit(["rev-parse", "--show-toplevel"], cwd);
	return result.success ? result.stdout : null;
}
