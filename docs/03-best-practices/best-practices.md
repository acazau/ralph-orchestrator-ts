# Implementation Best Practices

## Overview

This guide outlines best practices for implementing and using Ralph Orchestrator TypeScript in production environments.

## Architecture Best Practices

### 1. Modular Design
- Keep agent implementations separate and modular
- Use dependency injection for flexibility
- Implement clear interfaces between components

### 2. Error Handling
```typescript
// Good practice: Comprehensive error handling
try {
    const response = await agent.process(prompt);
    return response;
} catch (error) {
    if (error instanceof AgentTimeoutError) {
        logger.error(`Agent timeout: ${error.message}`);
        return fallbackResponse();
    }
    if (error instanceof AgentAPIError) {
        logger.error(`API error: ${error.message}`);
        return handleApiError(error);
    }
    throw error;
}
```

### 3. Configuration Management
- Use environment variables for sensitive data
- Implement configuration validation
- Support multiple configuration profiles

## Performance Optimization

### 1. Caching Strategies
```typescript
// Implement intelligent caching
import { LRUCache } from 'lru-cache';

const responseCache = new LRUCache<string, string>({
    max: 128,
    ttl: 1000 * 60 * 60, // 1 hour
});

async function getCachedResponse(prompt: string): Promise<string> {
    const cached = responseCache.get(prompt);
    if (cached) return cached;

    const response = await agent.process(prompt);
    responseCache.set(prompt, response);
    return response;
}
```

### 2. Connection Pooling
- Reuse HTTP connections
- Implement connection limits
- Use async operations where possible

### 3. Rate Limiting
```typescript
// Implement rate limiting
class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private readonly maxTokens: number;
    private readonly refillRate: number;

    constructor(maxTokens = 10, refillRate = 1000) {
        this.maxTokens = maxTokens;
        this.refillRate = refillRate;
        this.tokens = maxTokens;
        this.lastRefill = Date.now();
    }

    async acquire(): Promise<void> {
        this.refill();
        if (this.tokens > 0) {
            this.tokens--;
            return;
        }
        await this.wait();
        return this.acquire();
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = Math.floor(elapsed / this.refillRate);
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    private wait(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, this.refillRate));
    }
}

const rateLimiter = new RateLimiter(10, 1000);

async function makeRequest(): Promise<string> {
    await rateLimiter.acquire();
    return agent.process(prompt);
}
```

## Security Best Practices

### 1. API Key Management
- Never hardcode API keys
- Use secure key storage solutions
- Rotate keys regularly

### 2. Input Validation
```typescript
// Always validate and sanitize inputs
const MAX_PROMPT_LENGTH = 100000;

function validatePrompt(prompt: string): string {
    if (prompt.length > MAX_PROMPT_LENGTH) {
        throw new Error('Prompt too long');
    }

    // Remove potentially harmful content
    const sanitized = sanitizeInput(prompt);
    return sanitized;
}

function sanitizeInput(input: string): string {
    // Remove null bytes and control characters
    return input
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}
```

### 3. Output Filtering
- Filter sensitive information from responses
- Implement content moderation
- Log security events

## Monitoring and Observability

### 1. Structured Logging
```typescript
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'app.log' })
    ]
});

logger.info('agent_request', {
    agent_type: 'claude',
    prompt_length: prompt.length,
    user_id: userId,
    timestamp: new Date().toISOString()
});
```

### 2. Metrics Collection
- Track response times
- Monitor error rates
- Measure token usage

### 3. Health Checks
```typescript
// Implement health check endpoints
import { Hono } from 'hono';

const app = new Hono();

interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    checks: Record<string, boolean>;
}

app.get('/health', async (c) => {
    const checks = {
        database: await checkDbConnection(),
        agents: await checkAgentAvailability(),
        cache: await checkCacheStatus()
    };

    const status = Object.values(checks).every(Boolean) ? 'healthy' : 'unhealthy';
    return c.json({ status, checks }, status === 'healthy' ? 200 : 503);
});

async function checkDbConnection(): Promise<boolean> {
    try {
        // Database connection check
        return true;
    } catch {
        return false;
    }
}

async function checkAgentAvailability(): Promise<boolean> {
    try {
        // Agent availability check
        return true;
    } catch {
        return false;
    }
}

async function checkCacheStatus(): Promise<boolean> {
    try {
        // Cache status check
        return true;
    } catch {
        return false;
    }
}
```

