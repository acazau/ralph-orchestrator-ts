# Testing Guide

## Overview

This guide covers testing strategies, tools, and best practices for Ralph Orchestrator TypeScript development and deployment.

## Test Suite Structure

```
src/
├── __tests__/              # Test files
│   ├── orchestrator.test.ts
│   ├── agents.test.ts
│   ├── config.test.ts
│   └── metrics.test.ts
├── agents/
│   └── __tests__/          # Agent-specific tests
├── utils/
│   └── __tests__/          # Utility tests
└── integration/            # Integration tests
    ├── full-cycle.test.ts
    ├── git-operations.test.ts
    └── agent-execution.test.ts
```

## Running Tests

### All Tests
```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Verbose output
bun test --verbose

# Specific test file
bun test src/__tests__/orchestrator.test.ts
```

### Test Categories
```bash
# Unit tests only
bun test src/__tests__/

# Integration tests
bun test src/integration/

# Tests matching pattern
bun test --test-name-pattern "orchestrator"
```

## Unit Tests

### Testing the Orchestrator

```typescript
import { describe, test, expect, beforeEach, mock } from "bun:test";
import { RalphOrchestrator } from "../orchestrator";

describe("RalphOrchestrator", () => {
  let orchestrator: RalphOrchestrator;

  beforeEach(() => {
    const config = {
      agent: "claude",
      promptFile: "test.md",
      maxIterations: 10,
      dryRun: true,
    };
    orchestrator = new RalphOrchestrator(config);
  });

  test("initialization", () => {
    expect(orchestrator.config.agent).toBe("claude");
    expect(orchestrator.config.maxIterations).toBe(10);
    expect(orchestrator.iterationCount).toBe(0);
  });

  test("execute agent", async () => {
    const mockExec = mock(() =>
      Promise.resolve({
        success: true,
        output: "Task completed",
      })
    );

    // Mock the agent execution
    orchestrator.executeAgent = mockExec;

    const result = await orchestrator.executeAgent("claude", "test.md");

    expect(result.success).toBe(true);
    expect(result.output).toBe("Task completed");
    expect(mockExec).toHaveBeenCalled();
  });

  test("check task complete - no marker", async () => {
    const promptContent = "Do something";
    const isComplete = orchestrator.checkTaskComplete(promptContent);
    expect(isComplete).toBe(false);
  });

  test("check task complete - with marker", async () => {
    const promptContent = "Do something\n- [x] TASK_COMPLETE";
    const isComplete = orchestrator.checkTaskComplete(promptContent);
    expect(isComplete).toBe(true);
  });

  test("iteration limit enforcement", async () => {
    orchestrator.config.maxIterations = 2;

    const mockExecute = mock(() =>
      Promise.resolve({ success: true, output: "Output" })
    );
    orchestrator.executeAgent = mockExecute;

    const result = await orchestrator.run();

    expect(result.iterations).toBe(2);
    expect(result.success).toBe(false);
    expect(result.stopReason).toContain("max_iterations");
  });
});
```

### Testing Agents

```typescript
import { describe, test, expect, mock, spyOn } from "bun:test";
import { ClaudeAgent, GeminiAgent, AgentManager } from "../agents";
import { $ } from "bun";

describe("Agents", () => {
  describe("ClaudeAgent", () => {
    test("availability check - available", async () => {
      const agent = new ClaudeAgent();
      // Mock which command
      const mockWhich = spyOn(Bun, "which").mockReturnValue("/usr/bin/claude");

      expect(await agent.isAvailable()).toBe(true);
      mockWhich.mockRestore();
    });

    test("availability check - not available", async () => {
      const agent = new ClaudeAgent();
      const mockWhich = spyOn(Bun, "which").mockReturnValue(null);

      expect(await agent.isAvailable()).toBe(false);
      mockWhich.mockRestore();
    });

    test("execution timeout handling", async () => {
      const agent = new ClaudeAgent();
      agent.timeout = 100; // Very short timeout

      const result = await agent.execute("prompt.md");

      expect(result.success).toBe(false);
      expect(result.output.toLowerCase()).toContain("timeout");
    });
  });

  describe("AgentManager", () => {
    test("auto select agent", async () => {
      const manager = new AgentManager();

      // Mock agent availability
      manager.agents.claude.isAvailable = mock(() => Promise.resolve(true));
      manager.agents.gemini.isAvailable = mock(() => Promise.resolve(false));

      const agent = await manager.getAgent("auto");
      expect(agent.name).toBe("claude");
    });
  });
});
```

## Integration Tests

### Full Cycle Test

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { RalphOrchestrator } from "../orchestrator";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("Integration", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ralph-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("full execution cycle", async () => {
    // Setup
    const promptFile = join(testDir, "PROMPT.md");
    await writeFile(
      promptFile,
      `Create a TypeScript function that returns 'Hello'
      - [x] TASK_COMPLETE`
    );

    const config = {
      agent: "auto",
      promptFile,
      maxIterations: 5,
      workingDirectory: testDir,
      dryRun: false,
    };

    // Execute
    const orchestrator = new RalphOrchestrator(config);
    const result = await orchestrator.run();

    // Verify
    expect(result.success).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
  });

  test("checkpoint creation", async () => {
    // Initialize Git repo
    await $`git init ${testDir}`.quiet();

    const promptFile = join(testDir, "PROMPT.md");
    await writeFile(promptFile, "Test task");

    const config = {
      promptFile,
      checkpointInterval: 1,
      workingDirectory: testDir,
    };

    const orchestrator = new RalphOrchestrator(config);
    await orchestrator.createCheckpoint(1);

    // Check Git log
    const result = await $`git -C ${testDir} log --oneline`.text();
    expect(result).toContain("Ralph checkpoint");
  });
});
```

## End-to-End Tests

### CLI Testing

```typescript
import { describe, test, expect } from "bun:test";
import { $ } from "bun";

