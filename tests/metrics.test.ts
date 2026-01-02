/**
 * Metrics system tests
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { MetricsTracker, CostTracker, IterationStats } from '../src/metrics/index.ts';

describe('MetricsTracker', () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    tracker = new MetricsTracker();
  });

  test('should initialize with zero values', () => {
    const data = tracker.toDict();
    expect(data.iterations).toBe(0);
    expect(data.successfulIterations).toBe(0);
    expect(data.failedIterations).toBe(0);
    expect(data.checkpoints).toBe(0);
  });

  test('should record successful iterations', () => {
    tracker.recordIteration(true);
    tracker.recordIteration(true);

    const data = tracker.toDict();
    expect(data.iterations).toBe(2);
    expect(data.successfulIterations).toBe(2);
    expect(data.failedIterations).toBe(0);
  });

  test('should record failed iterations', () => {
    tracker.recordIteration(false);
    tracker.recordIteration(false);

    const data = tracker.toDict();
    expect(data.iterations).toBe(2);
    expect(data.successfulIterations).toBe(0);
    expect(data.failedIterations).toBe(2);
  });

  test('should record checkpoints', () => {
    tracker.recordCheckpoint();
    tracker.recordCheckpoint();
    tracker.recordCheckpoint();

    const data = tracker.toDict();
    expect(data.checkpoints).toBe(3);
  });

  test('should calculate success rate', () => {
    tracker.recordIteration(true);
    tracker.recordIteration(true);
    tracker.recordIteration(false);

    const rate = tracker.getSuccessRate();
    expect(rate).toBeCloseTo(0.6667, 3);
  });

  test('should handle zero iterations for success rate', () => {
    const rate = tracker.getSuccessRate();
    expect(rate).toBe(0);
  });

  test('should track elapsed time', () => {
    tracker.recordIteration(true);
    const elapsed = tracker.getElapsedSeconds();
    expect(typeof elapsed).toBe('number');
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  test('should record errors', () => {
    const data1 = tracker.toDict();
    expect(data1.errors).toBe(0);

    tracker.recordError();
    tracker.recordError();

    const data2 = tracker.toDict();
    expect(data2.errors).toBe(2);
  });

  test('should record rollbacks', () => {
    const data1 = tracker.toDict();
    expect(data1.rollbacks).toBe(0);

    tracker.recordRollback();

    const data2 = tracker.toDict();
    expect(data2.rollbacks).toBe(1);
  });

  test('should get metrics object', () => {
    tracker.recordIteration(true);
    tracker.recordCheckpoint();

    const metrics = tracker.getMetrics();
    expect(metrics.iterations).toBe(1);
    expect(metrics.checkpoints).toBe(1);
    expect(metrics.startTime).toBeLessThanOrEqual(Date.now());
  });

  test('should convert to JSON', () => {
    tracker.recordIteration(true);

    const json = tracker.toJson();
    expect(typeof json).toBe('string');

    const parsed = JSON.parse(json);
    expect(parsed.iterations).toBe(1);
    expect(parsed.successfulIterations).toBe(1);
  });

  test('should reset metrics', () => {
    tracker.recordIteration(true);
    tracker.recordIteration(false);
    tracker.recordCheckpoint();
    tracker.recordError();
    tracker.recordRollback();

    const data1 = tracker.toDict();
    expect(data1.iterations).toBe(2);

    tracker.reset();

    const data2 = tracker.toDict();
    expect(data2.iterations).toBe(0);
    expect(data2.checkpoints).toBe(0);
    expect(data2.errors).toBe(0);
    expect(data2.rollbacks).toBe(0);
  });

  test('should get elapsed hours', () => {
    const hours = tracker.getElapsedHours();
    expect(typeof hours).toBe('number');
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThan(1); // Should be very small for a just-created tracker
  });

  test('should include elapsedHours in toDict', () => {
    const data = tracker.toDict();
    expect(data).toHaveProperty('elapsedHours');
    expect(typeof data.elapsedHours).toBe('number');
  });
});

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  test('should initialize with zero cost', () => {
    expect(tracker.getTotalCost()).toBe(0);
  });

  test('should add usage and calculate cost', () => {
    tracker.addUsage('claude', 1000, 500);
    expect(tracker.getTotalCost()).toBeGreaterThan(0);
  });

  test('should get summary', () => {
    tracker.addUsage('claude', 1000, 500);

    const summary = tracker.getSummary();
    expect(summary).toHaveProperty('totalCost');
    expect(summary).toHaveProperty('costsByTool');
    expect(summary).toHaveProperty('usageCount');
    expect(summary).toHaveProperty('averageCost');
  });

  test('should estimate cost correctly', () => {
    // Claude pricing is defined in the cost tracker
    const cost = CostTracker.estimateCost('claude', 1000000, 500000);
    expect(cost).toBeGreaterThan(0);
  });

  test('should handle unknown tools', () => {
    tracker.addUsage('unknown-tool', 1000, 500);
    expect(tracker.getTotalCost()).toBeGreaterThanOrEqual(0);
  });

  test('should get cost by tool', () => {
    tracker.addUsage('claude', 1000, 500);
    tracker.addUsage('gemini', 2000, 1000);

    const claudeCost = tracker.getCostByTool('claude');
    const geminiCost = tracker.getCostByTool('gemini');

    expect(claudeCost).toBeGreaterThan(0);
    expect(geminiCost).toBeGreaterThan(0);
  });

  test('should return zero for unknown tool in getCostByTool', () => {
    const cost = tracker.getCostByTool('nonexistent');
    expect(cost).toBe(0);
  });

  test('should get all costs by tool', () => {
    tracker.addUsage('claude', 1000, 500);
    tracker.addUsage('gemini', 2000, 1000);

    const allCosts = tracker.getAllCostsByTool();
    expect(allCosts).toHaveProperty('claude');
    expect(allCosts).toHaveProperty('gemini');
    expect(allCosts.claude).toBeGreaterThan(0);
  });

  test('should get usage count', () => {
    expect(tracker.getUsageCount()).toBe(0);

    tracker.addUsage('claude', 1000, 500);
    expect(tracker.getUsageCount()).toBe(1);

    tracker.addUsage('claude', 1000, 500);
    expect(tracker.getUsageCount()).toBe(2);
  });

  test('should get average cost', () => {
    expect(tracker.getAverageCost()).toBe(0);

    tracker.addUsage('claude', 1000, 500);
    tracker.addUsage('claude', 1000, 500);

    const avg = tracker.getAverageCost();
    expect(avg).toBeGreaterThan(0);
  });

  test('should get usage history', () => {
    tracker.addUsage('claude', 1000, 500);
    tracker.addUsage('gemini', 2000, 1000);

    const history = tracker.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].tool).toBe('claude');
    expect(history[1].tool).toBe('gemini');
  });

  test('should get recent usage', () => {
    tracker.addUsage('claude', 1000, 500);
    tracker.addUsage('gemini', 2000, 1000);
    tracker.addUsage('qchat', 3000, 1500);

    const recent = tracker.getRecentUsage(2);
    expect(recent.length).toBe(2);
    expect(recent[0].tool).toBe('gemini');
    expect(recent[1].tool).toBe('qchat');
  });

  test('should convert to JSON', () => {
    tracker.addUsage('claude', 1000, 500);

    const json = tracker.toJson();
    expect(typeof json).toBe('string');

    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('totalCost');
    expect(parsed).toHaveProperty('costsByTool');
  });

  test('should reset tracker', () => {
    tracker.addUsage('claude', 1000, 500);
    tracker.addUsage('gemini', 2000, 1000);

    expect(tracker.getTotalCost()).toBeGreaterThan(0);
    expect(tracker.getUsageCount()).toBe(2);

    tracker.reset();

    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.getUsageCount()).toBe(0);
    expect(tracker.getHistory().length).toBe(0);
  });

  test('should estimate cost for different tools', () => {
    const claudeCost = CostTracker.estimateCost('claude', 1000, 500);
    const geminiCost = CostTracker.estimateCost('gemini', 1000, 500);
    const qchatCost = CostTracker.estimateCost('qchat', 1000, 500);

    expect(claudeCost).toBeGreaterThan(geminiCost);
    expect(qchatCost).toBe(0);
  });

  test('should use qchat costs for unknown tools in estimateCost', () => {
    const cost = CostTracker.estimateCost('unknown-tool', 1000, 500);
    expect(cost).toBe(0);
  });
});

describe('IterationStats', () => {
  let stats: IterationStats;

  beforeEach(() => {
    stats = new IterationStats(10, 100);
  });

  test('should initialize with zero values', () => {
    const summary = stats.toSummary();
    expect(summary.total).toBe(0);
    expect(summary.successes).toBe(0);
    expect(summary.failures).toBe(0);
  });

  test('should record iterations', () => {
    stats.recordStart(1);
    stats.recordIteration({
      iteration: 1,
      duration: 5,
      success: true,
      error: '',
      triggerReason: 'initial',
      outputPreview: 'test output',
      tokensUsed: 100,
      cost: 0.001,
    });

    const summary = stats.toSummary();
    expect(summary.total).toBe(1);
    expect(summary.successes).toBe(1);
    expect(summary.failures).toBe(0);
  });

  test('should track failures', () => {
    stats.recordStart(1);
    stats.recordIteration({
      iteration: 1,
      duration: 5,
      success: false,
      error: 'Test error',
      triggerReason: 'recovery',
    });

    const summary = stats.toSummary();
    expect(summary.total).toBe(1);
    expect(summary.successes).toBe(0);
    expect(summary.failures).toBe(1);
  });

  test('should calculate success rate', () => {
    stats.recordStart(1);
    stats.recordIteration({ iteration: 1, duration: 1, success: true, error: '', triggerReason: 'initial' });
    stats.recordStart(2);
    stats.recordIteration({ iteration: 2, duration: 1, success: true, error: '', triggerReason: 'previous_success' });
    stats.recordStart(3);
    stats.recordIteration({ iteration: 3, duration: 1, success: false, error: 'err', triggerReason: 'recovery' });

    const summary = stats.toSummary();
    expect(summary.successRate).toBeCloseTo(66.67, 1);
  });

  test('should limit stored iterations', () => {
    const smallStats = new IterationStats(3, 100);

    for (let i = 1; i <= 5; i++) {
      smallStats.recordStart(i);
      smallStats.recordIteration({ iteration: i, duration: 1, success: true, error: '', triggerReason: 'initial' });
    }

    const summary = smallStats.toSummary();
    expect(summary.total).toBe(5); // Total count is still 5
  });

  test('should track current iteration', () => {
    expect(stats.currentIteration).toBe(0);

    stats.recordStart(1);
    expect(stats.currentIteration).toBe(1);

    stats.recordStart(5);
    expect(stats.currentIteration).toBe(5);
  });

  test('should record success directly', () => {
    stats.recordSuccess(1);
    stats.recordSuccess(2);

    expect(stats.successes).toBe(2);
    expect(stats.total).toBe(2);
  });

  test('should record failure directly', () => {
    stats.recordFailure(1);
    stats.recordFailure(2);

    expect(stats.failures).toBe(2);
    expect(stats.total).toBe(2);
  });

  test('should get runtime in seconds', () => {
    const seconds = stats.getRuntimeSeconds();
    expect(typeof seconds).toBe('number');
    expect(seconds).toBeGreaterThanOrEqual(0);
  });

  test('should get recent iterations', () => {
    for (let i = 1; i <= 5; i++) {
      stats.recordIteration({
        iteration: i,
        duration: i,
        success: true,
        error: '',
      });
    }

    const recent2 = stats.getRecentIterations(2);
    expect(recent2.length).toBe(2);
    expect(recent2[0].iteration).toBe(4);
    expect(recent2[1].iteration).toBe(5);

    const recentAll = stats.getRecentIterations(10);
    expect(recentAll.length).toBe(5);
  });

  test('should get average duration', () => {
    stats.recordIteration({ iteration: 1, duration: 10, success: true, error: '' });
    stats.recordIteration({ iteration: 2, duration: 20, success: true, error: '' });
    stats.recordIteration({ iteration: 3, duration: 30, success: true, error: '' });

    const avg = stats.getAverageDuration();
    expect(avg).toBe(20);
  });

  test('should return 0 average duration for no iterations', () => {
    const avg = stats.getAverageDuration();
    expect(avg).toBe(0);
  });

  test('should get error messages from failed iterations', () => {
    stats.recordIteration({ iteration: 1, duration: 1, success: true, error: '' });
    stats.recordIteration({ iteration: 2, duration: 1, success: false, error: 'Error 1' });
    stats.recordIteration({ iteration: 3, duration: 1, success: false, error: 'Error 2' });
    stats.recordIteration({ iteration: 4, duration: 1, success: true, error: '' });

    const errors = stats.getErrorMessages();
    expect(errors).toEqual(['Error 1', 'Error 2']);
  });

  test('should get last error', () => {
    expect(stats.getLastError()).toBeNull();

    stats.recordIteration({ iteration: 1, duration: 1, success: false, error: 'First error' });
    expect(stats.getLastError()).toBe('First error');

    stats.recordIteration({ iteration: 2, duration: 1, success: true, error: '' });
    expect(stats.getLastError()).toBe('First error');

    stats.recordIteration({ iteration: 3, duration: 1, success: false, error: 'Last error' });
    expect(stats.getLastError()).toBe('Last error');
  });

  test('should convert to dict with iterations', () => {
    stats.recordIteration({ iteration: 1, duration: 5, success: true, error: '' });

    const dict = stats.toDict();
    expect(dict).toHaveProperty('total');
    expect(dict).toHaveProperty('iterations');
    expect(dict).toHaveProperty('averageDuration');
    expect(Array.isArray(dict.iterations)).toBe(true);
  });

  test('should convert to JSON string', () => {
    stats.recordIteration({ iteration: 1, duration: 5, success: true, error: '' });

    const json = stats.toJson();
    expect(typeof json).toBe('string');

    const parsed = JSON.parse(json);
    expect(parsed.total).toBe(1);
  });

  test('should reset all values', () => {
    stats.recordIteration({ iteration: 1, duration: 5, success: true, error: '' });
    stats.recordIteration({ iteration: 2, duration: 5, success: false, error: 'err' });

    expect(stats.total).toBe(2);
    expect(stats.successes).toBe(1);

    stats.reset();

    expect(stats.total).toBe(0);
    expect(stats.successes).toBe(0);
    expect(stats.failures).toBe(0);
    expect(stats.currentIteration).toBe(0);
    expect(stats.iterations.length).toBe(0);
  });

  test('should truncate long output preview', () => {
    const longOutput = 'x'.repeat(200);
    stats.recordIteration({
      iteration: 1,
      duration: 1,
      success: true,
      error: '',
      outputPreview: longOutput,
    });

    expect(stats.iterations[0].outputPreview.length).toBeLessThan(200);
    expect(stats.iterations[0].outputPreview.endsWith('...')).toBe(true);
  });

  test('should format runtime correctly', () => {
    const runtime = stats.getRuntime();
    expect(typeof runtime).toBe('string');
    expect(runtime).toMatch(/^\d+s$|^\d+m \d+s$|^\d+h \d+m \d+s$/);
  });
});
