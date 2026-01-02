#!/usr/bin/env bun
/**
 * Ralph Orchestrator CLI
 */

import { mkdir } from "node:fs/promises";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { ConfigValidator, createConfigFromArgs, loadConfig } from "./config.ts";
import { RalphOrchestrator } from "./orchestrator.ts";
import { CONFIG_DEFAULTS } from "./types/index.ts";
import { getStatus, isGitRepo } from "./utils/git.ts";
import { LogLevel, setLogLevel } from "./utils/logger.ts";
import { generateDefaultYaml } from "./utils/yaml.ts";

const VERSION = "1.0.0";

const program = new Command();

program
	.name("ralph")
	.description("Ralph Orchestrator - Put AI in a loop until done")
	.version(VERSION);

/**
 * Run command - Main orchestration
 */
program
	.command("run")
	.description("Run the orchestration loop")
	.option(
		"-a, --agent <type>",
		"AI agent to use (claude, q, gemini, acp, auto)",
		"auto",
	)
	.option(
		"-P, --prompt <file>",
		"Prompt file path",
		CONFIG_DEFAULTS.PROMPT_FILE,
	)
	.option("-p, --prompt-text <text>", "Direct prompt text (overrides --prompt)")
	.option(
		"-i, --max-iterations <n>",
		"Maximum iterations",
		String(CONFIG_DEFAULTS.MAX_ITERATIONS),
	)
	.option(
		"-t, --max-runtime <n>",
		"Maximum runtime in seconds",
		String(CONFIG_DEFAULTS.MAX_RUNTIME),
	)
	.option(
		"-c, --checkpoint-interval <n>",
		"Checkpoint interval",
		String(CONFIG_DEFAULTS.CHECKPOINT_INTERVAL),
	)
	.option(
		"-r, --retry-delay <n>",
		"Retry delay in seconds",
		String(CONFIG_DEFAULTS.RETRY_DELAY),
	)
	.option(
		"--max-tokens <n>",
		"Maximum total tokens",
		String(CONFIG_DEFAULTS.MAX_TOKENS),
	)
	.option(
		"--max-cost <n>",
		"Maximum cost in USD",
		String(CONFIG_DEFAULTS.MAX_COST),
	)
	.option(
		"--context-window <n>",
		"Context window size",
		String(CONFIG_DEFAULTS.CONTEXT_WINDOW),
	)
	.option(
		"--context-threshold <n>",
		"Context threshold",
		String(CONFIG_DEFAULTS.CONTEXT_THRESHOLD),
	)
	.option("--no-git", "Disable git checkpointing")
	.option("--no-archive", "Disable prompt archiving")
	.option("-v, --verbose", "Enable verbose output")
	.option("--dry-run", "Dry run mode")
	.option(
		"--output-format <format>",
		"Output format (plain, rich, json)",
		"rich",
	)
	.option(
		"--output-verbosity <level>",
		"Verbosity level (quiet, normal, verbose, debug)",
		"normal",
	)
	.option("--config <file>", "Configuration file path")
	.option("--acp-agent <command>", "ACP agent command")
	.option("--acp-permission-mode <mode>", "ACP permission mode")
	.action(async (options) => {
		try {
			// Set log level
			if (options.verbose) {
				setLogLevel(LogLevel.DEBUG);
			}

			// Load config
			let config;
			if (options.config) {
				const loaded = await loadConfig(options.config);
				if (!loaded.validation.valid) {
					console.error(chalk.red("Configuration errors:"));
					for (const error of loaded.validation.errors) {
						console.error(chalk.red(`  - ${error.field}: ${error.message}`));
					}
					process.exit(1);
				}
				config = loaded.config;
			} else {
				config = createConfigFromArgs({
					agent: options.agent,
					prompt: options.prompt,
					promptText: options.promptText,
					maxIterations: Number.parseInt(options.maxIterations, 10),
					maxRuntime: Number.parseInt(options.maxRuntime, 10),
					checkpointInterval: Number.parseInt(options.checkpointInterval, 10),
					retryDelay: Number.parseInt(options.retryDelay, 10),
					maxTokens: Number.parseInt(options.maxTokens, 10),
					maxCost: Number.parseFloat(options.maxCost),
					contextWindow: Number.parseInt(options.contextWindow, 10),
					contextThreshold: Number.parseFloat(options.contextThreshold),
					noGit: !options.git,
					noArchive: !options.archive,
					verbose: options.verbose,
					dryRun: options.dryRun,
					outputFormat: options.outputFormat,
					outputVerbosity: options.outputVerbosity,
					acpAgent: options.acpAgent,
					acpPermissionMode: options.acpPermissionMode,
				});
			}

			// Validate config
			const validation = ConfigValidator.validate(config);
			if (!validation.valid) {
				console.error(chalk.red("Configuration errors:"));
				for (const error of validation.errors) {
					console.error(chalk.red(`  - ${error.field}: ${error.message}`));
				}
				process.exit(1);
			}

			// Show warnings
			for (const warning of validation.warnings) {
				console.warn(chalk.yellow(`Warning: ${warning.message}`));
			}

			// Run orchestrator
			console.log(chalk.blue("\nStarting Ralph Orchestrator..."));
			console.log(chalk.gray(`Agent: ${config.agent}`));
			console.log(chalk.gray(`Max iterations: ${config.maxIterations}`));
			console.log(chalk.gray(`Max runtime: ${config.maxRuntime}s`));
			console.log("");

			const orchestrator = new RalphOrchestrator(config);
			await orchestrator.run();
		} catch (error) {
			console.error(
				chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
			);
			process.exit(1);
		}
	});

/**
 * Init command - Initialize a new project
 */
