# Testing Examples

## Overview

This guide demonstrates how to use Ralph Orchestrator for generating comprehensive test suites.

## Example 1: Unit Test Generation

### Source Code
```typescript
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Cannot divide by zero");
    }
    return a / b;
  }

  calculatePercentage(value: number, percentage: number): number {
    return (value * percentage) / 100;
  }
}
```

### Test Generation Request
```typescript
const prompt = `
Generate comprehensive unit tests for this Calculator class using Vitest.
Include edge cases, error handling, and parametrized tests.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated Tests
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Calculator } from "./calculator";

describe("Calculator", () => {
  let calc: Calculator;

  beforeEach(() => {
    calc = new Calculator();
  });

  // Addition Tests
  describe("add", () => {
    it.each([
      [2, 3, 5],
      [-1, 1, 0],
      [0, 0, 0],
      [1.5, 2.5, 4.0],
      [-5, -3, -8],
      [1e10, 1e10, 2e10], // Large numbers
    ])("should return %d + %d = %d", (a, b, expected) => {
      expect(calc.add(a, b)).toBe(expected);
    });

    it("should handle floating point precision", () => {
      const result = calc.add(0.1, 0.2);
      expect(result).toBeCloseTo(0.3);
    });
  });

  // Division Tests
  describe("divide", () => {
    it.each([
      [10, 2, 5],
      [7, 2, 3.5],
      [-10, 2, -5],
      [0, 5, 0],
    ])("should return %d / %d = %d", (a, b, expected) => {
      expect(calc.divide(a, b)).toBeCloseTo(expected);
    });

    it("should handle division resulting in repeating decimal", () => {
      expect(calc.divide(1, 3)).toBeCloseTo(0.3333333333333333);
    });

    it("should throw error when dividing by zero", () => {
      expect(() => calc.divide(10, 0)).toThrow("Cannot divide by zero");
    });
  });

  // Percentage Tests
  describe("calculatePercentage", () => {
    it.each([
      [100, 10, 10],
      [50, 50, 25],
      [200, 25, 50],
      [0, 50, 0],
      [100, 0, 0],
      [100, 150, 150], // Over 100%
      [100, -10, -10], // Negative percentage
    ])("should calculate %d%% of %d = %d", (value, percentage, expected) => {
      expect(calc.calculatePercentage(value, percentage)).toBe(expected);
    });
  });

  // Edge Cases
  describe("edge cases", () => {
    it("should handle NaN inputs gracefully", () => {
      expect(calc.add(NaN, 5)).toBeNaN();
    });

    it("should handle Infinity", () => {
      expect(calc.add(Infinity, 1)).toBe(Infinity);
    });
  });
});
```

## Example 2: Integration Test Generation

### API Code
```typescript
class UserService {
  constructor(
    private db: Database,
    private emailService: EmailService
  ) {}

  async createUser(email: string, name: string): Promise<User> {
    if (await this.db.userExists(email)) {
      throw new Error("User already exists");
    }

    const user = await this.db.createUser({ email, name });
    await this.emailService.sendWelcomeEmail(email, name);
    return user;
  }
}
```

### Test Generation Request
```typescript
const prompt = `
Generate integration tests for UserService that test the interaction
between database and email service. Use mocking where appropriate.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated Integration Tests
```typescript
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { UserService } from "./user-service";
import type { Database, EmailService, User } from "./types";

describe("UserService Integration", () => {
  let mockDb: { userExists: Mock; createUser: Mock };
  let mockEmailService: { sendWelcomeEmail: Mock };
  let userService: UserService;

  beforeEach(() => {
    mockDb = {
      userExists: vi.fn().mockResolvedValue(false),
      createUser: vi.fn().mockResolvedValue({
        id: 1,
        email: "test@example.com",
        name: "Test User",
      }),
    };

    mockEmailService = {
      sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    };

    userService = new UserService(
      mockDb as unknown as Database,
      mockEmailService as unknown as EmailService
    );
  });

  describe("createUser", () => {
    it("should create user and send welcome email on success", async () => {
      // Arrange
      const email = "newuser@example.com";
      const name = "New User";

      // Act
      const user = await userService.createUser(email, name);

      // Assert
      expect(mockDb.userExists).toHaveBeenCalledWith(email);
      expect(mockDb.createUser).toHaveBeenCalledWith({ email, name });
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(email, name);
      expect(user.email).toBe("test@example.com");
    });

    it("should throw error when user already exists", async () => {
      // Arrange
      mockDb.userExists.mockResolvedValue(true);

      // Act & Assert
      await expect(
        userService.createUser("existing@example.com", "Existing User")
      ).rejects.toThrow("User already exists");

      // Verify email was not sent
      expect(mockDb.createUser).not.toHaveBeenCalled();
      expect(mockEmailService.sendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("should handle email service failure", async () => {
      // Arrange
      mockEmailService.sendWelcomeEmail.mockRejectedValue(new Error("Email failed"));

      // Act & Assert
      await expect(
        userService.createUser("user@example.com", "User")
      ).rejects.toThrow("Email failed");
    });

    it("should create multiple users in sequence", async () => {
      const users = [
        { email: "user1@example.com", name: "User One" },
        { email: "user2@example.com", name: "User Two" },
        { email: "user3@example.com", name: "User Three" },
      ];

      for (const { email, name } of users) {
        await userService.createUser(email, name);
      }

      // Verify all calls were made
      expect(mockDb.userExists).toHaveBeenCalledTimes(3);
      expect(mockDb.createUser).toHaveBeenCalledTimes(3);
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledTimes(3);
    });
  });
});
```

## Example 3: End-to-End Test Generation

### Web Application Route
```typescript
import { Hono } from "hono";

const app = new Hono();

app.post("/api/login", async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: "Missing credentials" }, 400);
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = generateToken(user);
  return c.json({ token }, 200);
});
```

### Test Generation Request
```typescript
const prompt = `
Generate end-to-end tests for this login endpoint using Vitest.
Test successful login, missing fields, and invalid credentials.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated E2E Tests
```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "./app";

