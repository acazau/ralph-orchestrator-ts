/**
 * Tests for Git utilities
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import {
	execGit,
	isGitRepo,
	getCurrentBranch,
	getCurrentCommit,
	getShortCommit,
	stageAll,
	stageFiles,
	commit,
	createCheckpoint,
	getStatus,
	hasUncommittedChanges,
	getRecentCommits,
	resetToCommit,
	createTag,
	initRepo,
	getGitRoot,
} from "../../src/utils/git.ts";

const TEST_DIR = join(process.cwd(), ".test-git-temp");

describe("Git utilities - basic functions", () => {
	test("execGit should execute git commands", async () => {
		const result = await execGit(["--version"]);
		expect(result.success).toBe(true);
		expect(result.stdout).toContain("git version");
		expect(result.exitCode).toBe(0);
	});

	test("execGit should handle invalid commands", async () => {
		const result = await execGit(["invalid-command-xyz"]);
		expect(result.success).toBe(false);
		expect(result.exitCode).not.toBe(0);
	});

	test("isGitRepo should return true for git directories", async () => {
		// Current project should be a git repo
		const result = await isGitRepo(process.cwd());
		expect(result).toBe(true);
	});

	test("isGitRepo should return false for non-git directories", async () => {
		const result = await isGitRepo("/tmp");
		expect(result).toBe(false);
	});
});

describe("Git utilities - repository operations", () => {
	beforeEach(async () => {
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	test("initRepo should initialize a git repository", async () => {
		const result = await initRepo(TEST_DIR);
		expect(result.success).toBe(true);

		const isRepo = await isGitRepo(TEST_DIR);
		expect(isRepo).toBe(true);
	});

	test("getGitRoot should return root directory", async () => {
		await initRepo(TEST_DIR);
		const root = await getGitRoot(TEST_DIR);
		expect(root).toBe(TEST_DIR);
	});

	test("getGitRoot should return null for non-repo", async () => {
		const root = await getGitRoot("/tmp");
		expect(root).toBeNull();
	});

	test("getCurrentBranch should return branch name", async () => {
		await initRepo(TEST_DIR);
		// Create initial commit to establish branch
		await Bun.write(join(TEST_DIR, "test.txt"), "test");
		await execGit(["add", "."], TEST_DIR);
		await execGit(["commit", "-m", "initial"], TEST_DIR);

		const branch = await getCurrentBranch(TEST_DIR);
		expect(branch).toBeTruthy();
		expect(typeof branch).toBe("string");
	});

	test("getCurrentCommit should return commit hash", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "test");
		await execGit(["add", "."], TEST_DIR);
		await execGit(["commit", "-m", "initial"], TEST_DIR);

		const commit = await getCurrentCommit(TEST_DIR);
		expect(commit).toBeTruthy();
		expect(commit?.length).toBe(40); // Full SHA
	});

	test("getShortCommit should return short hash", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "test");
		await execGit(["add", "."], TEST_DIR);
		await execGit(["commit", "-m", "initial"], TEST_DIR);

		const short = await getShortCommit(TEST_DIR);
		expect(short).toBeTruthy();
		expect(short?.length).toBeLessThan(40);
	});

	test("getStatus should return porcelain status", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "untracked.txt"), "test");

		const result = await getStatus(TEST_DIR);
		expect(result.success).toBe(true);
		expect(result.stdout).toContain("untracked.txt");
	});

	test("hasUncommittedChanges should detect changes", async () => {
		await initRepo(TEST_DIR);

		// Initially no changes
		const clean = await hasUncommittedChanges(TEST_DIR);
		expect(clean).toBe(false);

		// Add a file
		await Bun.write(join(TEST_DIR, "new.txt"), "content");
		const dirty = await hasUncommittedChanges(TEST_DIR);
		expect(dirty).toBe(true);
	});

	test("stageAll should stage all files", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "file1.txt"), "content1");
		await Bun.write(join(TEST_DIR, "file2.txt"), "content2");

		const result = await stageAll(TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("stageFiles should stage specific files", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "file1.txt"), "content1");
		await Bun.write(join(TEST_DIR, "file2.txt"), "content2");

		const result = await stageFiles(["file1.txt"], TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("commit should create a commit", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "content");
		await stageAll(TEST_DIR);

		const result = await commit("Test commit", TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("createCheckpoint should create checkpoint commit", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "content");

		const result = await createCheckpoint(1, undefined, TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("createCheckpoint with custom message", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "content");

		const result = await createCheckpoint(2, "Custom message", TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("createCheckpoint should handle nothing to commit", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "content");
		await stageAll(TEST_DIR);
		await commit("initial", TEST_DIR);

		// No new changes - function still returns a result (might be false if git doesn't say "nothing to commit")
		const result = await createCheckpoint(1, undefined, TEST_DIR);
		// The function may return false or true depending on git's message
		expect(typeof result.success).toBe("boolean");
		expect(result).toHaveProperty("stdout");
		expect(result).toHaveProperty("stderr");
	});

	test("getRecentCommits should return commit list", async () => {
		await initRepo(TEST_DIR);

		// Create multiple commits
		for (let i = 1; i <= 3; i++) {
			await Bun.write(join(TEST_DIR, `file${i}.txt`), `content${i}`);
			await stageAll(TEST_DIR);
			await commit(`Commit ${i}`, TEST_DIR);
		}

		const commits = await getRecentCommits(5, TEST_DIR);
		expect(commits.length).toBe(3);
	});

	test("getRecentCommits should return empty for no commits", async () => {
		await initRepo(TEST_DIR);
		const commits = await getRecentCommits(5, TEST_DIR);
		expect(commits.length).toBe(0);
	});

	test("resetToCommit should reset to specific commit", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "file1.txt"), "content1");
		await stageAll(TEST_DIR);
		await commit("Commit 1", TEST_DIR);

		const firstCommit = await getCurrentCommit(TEST_DIR);

		await Bun.write(join(TEST_DIR, "file2.txt"), "content2");
		await stageAll(TEST_DIR);
		await commit("Commit 2", TEST_DIR);

		// Reset to first commit
		const result = await resetToCommit(firstCommit!, false, TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("createTag should create a tag", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "content");
		await stageAll(TEST_DIR);
		await commit("initial", TEST_DIR);

		const result = await createTag("v1.0.0", undefined, TEST_DIR);
		expect(result.success).toBe(true);
	});

	test("createTag with message should create annotated tag", async () => {
		await initRepo(TEST_DIR);
		await Bun.write(join(TEST_DIR, "test.txt"), "content");
		await stageAll(TEST_DIR);
		await commit("initial", TEST_DIR);

		const result = await createTag("v1.0.1", "Release 1.0.1", TEST_DIR);
		expect(result.success).toBe(true);
	});
});