## Testing Strategies

### 1. Unit Testing
```typescript
// Test individual components
import { describe, test, expect } from 'bun:test';

describe('Prompt Validation', () => {
    test('should accept valid prompts', () => {
        const validPrompt = 'Calculate 2+2';
        expect(validatePrompt(validPrompt)).toBe(validPrompt);
    });

    test('should reject prompts that are too long', () => {
        const invalidPrompt = 'x'.repeat(MAX_PROMPT_LENGTH + 1);
        expect(() => validatePrompt(invalidPrompt)).toThrow('Prompt too long');
    });
});
```

### 2. Integration Testing
- Test agent interactions
- Verify error handling
- Test edge cases

### 3. Load Testing
```bash
# Use tools like k6 for load testing
k6 run load_test.js
```

## Deployment Best Practices

### 1. Container Strategy
```dockerfile
# Multi-stage build for smaller images
FROM oven/bun:1-alpine as builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
CMD ["bun", "run", "start"]
```

### 2. Scaling Considerations
- Implement horizontal scaling
- Use load balancers
- Consider serverless options

### 3. Blue-Green Deployments
- Minimize downtime
- Enable quick rollbacks
- Test in production-like environments

## Common Pitfalls to Avoid

### 1. Over-Engineering
- Start simple and iterate
- Don't optimize prematurely
- Focus on core functionality first

### 2. Ignoring Rate Limits
- Always respect API rate limits
- Implement exponential backoff
- Monitor quota usage

### 3. Poor Error Messages
```typescript
// Bad
try {
    await processRequest();
} catch {
    return 'Error occurred';
}

// Good
try {
    await processRequest();
} catch (error) {
    if (error instanceof ValidationError) {
        return `Invalid input: ${error.message}`;
    }
    if (error instanceof RateLimitError) {
        return `Rate limit exceeded. Please retry after ${error.retryAfter} seconds`;
    }
    logger.error('Unexpected error', { error });
    return 'An unexpected error occurred. Please try again later.';
}
```

## Maintenance Guidelines

### 1. Regular Updates
- Keep dependencies updated
- Monitor security advisories
- Test updates in staging first

### 2. Documentation
- Maintain up-to-date documentation
- Document configuration changes
- Keep runbooks current

### 3. Backup and Recovery
- Implement regular backups
- Test recovery procedures
- Document disaster recovery plans

## TypeScript-Specific Best Practices

### 1. Type Safety
```typescript
// Define strict types for all interfaces
interface AgentRequest {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    agent: 'claude' | 'gemini' | 'q' | 'auto';
}

interface AgentResponse {
    content: string;
    tokensUsed: number;
    model: string;
    finishReason: 'stop' | 'length' | 'error';
}

// Use type guards
function isValidAgent(agent: string): agent is AgentRequest['agent'] {
    return ['claude', 'gemini', 'q', 'auto'].includes(agent);
}
```

### 2. Async/Await Patterns
```typescript
// Proper async error handling
async function processWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
    throw new Error('Should not reach here');
}
```

### 3. Configuration Types
```typescript
// Type-safe configuration
import { z } from 'zod';

const configSchema = z.object({
    agent: z.enum(['claude', 'gemini', 'q', 'auto']).default('auto'),
    maxIterations: z.number().int().positive().default(100),
    maxRuntime: z.number().int().positive().default(14400),
    verbose: z.boolean().default(false),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(env: NodeJS.ProcessEnv): Config {
    return configSchema.parse({
        agent: env.RALPH_AGENT,
        maxIterations: env.RALPH_MAX_ITERATIONS ? parseInt(env.RALPH_MAX_ITERATIONS) : undefined,
        maxRuntime: env.RALPH_MAX_RUNTIME ? parseInt(env.RALPH_MAX_RUNTIME) : undefined,
        verbose: env.RALPH_VERBOSE === 'true',
    });
}
```

## Conclusion

Following these best practices will help ensure your Ralph Orchestrator TypeScript implementation is:
- Reliable and performant
- Secure and maintainable
- Scalable and observable

Remember to adapt these practices to your specific use case and requirements.

## See Also

- [Configuration Guide](../guide/configuration.md)
- [Security Documentation](../advanced/security.md)
- [Context Management](../advanced/context-management.md)
