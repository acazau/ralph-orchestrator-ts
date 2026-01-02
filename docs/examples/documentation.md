# Documentation Writing Examples

## Overview

This guide provides examples of using Ralph Orchestrator for documentation tasks.

## Example 1: API Documentation Generation

### Prompt
```typescript
const prompt = `
Generate comprehensive API documentation for the following TypeScript class:

class DataProcessor {
  processBatch(data: Record<string, unknown>[], batchSize?: number): Record<string, unknown>[];

  validateData(data: Record<string, unknown>): boolean;
}
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated Documentation
```markdown
## DataProcessor API Reference

### Class: DataProcessor

A utility class for processing and validating data in batch operations.

#### Methods

##### `processBatch(data: Record<string, unknown>[], batchSize?: number): Record<string, unknown>[]`

Process a list of objects in configurable batch sizes.

**Parameters:**
- `data` (Record<string, unknown>[]): The input data to process
- `batchSize` (number, optional): Number of items to process per batch. Defaults to 100.

**Returns:**
- Record<string, unknown>[]: Processed data maintaining the same structure

**Example:**
```typescript
const processor = new DataProcessor();
const result = processor.processBatch([{ id: 1 }, { id: 2 }], 50);
```

##### `validateData(data: Record<string, unknown>): boolean`

Validate the structure and content of a data object.

**Parameters:**
- `data` (Record<string, unknown>): The data object to validate

**Returns:**
- boolean: True if data is valid, False otherwise
```

## Example 2: README Generation

### Prompt
```typescript
const prompt = `
Create a README.md for a TypeScript package called 'quicksort-plus' that implements
an optimized quicksort algorithm with the following features:
- Hybrid approach with insertion sort for small arrays
- Three-way partitioning for duplicate elements
- Parallel processing support
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated README
```markdown
# QuickSort Plus

An optimized implementation of the quicksort algorithm with modern enhancements.

## Features

- **Hybrid Sorting**: Automatically switches to insertion sort for small arrays (< 10 elements)
- **Three-Way Partitioning**: Efficiently handles arrays with many duplicate elements
- **Parallel Processing**: Leverages multiple cores for large datasets
- **Type Support**: Works with any comparable TypeScript types

## Installation

```bash
bun add quicksort-plus
```

## Quick Start

```typescript
import { quicksort } from "quicksort-plus";

// Basic usage
const data = [3, 1, 4, 1, 5, 9, 2, 6];
const sortedData = quicksort(data);

// With parallel processing
const largeData = Array.from({ length: 1000000 }, (_, i) => 1000000 - i);
const sortedLargeData = quicksort(largeData, { parallel: true });
```

## Performance

| Array Size | Standard QuickSort | QuickSort Plus | Improvement |
|------------|-------------------|----------------|-------------|
| 100        | 0.012ms          | 0.008ms        | 33%         |
| 10,000     | 1.8ms            | 1.2ms          | 33%         |
| 1,000,000  | 248ms            | 142ms          | 43%         |

## License

MIT License - See LICENSE file for details
```

## Example 3: Code Comments Generation

### Prompt
```typescript
const prompt = `
Add comprehensive JSDoc comments and inline comments to this function:

function mergeSortedArrays<T>(arr1: T[], arr2: T[]): T[] {
  const result: T[] = [];
  let i = 0;
  let j = 0;

  while (i < arr1.length && j < arr2.length) {
    if (arr1[i] <= arr2[j]) {
      result.push(arr1[i]);
      i += 1;
    } else {
      result.push(arr2[j]);
      j += 1;
    }
  }

  result.push(...arr1.slice(i));
  result.push(...arr2.slice(j));
  return result;
}
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Result with Documentation
```typescript
/**
 * Merge two sorted arrays into a single sorted array.
 *
 * This function implements the merge step of merge sort, combining
 * two pre-sorted arrays into one sorted array in O(n+m) time.
 *
 * @template T - The type of elements in the arrays (must be comparable)
 * @param arr1 - First sorted array
 * @param arr2 - Second sorted array
 * @returns A new sorted array containing all elements from both inputs
 *
 * @example
 * ```typescript
 * mergeSortedArrays([1, 3, 5], [2, 4, 6]);
 * // Returns: [1, 2, 3, 4, 5, 6]
 *
 * mergeSortedArrays([1, 2], [3, 4, 5]);
 * // Returns: [1, 2, 3, 4, 5]
 * ```
 *
 * @complexity
 * - Time: O(n + m) where n and m are the lengths of the arrays
 * - Space: O(n + m) for the result array
 */
function mergeSortedArrays<T>(arr1: T[], arr2: T[]): T[] {
  const result: T[] = [];
  let i = 0; // Pointer for first array
  let j = 0; // Pointer for second array

  // Compare elements from both arrays and add the smaller one
  while (i < arr1.length && j < arr2.length) {
    if (arr1[i] <= arr2[j]) {
      result.push(arr1[i]);
      i += 1; // Move pointer in first array
    } else {
      result.push(arr2[j]);
      j += 1; // Move pointer in second array
    }
  }

  // Add remaining elements from arr1 (if any)
  result.push(...arr1.slice(i));

  // Add remaining elements from arr2 (if any)
  result.push(...arr2.slice(j));

  return result;
}
```

## Example 4: Technical Specification

### Prompt
```typescript
const prompt = `
Write a technical specification document for a rate limiting system that:
- Supports multiple algorithms (token bucket, sliding window)
- Has Redis backend
- Provides middleware for Hono/Express
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated Specification
```markdown
# Rate Limiting System - Technical Specification

## 1. Overview

A flexible rate limiting system supporting multiple algorithms with Redis backend
and framework middleware integration.

## 2. System Architecture

### 2.1 Core Components

- **Rate Limiter Engine**: Algorithm implementation layer
- **Storage Backend**: Redis-based persistence
- **Middleware Layer**: Framework integrations
- **Configuration Manager**: Dynamic rule management

### 2.2 Supported Algorithms

#### Token Bucket
- Configurable capacity and refill rate
- Burst traffic support
- Per-user/IP buckets

#### Sliding Window Log
- Precise rate limiting
- Configurable window size
- Memory-efficient implementation

## 3. API Specification

### 3.1 Core Interface

```typescript
interface RateLimiterConfig {
  algorithm: "token-bucket" | "sliding-window";
  limit: number;
  window: number; // seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

class RateLimiter {
  constructor(backend: RedisBackend, config: RateLimiterConfig);

  isAllowed(key: string, cost?: number): Promise<RateLimitResult>;

  getRemaining(key: string): Promise<number>;
}
```

### 3.2 Middleware Integration

```typescript
// Hono
import { Hono } from "hono";
import { rateLimiter } from "./middleware";

const app = new Hono();

app.use(
  "/api/*",
  rateLimiter({
    requests: 100,
    window: 3600,
  })
);

// Express
import express from "express";
import { rateLimiterMiddleware } from "./middleware";

const app = express();

app.use(
  "/api",
  rateLimiterMiddleware({
    requests: 100,
    window: 3600,
  })
);
```

## 4. Redis Schema

```
rate_limit:{algorithm}:{key} -> {
  "tokens": 100,
  "lastRefill": 1234567890,
  "requests": []
}
```

## 5. Performance Requirements

- Latency: < 5ms per check
- Throughput: 10,000 checks/second
- Memory: O(n) where n = unique keys

## 6. Configuration

```yaml
rateLimiting:
  defaultAlgorithm: token-bucket
  redis:
    host: localhost
    port: 6379
  rules:
    - path: /api/*
      limit: 100
      window: 3600
```
```

## Best Practices for Documentation Generation

### 1. Provide Context
Include relevant code structure, project type, and target audience in your prompts.

### 2. Specify Format
Request specific documentation formats (Markdown, JSDoc, etc.).

### 3. Include Examples
Ask for usage examples and code snippets in documentation.

### 4. Request Sections
Specify required sections like installation, configuration, API reference, etc.

## See Also

- [Prompt Engineering Guide](../guide/prompts.md)
- [Web API Examples](./web-api.md)
- [Testing Examples](./testing.md)
