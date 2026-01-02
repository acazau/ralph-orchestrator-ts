# Bug Fixing Examples

## Overview

This guide demonstrates how to use Ralph Orchestrator for debugging and fixing code issues.

## Example 1: Null/Undefined Exception

### Problem Code
```typescript
function calculateAverage(numbers: number[]): number {
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return total / numbers.length;
}

// This crashes with: TypeError: Cannot read property 'reduce' of null
const result = calculateAverage(null as unknown as number[]);
```

### Fix Request
```typescript
const prompt = `
Fix this function that crashes when passed null or undefined:

function calculateAverage(numbers: number[]): number {
  const total = numbers.reduce((sum, n) => sum + n, 0);
  return total / numbers.length;
}

The function should handle null, undefined, empty arrays, and non-numeric values gracefully.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Fixed Code
```typescript
/**
 * Calculate the average of a list of numbers.
 *
 * @param numbers - Array of numeric values or null/undefined
 * @returns Average value, or null if input is invalid
 */
function calculateAverage(numbers: number[] | null | undefined): number | null {
  // Handle null/undefined input
  if (numbers == null) {
    return null;
  }

  // Handle empty array
  if (numbers.length === 0) {
    return 0;
  }

  // Filter out non-numeric values
  const numericValues = numbers.filter(
    (num): num is number => typeof num === "number" && !Number.isNaN(num)
  );

  // Return null if no valid numbers found
  if (numericValues.length === 0) {
    return null;
  }

  const total = numericValues.reduce((sum, n) => sum + n, 0);
  return total / numericValues.length;
}
```

## Example 2: Memory Leak Fix

### Problem Code
```typescript
class EventManager {
  private events: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  emit(event: string, data: unknown): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }
}
```

### Fix Request
```typescript
const prompt = `
Fix the memory leak in this TypeScript EventManager class.
The class never removes event listeners, causing memory leaks.
Add an 'off' method and ensure proper cleanup.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Fixed Code
```typescript
type EventCallback<T = unknown> = (data: T) => void;

interface CallbackWrapper<T = unknown> {
  id: number;
  callback: EventCallback<T>;
}

class EventManager {
  private events: Map<string, CallbackWrapper[]> = new Map();
  private callbackIds: WeakMap<Function, number> = new WeakMap();
  private nextId = 0;

  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }

    // Store callback with unique ID for removal
    const id = this.nextId++;
    const wrapper: CallbackWrapper = { id, callback };
    this.events.get(event)!.push(wrapper);
    this.callbackIds.set(callback, id);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.events.get(event);
    if (!callbacks) return;

    const id = this.callbackIds.get(callback);
    if (id !== undefined) {
      const filtered = callbacks.filter((wrapper) => wrapper.id !== id);
      this.events.set(event, filtered);
      this.callbackIds.delete(callback);

      // Clean up empty event arrays
      if (filtered.length === 0) {
        this.events.delete(event);
      }
    }
  }

  emit<T = unknown>(event: string, data: T): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach((wrapper) => wrapper.callback(data));
    }
  }

  // Clear all listeners for an event
  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  // Cleanup method for destroying the instance
  destroy(): void {
    this.events.clear();
    this.callbackIds = new WeakMap();
  }
}
```

## Example 3: Race Condition Fix

### Problem Code
```typescript
class Counter {
  private count = 0;

  async increment(): Promise<void> {
    const temp = this.count;
    // Simulating some async processing
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.count = temp + 1;
  }

  getValue(): number {
    return this.count;
  }
}
```

### Fix Request
```typescript
const prompt = `
Fix the race condition in this Counter class that occurs when
multiple concurrent calls to increment() happen simultaneously.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Fixed Code
```typescript
class Counter {
  private count = 0;
  private mutex: Promise<void> = Promise.resolve();

  async increment(): Promise<void> {
    // Use a mutex pattern to ensure sequential execution
    this.mutex = this.mutex.then(async () => {
      const temp = this.count;
      // Simulating some async processing
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.count = temp + 1;
    });

    return this.mutex;
  }

  async decrement(): Promise<void> {
    this.mutex = this.mutex.then(async () => {
      this.count -= 1;
    });

    return this.mutex;
  }

  getValue(): number {
    return this.count;
  }

  // For batch operations
  async batch(operations: Array<"increment" | "decrement">): Promise<void> {
    for (const op of operations) {
      if (op === "increment") {
        await this.increment();
      } else {
        await this.decrement();
      }
    }
  }
}

// Alternative using a proper async lock
class AsyncLock {
  private locked = false;
  private queue: Array<() => void> = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

class SafeCounter {
  private count = 0;
  private lock = new AsyncLock();

  async increment(): Promise<void> {
    await this.lock.acquire();
    try {
      const temp = this.count;
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.count = temp + 1;
    } finally {
      this.lock.release();
    }
  }

  getValue(): number {
    return this.count;
  }
}
```