describe("Login Endpoint E2E", () => {
  const baseUrl = "http://localhost:3000";

  const validCredentials = {
    username: "testuser",
    password: "testpass123",
  };

  describe("POST /api/login", () => {
    it("should return token on successful login", async () => {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCredentials),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("token");
      expect(data.token.length).toBeGreaterThan(0);
    });

    it("should return 400 when username is missing", async () => {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "testpass123" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Missing credentials");
    });

    it("should return 400 when password is missing", async () => {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "testuser" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Missing credentials");
    });

    it("should return 400 with empty request body", async () => {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Missing credentials");
    });

    it("should return 401 with invalid credentials", async () => {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "wronguser",
          password: "wrongpass",
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Invalid credentials");
    });

    it("should handle SQL injection attempts safely", async () => {
      const response = await app.request("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "admin' OR '1'='1",
          password: "' OR '1'='1",
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Invalid credentials");
    });
  });
});
```

## Example 4: Performance Test Generation

### Test Generation Request
```typescript
const prompt = `
Generate performance tests for a function that processes large datasets.
Include tests for execution time, memory usage, and scalability.
`;

const response = await orchestrator.execute(prompt, { agent: "claude" });
```

### Generated Performance Tests
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { processData } from "./data-processor";

describe("Performance Tests", () => {
  const generateLargeDataset = (size: number): number[] => {
    return Array.from({ length: size }, () => Math.random());
  };

  describe("execution time", () => {
    it("should process 1M items under 1 second", () => {
      const largeDataset = generateLargeDataset(1_000_000);

      const startTime = performance.now();
      processData(largeDataset);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe("scalability", () => {
    it.each([
      [100],
      [1_000],
      [10_000],
      [100_000],
    ])("should scale linearly with %d elements", (size) => {
      const data = generateLargeDataset(size);

      const startTime = performance.now();
      processData(data);
      const executionTime = performance.now() - startTime;

      // Calculate time per element
      const timePerElement = executionTime / size;

      // Assert time per element is roughly constant (with 20% tolerance)
      const expectedTimePerElement = 0.001; // 1 microsecond
      expect(timePerElement).toBeLessThan(expectedTimePerElement * 1.2);
    });
  });

  describe("concurrent processing", () => {
    it("should handle concurrent requests efficiently", async () => {
      const processBatch = async (): Promise<void> => {
        const data = generateLargeDataset(10_000);
        processData(data);
      };

      const startTime = performance.now();

      await Promise.all(
        Array.from({ length: 10 }, () => processBatch())
      );

      const executionTime = performance.now() - startTime;

      // Should complete 10 batches in under 2 seconds with parallelism
      expect(executionTime).toBeLessThan(2000);
    });
  });

  describe("memory efficiency", () => {
    it("should not cause memory leaks with repeated processing", () => {
      const iterations = 100;
      const memoryUsageBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const data = generateLargeDataset(10_000);
        processData(data);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryUsageAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryUsageAfter - memoryUsageBefore;

      // Memory increase should be minimal (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
```

## Test Generation Best Practices

### 1. Coverage Goals
- Aim for >80% code coverage
- Test all public methods
- Include edge cases and error paths

### 2. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 3. Fixtures and Mocking
- Use beforeEach for common setup
- Mock external dependencies with vi.fn()
- Keep tests isolated and independent

### 4. Parametrized Tests
- Use it.each for similar test cases
- Test boundary values
- Include negative test cases

### 5. Performance Testing
- Set realistic performance goals
- Test with representative data sizes
- Monitor resource usage

## Running Tests with Bun

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific file
bun test src/calculator.test.ts

# Run in watch mode
bun test --watch

# Run with verbose output
bun test --verbose
```

## See Also

- [Testing Best Practices](../testing.md)
- [CI/CD Integration](../deployment/ci-cd.md)
- [Checkpointing Guide](../guide/checkpointing.md)
