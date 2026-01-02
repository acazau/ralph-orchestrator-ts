/**
 * Tests for YAML configuration utilities
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import {
	loadConfigFromYaml,
	loadConfigFromYamlString,
	saveConfigToYaml,
	generateDefaultYaml,
} from "../../src/utils/yaml.ts";
import { AgentType, createDefaultConfig } from "../../src/types/index.ts";

const TEST_DIR = join(process.cwd(), ".test-yaml-temp");

describe("loadConfigFromYamlString", () => {
	test("should parse minimal YAML config", () => {
		const yaml = `
agent: claude
max_iterations: 50
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.CLAUDE);
		expect(config.maxIterations).toBe(50);
	});

	test("should parse full YAML config", () => {
		const yaml = `
agent: gemini
prompt_file: test.md
prompt_text: "Hello world"
max_iterations: 100
max_runtime: 3600
checkpoint_interval: 10
retry_delay: 5
archive_prompts: true
git_checkpoint: false
verbose: true
dry_run: false
max_tokens: 500000
max_cost: 25.5
context_window: 100000
context_threshold: 0.9
metrics_interval: 5
enable_metrics: true
max_prompt_size: 1048576
allow_unsafe_paths: false
output_format: json
output_verbosity: debug
show_token_usage: true
show_timestamps: false
iteration_telemetry: true
output_preview_length: 200
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.GEMINI);
		expect(config.promptFile).toBe("test.md");
		expect(config.promptText).toBe("Hello world");
		expect(config.maxIterations).toBe(100);
		expect(config.maxRuntime).toBe(3600);
		expect(config.checkpointInterval).toBe(10);
		expect(config.retryDelay).toBe(5);
		expect(config.archivePrompts).toBe(true);
		expect(config.gitCheckpoint).toBe(false);
		expect(config.verbose).toBe(true);
		expect(config.dryRun).toBe(false);
		expect(config.maxTokens).toBe(500000);
		expect(config.maxCost).toBe(25.5);
		expect(config.contextWindow).toBe(100000);
		expect(config.contextThreshold).toBe(0.9);
		expect(config.metricsInterval).toBe(5);
		expect(config.enableMetrics).toBe(true);
		expect(config.maxPromptSize).toBe(1048576);
		expect(config.allowUnsafePaths).toBe(false);
		expect(config.outputFormat).toBe("json");
		expect(config.outputVerbosity).toBe("debug");
		expect(config.showTokenUsage).toBe(true);
		expect(config.showTimestamps).toBe(false);
		expect(config.iterationTelemetry).toBe(true);
		expect(config.outputPreviewLength).toBe(200);
	});

	test("should handle agent type auto", () => {
		const yaml = `agent: auto`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.AUTO);
	});

	test("should handle agent type q", () => {
		const yaml = `agent: q`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.Q);
	});

	test("should handle agent type acp", () => {
		const yaml = `agent: acp`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.ACP);
	});

	test("should default to auto for unknown agent", () => {
		const yaml = `agent: unknown_agent`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.AUTO);
	});

	test("should default to auto when agent not specified", () => {
		const yaml = `max_iterations: 10`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.AUTO);
	});

	test("should handle case insensitive agent names", () => {
		const yaml = `agent: CLAUDE`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.CLAUDE);
	});

	test("should parse agent_args array", () => {
		const yaml = `
agent_args:
  - --verbose
  - --timeout=300
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agentArgs).toEqual(["--verbose", "--timeout=300"]);
	});

	test("should parse adapters configuration", () => {
		const yaml = `
adapters:
  claude:
    enabled: true
    timeout: 300
    maxRetries: 5
  gemini:
    enabled: false
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.adapters.claude.enabled).toBe(true);
		expect(config.adapters.claude.timeout).toBe(300);
		expect(config.adapters.claude.maxRetries).toBe(5);
		expect(config.adapters.gemini.enabled).toBe(false);
	});

	test("should handle boolean adapter config", () => {
		const yaml = `
adapters:
  claude: true
  gemini: false
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.adapters.claude.enabled).toBe(true);
		expect(config.adapters.gemini.enabled).toBe(false);
	});

	test("should handle minimal YAML with empty object", () => {
		const yaml = `{}`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.AUTO);
		expect(config.maxIterations).toBeDefined();
	});

	test("should handle null values gracefully", () => {
		const yaml = `
agent: null
max_iterations: null
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.AUTO);
	});

	test("should parse acp configuration", () => {
		const yaml = `
acp_agent: my-agent
acp_permission_mode: auto
`;
		const config = loadConfigFromYamlString(yaml);
		expect(config.acpAgent).toBe("my-agent");
		expect(config.acpPermissionMode).toBe("auto");
	});
});

describe("loadConfigFromYaml", () => {
	beforeEach(async () => {
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	test("should load config from file", async () => {
		const configPath = join(TEST_DIR, "ralph.yml");
		await writeFile(
			configPath,
			`
agent: claude
max_iterations: 75
verbose: true
`
		);

		const config = await loadConfigFromYaml(configPath);
		expect(config.agent).toBe(AgentType.CLAUDE);
		expect(config.maxIterations).toBe(75);
		expect(config.verbose).toBe(true);
	});

	test("should throw error for non-existent file", async () => {
		const configPath = join(TEST_DIR, "nonexistent.yml");
		await expect(loadConfigFromYaml(configPath)).rejects.toThrow(
			"Configuration file not found"
		);
	});

	test("should load complex config from file", async () => {
		const configPath = join(TEST_DIR, "complex.yml");
		await writeFile(
			configPath,
			`
agent: gemini
adapters:
  claude:
    enabled: true
    timeout: 600
  q:
    enabled: false
agent_args:
  - --flag1
  - --flag2=value
`
		);

		const config = await loadConfigFromYaml(configPath);
		expect(config.agent).toBe(AgentType.GEMINI);
		expect(config.adapters.claude.enabled).toBe(true);
		expect(config.adapters.claude.timeout).toBe(600);
		expect(config.adapters.q.enabled).toBe(false);
		expect(config.agentArgs).toEqual(["--flag1", "--flag2=value"]);
	});
});

describe("saveConfigToYaml", () => {
	beforeEach(async () => {
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await rm(TEST_DIR, { recursive: true, force: true });
	});

	test("should save config to file", async () => {
		const configPath = join(TEST_DIR, "output.yml");
		const config = createDefaultConfig({
			agent: AgentType.CLAUDE,
			maxIterations: 200,
			verbose: true,
		});

		await saveConfigToYaml(config, configPath);

		// Read back and verify
		const savedConfig = await loadConfigFromYaml(configPath);
		expect(savedConfig.agent).toBe(AgentType.CLAUDE);
		expect(savedConfig.maxIterations).toBe(200);
		expect(savedConfig.verbose).toBe(true);
	});

	test("should save and load full config roundtrip", async () => {
		const configPath = join(TEST_DIR, "roundtrip.yml");
		const config = createDefaultConfig({
			agent: AgentType.GEMINI,
			promptFile: "custom.md",
			maxIterations: 50,
			maxRuntime: 7200,
			maxCost: 100,
			verbose: true,
			dryRun: true,
			outputFormat: "json",
			outputVerbosity: "debug",
		});

		await saveConfigToYaml(config, configPath);
		const loadedConfig = await loadConfigFromYaml(configPath);

		expect(loadedConfig.agent).toBe(config.agent);
		expect(loadedConfig.promptFile).toBe(config.promptFile);
		expect(loadedConfig.maxIterations).toBe(config.maxIterations);
		expect(loadedConfig.maxRuntime).toBe(config.maxRuntime);
		expect(loadedConfig.maxCost).toBe(config.maxCost);
		expect(loadedConfig.verbose).toBe(config.verbose);
		expect(loadedConfig.dryRun).toBe(config.dryRun);
		expect(loadedConfig.outputFormat).toBe(config.outputFormat);
		expect(loadedConfig.outputVerbosity).toBe(config.outputVerbosity);
	});
});

describe("generateDefaultYaml", () => {
	test("should generate valid YAML string", () => {
		const yaml = generateDefaultYaml();
		expect(typeof yaml).toBe("string");
		expect(yaml.length).toBeGreaterThan(0);
	});

	test("should contain agent configuration", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("agent: auto");
	});

	test("should contain prompt_file", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("prompt_file: PROMPT.md");
	});

	test("should contain max_iterations", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("max_iterations: 100");
	});

	test("should contain max_runtime", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("max_runtime: 14400");
	});

	test("should contain checkpoint_interval", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("checkpoint_interval: 5");
	});

	test("should contain cost limits", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("max_tokens: 1000000");
		expect(yaml).toContain("max_cost: 50.0");
	});

	test("should contain context settings", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("context_window: 200000");
		expect(yaml).toContain("context_threshold: 0.8");
	});

	test("should contain metrics settings", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("enable_metrics: true");
		expect(yaml).toContain("metrics_interval: 10");
	});

	test("should contain output settings", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("output_format: rich");
		expect(yaml).toContain("output_verbosity: normal");
	});

	test("should be parseable YAML", () => {
		const yaml = generateDefaultYaml();
		const config = loadConfigFromYamlString(yaml);
		expect(config.agent).toBe(AgentType.AUTO);
		expect(config.maxIterations).toBe(100);
	});

	test("should contain commented adapter examples", () => {
		const yaml = generateDefaultYaml();
		expect(yaml).toContain("# adapters:");
		expect(yaml).toContain("#   claude:");
	});
});