program
	.command("init")
	.description("Initialize a new Ralph project")
	.option("-f, --force", "Overwrite existing files")
	.action(async (options) => {
		const spinner = ora("Initializing Ralph project...").start();

		try {
			// Create directories
			await mkdir(".agent/workspace", { recursive: true });
			await mkdir(".agent/prompts", { recursive: true });
			await mkdir(".agent/checkpoints", { recursive: true });
			await mkdir(".agent/metrics", { recursive: true });
			await mkdir(".agent/cache", { recursive: true });

			// Create ralph.yml if not exists
			const configFile = Bun.file("ralph.yml");
			if (!options.force && (await configFile.exists())) {
				spinner.warn("ralph.yml already exists (use --force to overwrite)");
			} else {
				await Bun.write("ralph.yml", generateDefaultYaml());
				spinner.succeed("Created ralph.yml");
			}

			// Create PROMPT.md if not exists
			const promptFile = Bun.file("PROMPT.md");
			if (!options.force && (await promptFile.exists())) {
				console.log(chalk.yellow("  PROMPT.md already exists"));
			} else {
				await Bun.write(
					"PROMPT.md",
					`# Task Description

Describe your task here. Ralph will work on this iteratively until complete.

## Goals

- [ ] First goal
- [ ] Second goal
- [ ] Third goal

## Notes

Add any additional context or requirements here.
`,
				);
				console.log(chalk.green("  Created PROMPT.md"));
			}

			spinner.succeed("Ralph project initialized");
			console.log(
				chalk.gray("\nRun `ralph run` to start the orchestration loop"),
			);
		} catch (error) {
			spinner.fail(
				`Failed to initialize: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});

/**
 * Status command - Check current status
 */
program
	.command("status")
	.description("Check Ralph status")
	.action(async () => {
		console.log(chalk.blue("Ralph Orchestrator Status\n"));

		// Check if in git repo
		const inGit = await isGitRepo();
		console.log(
			`Git repository: ${inGit ? chalk.green("Yes") : chalk.yellow("No")}`,
		);

		if (inGit) {
			const status = await getStatus();
			const hasChanges = status.stdout.length > 0;
			console.log(
				`Uncommitted changes: ${hasChanges ? chalk.yellow("Yes") : chalk.green("No")}`,
			);
		}

		// Check prompt file
		const promptFile = Bun.file("PROMPT.md");
		const hasPrompt = await promptFile.exists();
		console.log(
			`PROMPT.md: ${hasPrompt ? chalk.green("Found") : chalk.red("Not found")}`,
		);

		// Check config file
		const configFile = Bun.file("ralph.yml");
		const hasConfig = await configFile.exists();
		console.log(
			`ralph.yml: ${hasConfig ? chalk.green("Found") : chalk.yellow("Not found (using defaults)")}`,
		);

		// Check .agent directory
		console.log(
			`.agent/: ${(await Bun.file(".agent/workspace").exists()) ? chalk.green("Initialized") : chalk.yellow("Not initialized")}`,
		);

		console.log("");
	});

/**
 * Clean command - Clean workspace
 */
program
	.command("clean")
	.description("Clean Ralph workspace")
	.option("--all", "Remove all Ralph files including prompts")
	.action(async (options) => {
		const spinner = ora("Cleaning workspace...").start();

		try {
			const { rm } = await import("node:fs/promises");

			// Remove cache
			await rm(".agent/cache", { recursive: true, force: true });

			// Remove metrics
			await rm(".agent/metrics", { recursive: true, force: true });

			if (options.all) {
				// Remove everything
				await rm(".agent", { recursive: true, force: true });
			}

			spinner.succeed("Workspace cleaned");
		} catch (error) {
			spinner.fail(
				`Failed to clean: ${error instanceof Error ? error.message : error}`,
			);
			process.exit(1);
		}
	});

/**
 * Prompt command - Generate or modify prompt
 */
program
	.command("prompt")
	.description("Generate or show prompt")
	.option("-s, --show", "Show current prompt")
	.option("-g, --generate", "Generate new prompt template")
	.action(async (options) => {
		if (options.show) {
			const promptFile = Bun.file("PROMPT.md");
			if (await promptFile.exists()) {
				const content = await promptFile.text();
				console.log(content);
			} else {
				console.error(chalk.red("PROMPT.md not found"));
				process.exit(1);
			}
		} else if (options.generate) {
			const template = `# Task Description

[Describe your task here]

## Goals

- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

## Requirements

- Requirement 1
- Requirement 2

## Notes

Additional context...
`;
			console.log(template);
		} else {
			// Interactive mode would go here
			console.log(
				chalk.gray(
					"Use --show to display current prompt or --generate for a template",
				),
			);
		}
	});

/**
 * Web command - Start web dashboard
 */
program
	.command("web")
	.description("Start the web dashboard")
	.option("-p, --port <n>", "Server port", "3000")
	.option("-H, --hostname <host>", "Server hostname", "0.0.0.0")
	.option("--no-auth", "Disable authentication")
	.option("--db <path>", "Database path", ".agent/ralph.db")
	.option("--admin-password <password>", "Admin password")
	.action(async (options) => {
		try {
			const { startServer } = await import("./web/index.ts");

			console.log(chalk.blue("Starting Ralph Web Dashboard..."));

			await startServer({
				port: Number.parseInt(options.port, 10),
				hostname: options.hostname,
				dbPath: options.db,
				auth: {
					enabled: options.auth,
				},
				adminPassword: options.adminPassword,
			});
		} catch (error) {
			console.error(
				chalk.red(`Error: ${error instanceof Error ? error.message : error}`),
			);
			process.exit(1);
		}
	});

// Parse arguments
program.parse();
