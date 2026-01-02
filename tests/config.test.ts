/**
 * Config tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  AgentType,
  createDefaultConfig,
  CONFIG_DEFAULTS,
} from '../src/types/index.ts';
import { ConfigValidator, loadConfig, createConfigFromArgs } from '../src/config.ts';

const TEST_DIR = join(process.cwd(), '.test-config-temp');

describe('createDefaultConfig', () => {
  it('should create config with default values', () => {
    const config = createDefaultConfig();

    expect(config.agent).toBe(AgentType.AUTO);
    expect(config.maxIterations).toBe(CONFIG_DEFAULTS.MAX_ITERATIONS);
    expect(config.maxRuntime).toBe(CONFIG_DEFAULTS.MAX_RUNTIME);
    expect(config.promptFile).toBe(CONFIG_DEFAULTS.PROMPT_FILE);
  });

  it('should override defaults with provided options', () => {
    const config = createDefaultConfig({
      agent: AgentType.CLAUDE,
      maxIterations: 50,
    });

    expect(config.agent).toBe(AgentType.CLAUDE);
    expect(config.maxIterations).toBe(50);
    expect(config.maxRuntime).toBe(CONFIG_DEFAULTS.MAX_RUNTIME);
  });
});

describe('ConfigValidator', () => {
  it('should validate max iterations', () => {
    expect(ConfigValidator.validateMaxIterations(100)).toEqual([]);
    expect(ConfigValidator.validateMaxIterations(-1)).toHaveLength(1);
    expect(ConfigValidator.validateMaxIterations(200000)).toHaveLength(1);
  });

  it('should validate max runtime', () => {
    expect(ConfigValidator.validateMaxRuntime(3600)).toEqual([]);
    expect(ConfigValidator.validateMaxRuntime(-1)).toHaveLength(1);
  });

  it('should validate context threshold', () => {
    expect(ConfigValidator.validateContextThreshold(0.5)).toEqual([]);
    expect(ConfigValidator.validateContextThreshold(1.5)).toHaveLength(1);
    expect(ConfigValidator.validateContextThreshold(-0.1)).toHaveLength(1);
  });

  it('should validate entire config', () => {
    const validConfig = createDefaultConfig();
    const result = ConfigValidator.validate(validConfig);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect invalid config', () => {
    const invalidConfig = createDefaultConfig({
      maxIterations: -1,
      maxCost: -5,
    });
    const result = ConfigValidator.validate(invalidConfig);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should generate warnings for unusual values', () => {
    const config = createDefaultConfig({
      maxIterations: 1,
      maxRuntime: 5,
    });
    const result = ConfigValidator.validate(config);

    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should generate warning for large retry delay', () => {
    const warnings = ConfigValidator.getWarningLargeDelay(3700);
    expect(warnings.length).toBe(1);
    expect(warnings[0].field).toBe('retryDelay');
  });

  it('should not warn for normal retry delay', () => {
    const warnings = ConfigValidator.getWarningLargeDelay(5);
    expect(warnings.length).toBe(0);
  });

  it('should validate checkpoint interval', () => {
    expect(ConfigValidator.validateCheckpointInterval(5)).toEqual([]);
    expect(ConfigValidator.validateCheckpointInterval(-1)).toHaveLength(1);
  });

  it('should validate retry delay', () => {
    expect(ConfigValidator.validateRetryDelay(5)).toEqual([]);
    expect(ConfigValidator.validateRetryDelay(-1)).toHaveLength(1);
  });

  it('should validate max tokens', () => {
    expect(ConfigValidator.validateMaxTokens(100000)).toEqual([]);
    expect(ConfigValidator.validateMaxTokens(-1)).toHaveLength(1);
  });

  it('should validate max cost', () => {
    expect(ConfigValidator.validateMaxCost(50)).toEqual([]);
    expect(ConfigValidator.validateMaxCost(-1)).toHaveLength(1);
  });

  it('should warn for single iteration', () => {
    const warnings = ConfigValidator.getWarningSingleIteration(1);
    expect(warnings.length).toBe(1);
    expect(warnings[0].field).toBe('maxIterations');
  });

  it('should not warn for multiple iterations', () => {
    const warnings = ConfigValidator.getWarningSingleIteration(10);
    expect(warnings.length).toBe(0);
  });

  it('should warn for short timeout', () => {
    const warnings = ConfigValidator.getWarningShortTimeout(5);
    expect(warnings.length).toBe(1);
    expect(warnings[0].field).toBe('maxRuntime');
  });

  it('should not warn for normal timeout', () => {
    const warnings = ConfigValidator.getWarningShortTimeout(3600);
    expect(warnings.length).toBe(0);
  });

  it('should not warn for zero timeout (infinite)', () => {
    const warnings = ConfigValidator.getWarningShortTimeout(0);
    expect(warnings.length).toBe(0);
  });
});

describe('ConfigValidator.validatePromptFile', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should pass for existing file', async () => {
    const promptPath = join(TEST_DIR, 'PROMPT.md');
    await writeFile(promptPath, '# Test Prompt');

    const errors = await ConfigValidator.validatePromptFile(promptPath);
    expect(errors.length).toBe(0);
  });

  it('should fail for non-existent file', async () => {
    const promptPath = join(TEST_DIR, 'nonexistent.md');

    const errors = await ConfigValidator.validatePromptFile(promptPath);
    expect(errors.length).toBe(1);
    expect(errors[0].field).toBe('promptFile');
  });
});

describe('ConfigValidator.validateAsync', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should validate config with prompt text', async () => {
    const config = createDefaultConfig({
      promptText: 'Test prompt',
    });

    const result = await ConfigValidator.validateAsync(config);
    expect(result.valid).toBe(true);
  });

  it('should validate config with existing prompt file', async () => {
    const promptPath = join(TEST_DIR, 'PROMPT.md');
    await writeFile(promptPath, '# Test Prompt');

    const config = createDefaultConfig({
      promptFile: promptPath,
    });

    const result = await ConfigValidator.validateAsync(config);
    expect(result.valid).toBe(true);
  });

  it('should fail for missing prompt file', async () => {
    const config = createDefaultConfig({
      promptFile: join(TEST_DIR, 'nonexistent.md'),
    });

    const result = await ConfigValidator.validateAsync(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'promptFile')).toBe(true);
  });
});

describe('loadConfig', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should load default config when no path provided', async () => {
    const promptPath = join(TEST_DIR, 'PROMPT.md');
    await writeFile(promptPath, '# Test');

    const { config, validation } = await loadConfig(undefined, {
      promptFile: promptPath,
    });

    expect(config.agent).toBe(AgentType.AUTO);
    expect(validation.valid).toBe(true);
  });

  it('should load config from YAML file', async () => {
    const configPath = join(TEST_DIR, 'ralph.yml');
    const promptPath = join(TEST_DIR, 'PROMPT.md');

    await writeFile(configPath, `
agent: claude
max_iterations: 50
`);
    await writeFile(promptPath, '# Test');

    const { config, validation } = await loadConfig(configPath, {
      promptFile: promptPath,
    });

    expect(config.agent).toBe(AgentType.CLAUDE);
    expect(config.maxIterations).toBe(50);
    expect(validation.valid).toBe(true);
  });

  it('should apply overrides to config', async () => {
    const promptPath = join(TEST_DIR, 'PROMPT.md');
    await writeFile(promptPath, '# Test');

    const { config } = await loadConfig(undefined, {
      promptFile: promptPath,
      maxIterations: 200,
      verbose: true,
    });

    expect(config.maxIterations).toBe(200);
    expect(config.verbose).toBe(true);
  });
});

describe('createConfigFromArgs', () => {
  it('should create config from CLI args', () => {
    const config = createConfigFromArgs({
      agent: 'claude',
      prompt: 'custom.md',
      maxIterations: 75,
      verbose: true,
    });

    expect(config.agent).toBe('claude');
    expect(config.promptFile).toBe('custom.md');
    expect(config.maxIterations).toBe(75);
    expect(config.verbose).toBe(true);
  });

  it('should handle boolean flags', () => {
    const config = createConfigFromArgs({
      noMetrics: true,
      noGit: true,
      noArchive: true,
      noTokenUsage: true,
      noTimestamps: true,
    });

    expect(config.enableMetrics).toBe(false);
    expect(config.gitCheckpoint).toBe(false);
    expect(config.archivePrompts).toBe(false);
    expect(config.showTokenUsage).toBe(false);
    expect(config.showTimestamps).toBe(false);
  });

  it('should handle all numeric args', () => {
    const config = createConfigFromArgs({
      maxIterations: 100,
      maxRuntime: 7200,
      checkpointInterval: 10,
      retryDelay: 5,
      maxTokens: 500000,
      maxCost: 100,
      contextWindow: 100000,
      contextThreshold: 0.9,
      metricsInterval: 20,
      maxPromptSize: 1048576,
    });

    expect(config.maxIterations).toBe(100);
    expect(config.maxRuntime).toBe(7200);
    expect(config.checkpointInterval).toBe(10);
    expect(config.retryDelay).toBe(5);
    expect(config.maxTokens).toBe(500000);
    expect(config.maxCost).toBe(100);
    expect(config.contextWindow).toBe(100000);
    expect(config.contextThreshold).toBe(0.9);
    expect(config.metricsInterval).toBe(20);
    expect(config.maxPromptSize).toBe(1048576);
  });

  it('should handle output format and verbosity', () => {
    const config = createConfigFromArgs({
      outputFormat: 'json',
      outputVerbosity: 'debug',
    });

    expect(config.outputFormat).toBe('json');
    expect(config.outputVerbosity).toBe('debug');
  });

  it('should handle agent args array', () => {
    const config = createConfigFromArgs({
      agentArgs: ['--flag1', '--flag2=value'],
    });

    expect(config.agentArgs).toEqual(['--flag1', '--flag2=value']);
  });

  it('should handle ACP configuration', () => {
    const config = createConfigFromArgs({
      acpAgent: 'my-agent',
      acpPermissionMode: 'auto',
    });

    expect(config.acpAgent).toBe('my-agent');
    expect(config.acpPermissionMode).toBe('auto');
  });

  it('should handle prompt text', () => {
    const config = createConfigFromArgs({
      promptText: 'Do something',
    });

    expect(config.promptText).toBe('Do something');
  });

  it('should handle dry run', () => {
    const config = createConfigFromArgs({
      dryRun: true,
    });

    expect(config.dryRun).toBe(true);
  });

  it('should handle allow unsafe paths', () => {
    const config = createConfigFromArgs({
      allowUnsafePaths: true,
    });

    expect(config.allowUnsafePaths).toBe(true);
  });
});