## Example 4: SQL Injection Vulnerability

### Problem Code
```typescript
async function getUser(userId: string): Promise<User | null> {
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  return await db.execute(query);
}
```

### Fix Request
```typescript
const prompt = `
Fix the SQL injection vulnerability in this function.
Use parameterized queries and add input validation.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Fixed Code
```typescript
import { z } from "zod";

// Input validation schema
const userIdSchema = z.coerce.number().int().positive();

/**
 * Safely retrieve user by ID with SQL injection protection.
 *
 * @param userId - User identifier (number or string)
 * @returns User data or null if not found
 * @throws Error if userId is invalid
 */
async function getUser(userId: string | number): Promise<User | null> {
  // Input validation
  const result = userIdSchema.safeParse(userId);

  if (!result.success) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const validatedId = result.data;

  // Use parameterized query to prevent SQL injection
  const query = "SELECT * FROM users WHERE id = ?";

  try {
    const [user] = await db.execute(query, [validatedId]);
    return user || null;
  } catch (error) {
    console.error(`Database error fetching user ${validatedId}:`, error);
    return null;
  }
}

// Additional secure version using Drizzle ORM (recommended)
import { eq } from "drizzle-orm";
import { users } from "./schema";

async function getUserOrm(userId: string | number): Promise<User | null> {
  const result = userIdSchema.safeParse(userId);

  if (!result.success) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, result.data));

  return user || null;
}
```

## Example 5: Infinite Loop Fix

### Problem Code
```typescript
function findTarget(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid; // Bug: should be mid + 1
    } else {
      right = mid;
    }
  }

  return -1;
}
```

### Fix Request
```typescript
const prompt = `
Fix the infinite loop bug in this binary search implementation.
The function gets stuck when the target is not in the array.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Fixed Code
```typescript
/**
 * Binary search implementation with infinite loop fix.
 *
 * @param arr - Sorted array to search
 * @param target - Value to find
 * @returns Index of target or -1 if not found
 */
function findTarget(arr: number[], target: number): number {
  if (arr.length === 0) {
    return -1;
  }

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    // Changed condition to include equality
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1; // Fixed: increment to avoid infinite loop
    } else {
      right = mid - 1; // Fixed: decrement for consistency
    }
  }

  return -1;
}

// Enhanced version with additional features
interface BinarySearchOptions {
  returnInsertionPoint?: boolean;
}

function findTargetEnhanced(
  arr: number[],
  target: number,
  options: BinarySearchOptions = {}
): number {
  const { returnInsertionPoint = false } = options;

  if (arr.length === 0) {
    return returnInsertionPoint ? 0 : -1;
  }

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return returnInsertionPoint ? left : -1;
}
```

## Common Bug Patterns and Fixes

### 1. Off-by-One Errors
- Check array bounds
- Verify loop conditions
- Test edge cases (empty, single element)

### 2. Null/Undefined Handling
- Add null checks at function entry
- Use optional chaining (`?.`)
- Provide sensible defaults
- Use TypeScript strict mode

### 3. Resource Leaks
- Implement proper cleanup (close files, connections)
- Use `try/finally` blocks
- Add dispose/destroy methods
- Use `using` declarations (Stage 3)

### 4. Concurrency Issues
- Use mutex/lock patterns for shared resources
- Implement atomic operations
- Consider using concurrent-safe data structures
- Use proper async/await patterns

### 5. Type Errors
- Add type checking/validation with Zod
- Use TypeScript strict mode
- Handle type conversions explicitly
- Use type guards

## Debugging Tips

1. **Reproduce First**: Always reproduce the bug before fixing
2. **Add Logging**: Insert strategic logging to understand flow
3. **Unit Tests**: Write tests that expose the bug
4. **Edge Cases**: Test with empty, null, and boundary values
5. **Code Review**: Have the fix reviewed by others

## See Also

- [Testing Examples](./testing.md)
- [Agent Guide](../guide/agents.md)
- [Error Handling Best Practices](../03-best-practices/best-practices.md)
