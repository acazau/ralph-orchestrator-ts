/**
 * Context manager tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ContextManager } from '../src/context/index.ts';
import { mkdir, rm } from 'node:fs/promises';

describe('ContextManager', () => {
  const testDir = '.agent-test';
  const testPromptFile = `${testDir}/TEST_PROMPT.md`;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should initialize with prompt text', async () => {
    const manager = new ContextManager({
      promptText: 'Test prompt text',
    });

    const prompt = await manager.getPrompt();
    expect(prompt).toContain('Test prompt text');
  });

  test('should load prompt from file', async () => {
    await Bun.write(testPromptFile, '# Test Prompt\n\nThis is a test prompt.');

    const manager = new ContextManager({
      promptFile: testPromptFile,
    });

    const prompt = await manager.getPrompt();
    expect(prompt).toContain('Test Prompt');
    expect(prompt).toContain('test prompt');
  });

  test('should prefer prompt text over file', async () => {
    await Bun.write(testPromptFile, 'File content');

    const manager = new ContextManager({
      promptFile: testPromptFile,
      promptText: 'Direct text content',
    });

    const prompt = await manager.getPrompt();
    expect(prompt).toContain('Direct text content');
    expect(prompt).not.toContain('File content');
  });

  test('should update context', async () => {
    const manager = new ContextManager({
      promptText: 'Initial prompt',
    });

    manager.updateContext('New information from agent response');

    const context = manager.getContext();
    expect(context).toContain('New information');
  });

  test('should add error feedback', async () => {
    const manager = new ContextManager({
      promptText: 'Initial prompt',
    });

    manager.addErrorFeedback('Something went wrong');

    const errors = manager.getErrorHistory();
    expect(errors).toContain('Something went wrong');
  });

  test('should detect completion marker TASK_COMPLETE', async () => {
    await Bun.write(testPromptFile, '# Task\n\nComplete the task.\n\nTASK_COMPLETE');

    const manager = new ContextManager({
      promptFile: testPromptFile,
    });

    const hasMarker = await manager.hasCompletionMarker();
    expect(hasMarker).toBe(true);
  });

  test('should not detect completion marker when absent', async () => {
    await Bun.write(testPromptFile, '# Task\n\nComplete the task.');

    const manager = new ContextManager({
      promptFile: testPromptFile,
    });

    const hasMarker = await manager.hasCompletionMarker();
    expect(hasMarker).toBe(false);
  });

  test('should throw when missing prompt file', async () => {
    const manager = new ContextManager({
      promptFile: 'nonexistent/file.md',
    });

    expect(manager.getPrompt()).rejects.toThrow();
  });

  test('should throw when no prompt specified', async () => {
    const manager = new ContextManager({});

    expect(manager.getPrompt()).rejects.toThrow('No prompt text or file specified');
  });

  test('should reset context', async () => {
    const manager = new ContextManager({
      promptText: 'Initial prompt',
    });

    manager.updateContext('Some context');
    manager.addErrorFeedback('Some error');
    manager.reset();

    expect(manager.getContext()).toBe('');
    expect(manager.getErrorHistory()).toHaveLength(0);
  });

  test('should truncate context when too long', async () => {
    const manager = new ContextManager({
      promptText: 'Prompt',
      maxContextSize: 100,
    });

    const longContext = 'x'.repeat(200);
    manager.updateContext(longContext);

    const context = manager.getContext();
    expect(context.length).toBeLessThan(200);
    expect(context).toContain('truncated');
  });

  test('should get context stats', async () => {
    const manager = new ContextManager({
      promptText: 'Test prompt',
    });

    manager.updateContext('Some context');
    manager.addErrorFeedback('Error 1');

    const stats = await manager.getStats();
    expect(stats.promptLength).toBe(11);
    expect(stats.contextLength).toBeGreaterThan(0);
    expect(stats.errorCount).toBe(1);
  });
});

describe('ContextManager - Completion Detection', () => {
  const testDir = '.agent-test';
  const testPromptFile = `${testDir}/TEST_PROMPT.md`;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should detect [x] All tasks completed marker', async () => {
    await Bun.write(testPromptFile, '# Task\n\n[x] All tasks completed\n\nMore content');

    const manager = new ContextManager({
      promptFile: testPromptFile,
    });

    const hasMarker = await manager.hasCompletionMarker();
    expect(hasMarker).toBe(true);
  });

  test('should detect ## COMPLETED marker', async () => {
    await Bun.write(testPromptFile, '# Task\n\n## COMPLETED\n\nTask is done');

    const manager = new ContextManager({
      promptFile: testPromptFile,
    });

    const hasMarker = await manager.hasCompletionMarker();
    expect(hasMarker).toBe(true);
  });

  test('should detect All items have been completed marker', async () => {
    await Bun.write(testPromptFile, '# Task\n\nAll items have been completed successfully');

    const manager = new ContextManager({
      promptFile: testPromptFile,
    });

    const hasMarker = await manager.hasCompletionMarker();
    expect(hasMarker).toBe(true);
  });

  test('should handle hasCompletionMarker with no prompt gracefully', async () => {
    const manager = new ContextManager({});

    // Should return false without throwing
    const hasMarker = await manager.hasCompletionMarker();
    expect(hasMarker).toBe(false);
  });
});

describe('ContextManager - Setters', () => {
  test('should set prompt text', async () => {
    const manager = new ContextManager({});

    manager.setPromptText('New prompt text');
    const prompt = await manager.getPrompt();
    expect(prompt).toBe('New prompt text');
  });

  test('should set prompt file', async () => {
    const testDir = '.agent-test-setters';
    await mkdir(testDir, { recursive: true });
    const testFile = `${testDir}/prompt.md`;
    await Bun.write(testFile, '# File Prompt');

    try {
      const manager = new ContextManager({
        promptText: 'Initial text',
      });

      manager.setPromptFile(testFile);
      const prompt = await manager.getPrompt();
      expect(prompt).toBe('# File Prompt');
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});

describe('ContextManager - Error Management', () => {
  test('should get last error', () => {
    const manager = new ContextManager({ promptText: 'Test' });

    expect(manager.getLastError()).toBeNull();

    manager.addErrorFeedback('Error 1');
    expect(manager.getLastError()).toBe('Error 1');

    manager.addErrorFeedback('Error 2');
    expect(manager.getLastError()).toBe('Error 2');
  });

  test('should clear errors', () => {
    const manager = new ContextManager({ promptText: 'Test' });

    manager.addErrorFeedback('Error 1');
    manager.addErrorFeedback('Error 2');
    expect(manager.getErrorHistory().length).toBe(2);

    manager.clearErrors();
    expect(manager.getErrorHistory().length).toBe(0);
    expect(manager.getLastError()).toBeNull();
  });

  test('should limit error history to 10 items', () => {
    const manager = new ContextManager({ promptText: 'Test' });

    for (let i = 0; i < 15; i++) {
      manager.addErrorFeedback(`Error ${i}`);
    }

    expect(manager.getErrorHistory().length).toBe(10);
    expect(manager.getErrorHistory()[0]).toBe('Error 5');
    expect(manager.getLastError()).toBe('Error 14');
  });
});

describe('ContextManager - File Operations', () => {
  const testDir = '.agent-test-files';

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should write prompt to file', async () => {
    const promptFile = `${testDir}/output.md`;
    await Bun.write(promptFile, 'Initial content');

    const manager = new ContextManager({
      promptFile,
    });

    await manager.writePrompt('# Updated Content\n\nNew prompt text');

    const file = Bun.file(promptFile);
    const content = await file.text();
    expect(content).toBe('# Updated Content\n\nNew prompt text');
  });

  test('should throw when writing prompt without file', async () => {
    const manager = new ContextManager({
      promptText: 'Direct text',
    });

    await expect(manager.writePrompt('New content')).rejects.toThrow(
      'No prompt file specified'
    );
  });
});

describe('ContextManager - Cache Operations', () => {
  const testDir = '.agent-test-cache';
  const cacheDir = `${testDir}/cache`;

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('should save context to cache', async () => {
    const manager = new ContextManager({
      promptText: 'Test prompt',
      cacheDir,
    });

    manager.updateContext('Test context');
    manager.addErrorFeedback('Test error');

    await manager.saveToCache('test-key');

    const file = Bun.file(`${cacheDir}/test-key.json`);
    expect(await file.exists()).toBe(true);

    const data = await file.json();
    expect(data.context).toBe('Test context');
    expect(data.errorHistory).toContain('Test error');
  });

  test('should load context from cache', async () => {
    await mkdir(cacheDir, { recursive: true });
    const cacheData = {
      context: 'Cached context',
      errorHistory: ['Cached error'],
      lastUpdated: new Date().toISOString(),
      savedAt: new Date().toISOString(),
    };
    await Bun.write(`${cacheDir}/test-key.json`, JSON.stringify(cacheData));

    const manager = new ContextManager({
      promptText: 'Test prompt',
      cacheDir,
    });

    const loaded = await manager.loadFromCache('test-key');
    expect(loaded).toBe(true);
    expect(manager.getContext()).toBe('Cached context');
    expect(manager.getErrorHistory()).toContain('Cached error');
  });

  test('should return false when cache file not found', async () => {
    const manager = new ContextManager({
      promptText: 'Test prompt',
      cacheDir,
    });

    const loaded = await manager.loadFromCache('nonexistent');
    expect(loaded).toBe(false);
  });

  test('should handle invalid cache file gracefully', async () => {
    await mkdir(cacheDir, { recursive: true });
    await Bun.write(`${cacheDir}/invalid.json`, 'not valid json');

    const manager = new ContextManager({
      promptText: 'Test prompt',
      cacheDir,
    });

    const loaded = await manager.loadFromCache('invalid');
    expect(loaded).toBe(false);
  });

  test('should ensure cache directory exists', async () => {
    const newCacheDir = `${testDir}/new-cache`;
    const manager = new ContextManager({
      promptText: 'Test',
      cacheDir: newCacheDir,
    });

    await manager.ensureCacheDir();

    const { stat } = await import('node:fs/promises');
    const stats = await stat(newCacheDir);
    expect(stats.isDirectory()).toBe(true);
  });

  test('should roundtrip save and load cache', async () => {
    const manager1 = new ContextManager({
      promptText: 'Test prompt',
      cacheDir,
    });

    manager1.updateContext('My context data');
    manager1.addErrorFeedback('Error 1');
    manager1.addErrorFeedback('Error 2');

    await manager1.saveToCache('roundtrip');

    const manager2 = new ContextManager({
      promptText: 'Different prompt',
      cacheDir,
    });

    const loaded = await manager2.loadFromCache('roundtrip');
    expect(loaded).toBe(true);
    expect(manager2.getContext()).toBe('My context data');
    expect(manager2.getErrorHistory()).toEqual(['Error 1', 'Error 2']);
  });
});
