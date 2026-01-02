# Loop Detection

## Overview

Ralph Orchestrator includes automatic loop detection to prevent agents from getting stuck in repetitive cycles. This feature uses fuzzy string matching to compare recent agent outputs and detect when an agent is producing similar responses repeatedly.

## How It Works

The `SafetyGuard` class maintains a sliding window of the last 5 agent outputs. After each successful iteration, the current output is compared against this history using [fuzzball](https://github.com/nol13/fuzzball.js), a fast fuzzy string matching library for JavaScript/TypeScript.

### Detection Algorithm

1. After each successful iteration, the agent's output is captured
2. The output is compared against the last 5 stored outputs
3. If any comparison exceeds the 90% similarity threshold, a loop is detected
4. The current output is added to the history (oldest removed if at capacity)
5. When a loop is detected, the orchestrator logs a warning and exits

#### Sliding Window Visualization

```
                                         Sliding Window (maxRecentOutputs=5)

+------------+     +----------+     +----------+     +----------+     +----------+     +----------+  evicted   +---+
| New Output | --> | Output 5 | --> | Output 4 | --> | Output 3 | --> | Output 2 | --> | Output 1 | ---------> | X |
+------------+     +----------+     +----------+     +----------+     +----------+     +----------+            +---+
```

<details>
<summary>graph-easy source</summary>

```
graph { label: "Sliding Window (maxRecentOutputs=5)"; flow: east; }
[ New Output ] -> [ Output 5 ] -> [ Output 4 ] -> [ Output 3 ] -> [ Output 2 ] -> [ Output 1 ]
[ Output 1 ] -- evicted --> [ X ] { shape: rounded; }
```

</details>

### Similarity Threshold

The default threshold is **90% similarity** (0.9 ratio). This was chosen based on industry best practices:

- **0.95**: Too strict - only catches nearly identical outputs
- **0.90**: Balanced - catches repetitive patterns while allowing variation (recommended)
- **0.85**: Loose - higher false positive rate

#### Decision Flow

```
              Loop Detection Decision

                         +--------------------+
                         |   Current Output   |
                         +--------------------+
                           |
                           |
                           v
                         +--------------------+
                         | Compare to History | <-+
                         +--------------------+   |
                           |                      |
                           |                      |
                           v                      |
+===============+  yes   +--------------------+   |
|| LOOP DETECTED|| <---- |   ratio >= 90%?   |   | yes
+===============+        +--------------------+   |
                           |                      |
                           | no                   |
                           v                      |
                         +--------------------+   |
                         |   More outputs?    | --+
                         +--------------------+
                           |
                           | no
                           v
                         +--------------------+
                         |   Add to History   |
                         +--------------------+
                           |
                           |
                           v
                         +--------------------+
                         |      Continue      |
                         +--------------------+
```

<details>
<summary>graph-easy source</summary>

```
graph { label: "Loop Detection Decision"; flow: south; }
[ Current Output ] { shape: rounded; } -> [ Compare to History ]
[ Compare to History ] -> [ ratio >= 90%? ]
[ ratio >= 90%? ] -- yes --> [ LOOP DETECTED ] { border: double; }
[ ratio >= 90%? ] -- no --> [ More outputs? ]
[ More outputs? ] -- yes --> [ Compare to History ]
[ More outputs? ] -- no --> [ Add to History ]
[ Add to History ] -> [ Continue ] { shape: rounded; }
```

</details>

## TypeScript Implementation

```typescript
// Example of how loop detection works in the TypeScript implementation

import { similarityRatio } from './utils/fuzzy-match.ts';

// Agent outputs from iterations 1-3
const outputs = [
  "Let me check the database for user information...",
  "I'll query the database to find the user data...",
  "Checking the database for user information...",  // Similar to #1
];

// Similarity check
const ratio = similarityRatio(outputs[0], outputs[2]);
// Result: ~0.91 (91% similar) - LOOP DETECTED
```

### SafetyGuard Implementation

The `SafetyGuard` class in `src/safety/guard.ts` handles loop detection:

```typescript
export class SafetyGuard {
  private recentOutputs: string[] = [];
  private loopThreshold: number;
  private maxRecentOutputs: number;

  constructor(options: SafetyGuardOptions = {}) {
    this.loopThreshold = options.loopThreshold ?? 0.9;
    this.maxRecentOutputs = options.maxRecentOutputs ?? 5;
  }

  detectLoop(currentOutput: string): boolean {
    if (!currentOutput) {
      return false;
    }

    try {
      for (const prevOutput of this.recentOutputs) {
        const ratio = similarityRatio(currentOutput, prevOutput);
        if (ratio >= this.loopThreshold) {
          console.warn(
            `Loop detected: ${(ratio * 100).toFixed(1)}% similarity to previous output`
          );
          return true;
        }
      }

      // Add to recent outputs
      this.recentOutputs.push(currentOutput);
      if (this.recentOutputs.length > this.maxRecentOutputs) {
        this.recentOutputs.shift();
      }

      return false;
    } catch (error) {
      console.warn(`Error in loop detection: ${error}`);
      return false;
    }
  }

  clearLoopHistory(): void {
    this.recentOutputs = [];
  }
}
```

### Fuzzy Matching Utilities

The `src/utils/fuzzy-match.ts` module provides fuzzy string matching:

```typescript
import * as fuzzball from 'fuzzball';

/**
 * Calculate similarity ratio between two strings
 * @param a First string
 * @param b Second string
 * @returns Similarity ratio (0-1)
 */
export function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Use fuzzball's ratio function which returns 0-100
  const ratio = fuzzball.ratio(a, b);
  return ratio / 100;
}

/**
 * Check if two strings are similar above a threshold
 */
export function isSimilar(a: string, b: string, threshold: number = 0.9): boolean {
  return similarityRatio(a, b) >= threshold;
}

/**
 * Partial ratio comparison (better for substring matching)
 */
export function partialRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const ratio = fuzzball.partial_ratio(a, b);
  return ratio / 100;
}

/**
 * Token sort ratio (ignores word order)
 */
export function tokenSortRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const ratio = fuzzball.token_sort_ratio(a, b);
  return ratio / 100;
}
```

## Configuration

Loop detection uses configurable parameters defined in `SafetyGuardOptions`:

| Parameter        | Default | Description                          |
| ---------------- | ------- | ------------------------------------ |
| `loopThreshold` | 0.9     | Similarity threshold (90%)           |
| `maxRecentOutputs` | 5     | Number of outputs to compare against |

These can be configured when creating the `SafetyGuard`:

```typescript
const safetyGuard = new SafetyGuard({
  loopThreshold: 0.85,      // More sensitive detection
  maxRecentOutputs: 10,     // Keep more history
});
```

## Interaction with Other Safety Features

Loop detection works alongside other safety mechanisms:

1. **Iteration Limit**: Maximum iterations (default: 100)
2. **Runtime Limit**: Maximum time (default: 4 hours)
3. **Cost Limit**: Maximum cost (default: $10)
4. **Consecutive Failure Limit**: Max failures in a row (default: 5)
5. **Loop Detection**: Similarity-based output comparison

The orchestrator exits when **any** of these conditions are met.

### Integration Architecture

The following diagram shows how loop detection integrates with the main orchestration loop:

```
            SafetyGuard in Orchestration Loop

                               +---------------------+
  +--------------------------> |   Start Iteration   | <-+
  |                            +---------------------+   |
  |                              |                       |
  |                              |                       |
  |                              v                       |
  |                            +---------------------+   |
  |                            | SafetyGuard.check() |   |
  |                            +---------------------+   |
  |                              |                       |
  |                              |                       |
  |                              v                       |
  |  +================+  no    +---------------------+   |
  |  ||  STOP: Limit ||<------ |     Limits OK?      |   |
  |  +================+        +---------------------+   |
  |                              |                       |
  |                              | yes                   |
  |                              v                       |
  |                            +---------------------+   |
  |                            |  Check Completion   |   |
  |                            +---------------------+   |
  |                              |                       |
  |                              |                       |
  |                              v                       |
  |  +================+  yes   +---------------------+   |
  |  ||   STOP: Done ||<------ |   TASK_COMPLETE?    |   | no
  |  +================+        +---------------------+   |
  |                              |                       |
  +----+                         | no                    |
       |                         v                       |
       |                       +---------------------+   |
       |                       |    Execute Agent    |   |
       |                       +---------------------+   |
       |                         |                       |
       |                         |                       |
       |                         v                       |
     +----------------+  no    +---------------------+   |
     | Handle Failure |<------ |      Success?       |   |
     +----------------+        +---------------------+   |
                                 |                       |
                                 | yes                   |
                                 v                       |
                               +---------------------+   |
                               |    detectLoop()     |   |
                               +---------------------+   |
                                 |                       |
                                 |                       |
                                 v                       |
                               +---------------------+   |
                               |     Loop Found?     | --+
                               +---------------------+
                                 |
                                 | yes
                                 v
                               +=====================+
                               ||     STOP: Loop    ||
                               +=====================+
```

<details>
<summary>graph-easy source</summary>

```
graph { label: "SafetyGuard in Orchestration Loop"; flow: south; }
[ Start Iteration ] { shape: rounded; } -> [ SafetyGuard.check() ]
[ SafetyGuard.check() ] -> [ Limits OK? ]
[ Limits OK? ] -- no --> [ STOP: Limit ] { border: double; }
[ Limits OK? ] -- yes --> [ Check Completion ]
[ Check Completion ] -> [ TASK_COMPLETE? ]
[ TASK_COMPLETE? ] -- yes --> [ STOP: Done ] { border: double; }
[ TASK_COMPLETE? ] -- no --> [ Execute Agent ]
[ Execute Agent ] -> [ Success? ]
[ Success? ] -- no --> [ Handle Failure ]
[ Handle Failure ] -> [ Start Iteration ]
[ Success? ] -- yes --> [ detectLoop() ]
[ detectLoop() ] -> [ Loop Found? ]
[ Loop Found? ] -- yes --> [ STOP: Loop ] { border: double; }
[ Loop Found? ] -- no --> [ Start Iteration ]
```

</details>

## When Loop Detection Triggers

Loop detection helps in these scenarios:

- **Agent stuck on same task**: Repeatedly attempting the same action
- **Oscillation**: Agent switching between two similar approaches
- **API errors**: Consistent retry messages
- **Placeholder responses**: Agent returning similar "working on it" messages

## Logging

When loop detection triggers, you'll see:

```
WARNING - Loop detected: 92.3% similarity to previous output
WARNING - Breaking loop due to repetitive agent outputs
```

## Resetting Loop Detection

The loop detection history is automatically cleared when:

- A new orchestration session starts
- `SafetyGuard.reset()` is called
- `SafetyGuard.clearLoopHistory()` is called
- The orchestrator completes (success or failure)

## Dependencies

Loop detection requires the `fuzzball` package (already included in `package.json`):

```bash
bun add fuzzball
```

If fuzzball is not available, loop detection will gracefully return `false` with a warning log message.

## Best Practices

1. **Monitor for loops**: Watch for loop detection warnings in logs
2. **Improve prompts**: If loops occur frequently, refine your task description
3. **Check task completeness**: Ensure tasks have clear completion criteria
4. **Use completion markers**: Add `- [x] TASK_COMPLETE` when done

## Testing Loop Detection

```typescript
import { describe, it, expect } from 'bun:test';
import { SafetyGuard } from '../src/safety/guard.ts';

describe('Loop Detection', () => {
  it('should detect similar outputs', () => {
    const guard = new SafetyGuard({ loopThreshold: 0.9 });

    // First output - no loop
    expect(guard.detectLoop('Processing the user data...')).toBe(false);

    // Second output - different enough
    expect(guard.detectLoop('Creating the database schema...')).toBe(false);

    // Third output - too similar to first
    expect(guard.detectLoop('Processing user data now...')).toBe(true);
  });

  it('should respect custom threshold', () => {
    const guard = new SafetyGuard({ loopThreshold: 0.95 });

    guard.detectLoop('Hello world');
    // Slightly different - would trigger at 0.9 but not at 0.95
    expect(guard.detectLoop('Hello world!')).toBe(false);
  });

  it('should clear history on reset', () => {
    const guard = new SafetyGuard();

    guard.detectLoop('Same message');
    guard.clearLoopHistory();
    expect(guard.detectLoop('Same message')).toBe(false);
  });
});
```

## Related Topics

- [Safety Mechanisms](../guide/overview.md#safety-features)
- [Troubleshooting](../troubleshooting.md)
- [Architecture](./architecture.md)