describe("CLI", () => {
  test("help command", async () => {
    const result = await $`bun run src/cli.ts --help`.text();
    expect(result).toContain("Ralph Orchestrator");
  });

  test("version command", async () => {
    const result = await $`bun run src/cli.ts --version`.text();
    expect(result).toMatch(/\d+\.\d+\.\d+/);
  });

  test("dry run execution", async () => {
    await Bun.write("test-prompt.md", "Test task");

    const result = await $`bun run src/cli.ts --prompt test-prompt.md --dry-run`.text();
    expect(result).toContain("dry run");

    await $`rm test-prompt.md`.quiet();
  });
});
```

## Test Fixtures

### Prompt Fixtures

```typescript
// tests/fixtures/prompts.ts

export const SIMPLE_TASK = `
Create a TypeScript function that adds two numbers.
`;

export const COMPLEX_TASK = `
Build a REST API with:
- User authentication
- CRUD operations
- Database integration
- Unit tests
`;

export const COMPLETED_TASK = `
Create a hello world function.
- [x] TASK_COMPLETE
`;
```

### Mock Agent

```typescript
// tests/fixtures/mock-agent.ts

export class MockAgent {
  private responses: string[];
  private callCount: number = 0;

  constructor(responses: string[] = ["Default response"]) {
    this.responses = responses;
  }

  async execute(promptFile: string): Promise<{ success: boolean; output: string }> {
    const response =
      this.callCount < this.responses.length
        ? this.responses[this.callCount]
        : this.responses[this.responses.length - 1];

    this.callCount++;
    return { success: true, output: response };
  }

  getCallCount(): number {
    return this.callCount;
  }
}
```

## Performance Testing

```typescript
import { describe, test, expect } from "bun:test";
import { RalphOrchestrator } from "../orchestrator";

describe("Performance", () => {
  test("iteration performance", async () => {
    const config = {
      agent: "auto",
      maxIterations: 10,
      dryRun: true,
    };

    const orchestrator = new RalphOrchestrator(config);

    const startTime = performance.now();
    await orchestrator.run();
    const executionTime = performance.now() - startTime;

    // Should complete dry run quickly
    expect(executionTime).toBeLessThan(5000); // 5 seconds
  });

  test("memory usage", async () => {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    const config = { maxIterations: 100, dryRun: true };
    const orchestrator = new RalphOrchestrator(config);
    await orchestrator.run();

    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable
    expect(memoryIncrease).toBeLessThan(100); // Less than 100MB
  });
});
```

## Test Coverage

### Coverage Configuration

Bun has built-in coverage support:

```bash
# Run tests with coverage
bun test --coverage

# Generate coverage report
bun test --coverage --coverage-reporter=html
```

### Coverage Reports

```bash
# Terminal report
bun test --coverage

# HTML report (if configured)
bun test --coverage --coverage-reporter=html
open coverage/index.html
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run type check
        run: bun run typecheck

      - name: Run linting
        run: bun run lint

      - name: Run tests
        run: bun test

      - name: Run tests with coverage
        run: bun test --coverage
```

## Test Best Practices

### 1. Test Isolation
- Each test should be independent
- Use beforeEach/afterEach for setup/teardown
- Clean up resources after tests

### 2. Mock External Dependencies
- Mock subprocess calls
- Mock file system operations when possible
- Mock network requests

### 3. Test Edge Cases
- Empty inputs
- Invalid configurations
- Network failures
- Timeout scenarios

### 4. Use Descriptive Names
```typescript
// Good
test("orchestrator stops at max iterations", () => {
  // ...
});

// Bad
test("test1", () => {
  // ...
});
```

### 5. Arrange-Act-Assert Pattern
```typescript
test("example", async () => {
  // Arrange
  const orchestrator = new RalphOrchestrator(config);

  // Act
  const result = await orchestrator.run();

  // Assert
  expect(result.success).toBe(true);
});
```

## Debugging Tests

### Bun Test Options
```bash
# Show console output
bun test --verbose

# Run specific test
bun test --test-name-pattern "orchestrator stops"

# Run tests in specific file
bun test src/__tests__/orchestrator.test.ts

# Bail on first failure
bun test --bail
```

### Using Debugger
```typescript
test("debugging", async () => {
  debugger; // Debugger will stop here when running with --inspect
  const result = someFunction();
  expect(result).toBe(expected);
});
```

Run with:
```bash
bun test --inspect-brk
```

### Logging in Tests
```typescript
test("with logging", async () => {
  console.log("Debug info:", someValue);
  // Test continues...
});
```

Run with verbose mode to see output:
```bash
bun test --verbose
```
