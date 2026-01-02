/**
 * Test setup for Ralph Orchestrator
 */

import { beforeAll, afterAll, afterEach } from 'bun:test';

// Set up test environment
beforeAll(() => {
  // Disable logging during tests
  process.env.RALPH_LOG_LEVEL = 'silent';
});

afterAll(() => {
  // Cleanup
});

afterEach(() => {
  // Reset between tests
});

/**
 * Create a mock adapter for testing
 */
export function createMockAdapter(name: string = 'mock') {
  return {
    name,
    available: true,
    checkAvailability: async () => true,
    execute: async (prompt: string) => ({
      success: true,
      output: `Mock response for: ${prompt.substring(0, 50)}...`,
      metadata: {},
    }),
    executeWithFile: async (file: string) => ({
      success: true,
      output: `Mock response for file: ${file}`,
      metadata: {},
    }),
    estimateCost: () => 0,
  };
}

/**
 * Create a temporary directory for tests
 */
export async function createTempDir(): Promise<string> {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return mkdtemp(join(tmpdir(), 'ralph-test-'));
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { recursive: true, force: true });
}
