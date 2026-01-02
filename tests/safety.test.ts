/**
 * Safety guard and loop detection tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { SafetyGuard } from '../src/safety/index.ts';

describe('SafetyGuard', () => {
  let guard: SafetyGuard;

  beforeEach(() => {
    guard = new SafetyGuard({
      maxIterations: 10,
      maxRuntime: 60,
      maxCost: 5,
    });
  });

  test('should pass initial check', () => {
    const result = guard.check({
      iterations: 1,
      elapsedTime: 0,
      totalCost: 0,
    });

    expect(result.passed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test('should fail when max iterations exceeded', () => {
    const result = guard.check({
      iterations: 11,
      elapsedTime: 0,
      totalCost: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('iteration');
  });

  test('should fail when max runtime exceeded', () => {
    const result = guard.check({
      iterations: 1,
      elapsedTime: 61,
      totalCost: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('runtime');
  });

  test('should fail when max cost exceeded', () => {
    const result = guard.check({
      iterations: 1,
      elapsedTime: 0,
      totalCost: 5.5,
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('cost');
  });

  test('should track successes and failures', () => {
    guard.recordSuccess();
    guard.recordSuccess();
    guard.recordFailure();

    expect(guard.getConsecutiveFailures()).toBe(1);

    guard.recordSuccess();
    expect(guard.getConsecutiveFailures()).toBe(0);
  });
});

describe('Loop Detection', () => {
  let guard: SafetyGuard;

  beforeEach(() => {
    guard = new SafetyGuard({
      maxIterations: 100,
      maxRuntime: 3600,
      maxCost: 100,
      loopThreshold: 0.9,
      maxRecentOutputs: 5,
    });
  });

  test('should not detect loop with different outputs', () => {
    expect(guard.detectLoop('First unique output')).toBe(false);
    expect(guard.detectLoop('Second unique output')).toBe(false);
    expect(guard.detectLoop('Third unique output')).toBe(false);
  });

  test('should detect loop with identical outputs', () => {
    const sameOutput = 'This is the same output repeated multiple times for testing purposes';

    expect(guard.detectLoop(sameOutput)).toBe(false);
    expect(guard.detectLoop(sameOutput)).toBe(true); // Second identical triggers loop
  });

  test('should detect loop with similar outputs', () => {
    expect(guard.detectLoop('Processing task: doing something useful with this long enough string')).toBe(false);
    expect(guard.detectLoop('Processing task: doing something useful with this long enough string!')).toBe(true);
  });

  test('should handle empty output', () => {
    expect(guard.detectLoop('')).toBe(false);
    expect(guard.detectLoop('')).toBe(false); // Empty strings don't count
  });

  test('should clear loop history', () => {
    const output = 'Repeated output for testing';
    guard.detectLoop(output);
    guard.clearLoopHistory();
    expect(guard.detectLoop(output)).toBe(false); // Should not detect after clear
  });
});

describe('SafetyGuard Configuration', () => {
  test('should allow config updates', () => {
    const guard = new SafetyGuard({
      maxIterations: 10,
      maxRuntime: 60,
      maxCost: 5,
    });

    guard.updateConfig({ maxIterations: 20 });

    const config = guard.getConfig();
    expect(config.maxIterations).toBe(20);
  });

  test('should handle high iteration counts with warnings', () => {
    const guard = new SafetyGuard({
      maxIterations: 100,
      maxRuntime: 3600,
      maxCost: 100,
    });

    // High iteration count but should still pass if under limit
    const result = guard.check({
      iterations: 60,
      elapsedTime: 100,
      totalCost: 0,
    });

    expect(result.passed).toBe(true);
  });

  test('should reset counters', () => {
    const guard = new SafetyGuard({
      maxIterations: 10,
      maxRuntime: 60,
      maxCost: 5,
    });

    guard.recordFailure();
    guard.recordFailure();
    expect(guard.getConsecutiveFailures()).toBe(2);

    guard.reset();
    expect(guard.getConsecutiveFailures()).toBe(0);
  });
});
