# Q Chat Adapter Production Deployment Guide

This guide provides comprehensive instructions for deploying the Q Chat adapter in production environments with Ralph Orchestrator TypeScript.

## Overview

The Q Chat adapter has been thoroughly tested and validated for production use with the following capabilities:
- Thread-safe concurrent message processing
- Robust error handling and recovery
- Graceful shutdown and resource cleanup
- Non-blocking I/O to prevent deadlocks
- Automatic retry with exponential backoff
- Signal handling for clean termination

## Prerequisites

### System Requirements
- Bun 1.0 or higher
- Q CLI installed and configured
- Sufficient memory for concurrent operations (minimum 2GB recommended)
- Unix-like operating system (Linux, macOS)

### Installation
```bash
# Install Q CLI
npm install -g @aws/amazon-q-cli

# Verify installation
qchat --version

# Install Ralph Orchestrator TypeScript with Q adapter support
bun add ralph-orchestrator-ts
```

## Configuration

### Environment Variables

Configure the Q Chat adapter behavior using these environment variables:

```bash
# Core Configuration
export QCHAT_TIMEOUT=300          # Request timeout in seconds (default: 120)
export QCHAT_MAX_RETRIES=5        # Maximum retry attempts (default: 3)
export QCHAT_RETRY_DELAY=2        # Initial retry delay in seconds (default: 1)
export QCHAT_VERBOSE=1            # Enable verbose logging (default: 0)

# Performance Tuning
export QCHAT_BUFFER_SIZE=8192     # Pipe buffer size in bytes (default: 4096)
export QCHAT_POLL_INTERVAL=0.1    # Message queue polling interval (default: 0.1)
export QCHAT_MAX_CONCURRENT=10    # Maximum concurrent requests (default: 5)

# Resource Limits
export QCHAT_MAX_MEMORY_MB=4096   # Maximum memory usage in MB
export QCHAT_MAX_OUTPUT_SIZE=10485760  # Maximum output size in bytes (10MB)
```

### Configuration File

Create a configuration file for persistent settings:

```yaml
# config/qchat.yaml
adapter:
  name: qchat
  timeout: 300
  max_retries: 5
  retry_delay: 2

performance:
  buffer_size: 8192
  poll_interval: 0.1
  max_concurrent: 10

logging:
  level: INFO
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
  file: /var/log/ralph/qchat.log

monitoring:
  metrics_enabled: true
  metrics_interval: 60
  health_check_port: 8080
```

## Deployment Scenarios

### 1. Single Instance Deployment

For simple production deployments with moderate load:

```bash
#!/bin/bash
# deploy-qchat.sh

# Set production environment
export ENVIRONMENT=production
export QCHAT_TIMEOUT=300
export QCHAT_VERBOSE=1

# Start Ralph Orchestrator with Q Chat
bun run ralph \
  --agent q \
  --config config/qchat.yaml \
  --checkpoint-interval 10 \
  --max-iterations 1000 \
  --metrics-interval 60 \
  --log-file /var/log/ralph/orchestrator.log
```

### 2. High-Availability Deployment

For mission-critical applications requiring high availability:

```bash
#!/bin/bash
# ha-deploy-qchat.sh

# Configure for high availability
export QCHAT_MAX_RETRIES=10
export QCHAT_RETRY_DELAY=5
export QCHAT_MAX_CONCURRENT=20

# Enable health monitoring
export HEALTH_CHECK_ENABLED=true
export HEALTH_CHECK_INTERVAL=30

# Start with supervisor for automatic restart
supervisorctl start ralph-qchat

# Or use systemd
systemctl start ralph-qchat.service
```

### 3. Containerized Deployment

Docker configuration for container deployments:

```dockerfile
# Dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Install Q CLI
RUN apk add --no-cache nodejs npm && \
    npm install -g @aws/amazon-q-cli

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application
COPY . .

# Build
RUN bun run build

# Set environment variables
ENV QCHAT_TIMEOUT=300
ENV QCHAT_VERBOSE=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the orchestrator
CMD ["bun", "run", "ralph", "--agent", "q", "--config", "config/qchat.yaml"]
```

Docker Compose configuration:

```yaml
# docker-compose.yml
version: '3.8'

services:
  ralph-qchat:
    build: .
    container_name: ralph-qchat
    restart: unless-stopped
    environment:
      - QCHAT_TIMEOUT=300
      - QCHAT_MAX_RETRIES=5
      - QCHAT_VERBOSE=1
    volumes:
      - ./prompts:/app/prompts
      - ./checkpoints:/app/checkpoints
      - ./logs:/app/logs
    ports:
      - "8080:8080"  # Health check endpoint
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

## Monitoring and Observability

### Logging Configuration

Configure structured logging for production:

```typescript
// logging_config.ts
import { createWriteStream } from 'fs';
import { join } from 'path';

interface LogEntry {
  time: string;
  level: string;
  module: string;
  message: string;
  [key: string]: unknown;
}

export function setupLogging(logPath = '/var/log/ralph/qchat.log') {
  const logStream = createWriteStream(logPath, { flags: 'a' });

  return {
    log(level: string, module: string, message: string, extra?: Record<string, unknown>) {
      const entry: LogEntry = {
        time: new Date().toISOString(),
        level,
        module,
        message,
        ...extra,
      };
      logStream.write(JSON.stringify(entry) + '\n');
    },

    info(module: string, message: string, extra?: Record<string, unknown>) {
      this.log('INFO', module, message, extra);
    },

    error(module: string, message: string, extra?: Record<string, unknown>) {
      this.log('ERROR', module, message, extra);
    },

    warn(module: string, message: string, extra?: Record<string, unknown>) {
      this.log('WARN', module, message, extra);
    },
  };
}
```

### Metrics Collection

Monitor key performance indicators:

```typescript
// metrics.ts
interface MetricsRegistry {
  requestCount: number;
  requestDurations: number[];
  activeRequests: number;
  errorCounts: Map<string, number>;
}

class QChatMetrics {
  private registry: MetricsRegistry = {
    requestCount: 0,
    requestDurations: [],
    activeRequests: 0,
    errorCounts: new Map(),
  };

  incrementRequestCount(): void {
    this.registry.requestCount++;
  }

  recordDuration(duration: number): void {
    this.registry.requestDurations.push(duration);
    // Keep only last 1000 samples
    if (this.registry.requestDurations.length > 1000) {
      this.registry.requestDurations.shift();
    }
  }

  incrementActiveRequests(): void {
    this.registry.activeRequests++;
  }

  decrementActiveRequests(): void {
    this.registry.activeRequests--;
  }

  recordError(errorType: string): void {
    const count = this.registry.errorCounts.get(errorType) || 0;
    this.registry.errorCounts.set(errorType, count + 1);
  }

  getMetrics(): Record<string, unknown> {
    const durations = this.registry.requestDurations;
    const sorted = [...durations].sort((a, b) => a - b);

    return {
      qchat_requests_total: this.registry.requestCount,
      qchat_active_requests: this.registry.activeRequests,
      qchat_request_duration_p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      qchat_request_duration_p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      qchat_errors_total: Object.fromEntries(this.registry.errorCounts),
    };
  }
}

export const metrics = new QChatMetrics();
```

### Health Checks

Implement health check endpoints:

```typescript
// health_check.ts
import { Hono } from 'hono';
import os from 'os';

const app = new Hono();

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  adapter: string;
  version: string;
  system?: {
    cpu_percent: number;
    memory_percent: number;
    disk_usage: number;
  };
}

app.get('/health', (c) => {
  const response: HealthResponse = {
    status: 'healthy',
    adapter: 'qchat',
    version: '1.0.0',
  };
  return c.json(response);
});

app.get('/health/detailed', (c) => {
  const memUsage = 1 - os.freemem() / os.totalmem();
  const cpuLoad = os.loadavg()[0];

  const response: HealthResponse = {
    status: 'healthy',
    adapter: 'qchat',
    version: '1.0.0',
    system: {
      cpu_percent: cpuLoad * 100,
      memory_percent: memUsage * 100,
      disk_usage: 0, // Would need additional implementation
    },
  };
  return c.json(response);
});

export default app;
```

## Performance Optimization

### 1. Connection Pooling

Optimize for high-concurrency scenarios:

```typescript
// connection_pool.ts
class QChatConnectionPool {
  private maxConnections: number;
  private activeConnections: number = 0;
  private queue: Array<() => void> = [];

  constructor(maxConnections = 10) {
    this.maxConnections = maxConnections;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.activeConnections < this.maxConnections) {
        this.activeConnections++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  private release(): void {
    this.activeConnections--;
    const next = this.queue.shift();
    if (next) {
      this.activeConnections++;
      next();
    }
  }
}

export const connectionPool = new QChatConnectionPool(10);
```

### 2. Caching Strategy

Implement response caching for repeated queries:

```typescript
// cache.ts
import { createHash } from 'crypto';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class QChatCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private getCacheKey(prompt: string): string {
    return createHash('sha256').update(prompt).digest('hex');
  }

  get(prompt: string): T | null {
    const key = this.getCacheKey(prompt);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(prompt: string, value: T, ttl = 3600000): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const key = this.getCacheKey(prompt);
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }
}

export const responseCache = new QChatCache<string>(1000);
```

### 3. Resource Limits

Configure resource limits for production stability:

```bash
# Set system limits
ulimit -n 4096          # Increase file descriptor limit
ulimit -u 2048          # Increase process limit
ulimit -m 4194304       # Set memory limit (4GB)

# Configure cgroups for container environments
echo "4G" > /sys/fs/cgroup/memory/ralph-qchat/memory.limit_in_bytes
echo "80" > /sys/fs/cgroup/cpu/ralph-qchat/cpu.shares
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Deadlock Prevention
```bash
# Check for pipe buffer issues
strace -p <PID> -e read,write

# Increase buffer size if needed
export QCHAT_BUFFER_SIZE=16384
```

#### 2. Memory Leaks
```bash
# Monitor memory usage
watch -n 1 'ps aux | grep ralph'

# Check Bun heap stats
bun --inspect src/cli.ts
```

#### 3. Process Hanging
```bash
# Check process state
ps -eLf | grep ralph

# Send diagnostic signal
kill -USR1 <PID>  # Trigger diagnostic dump
```

#### 4. High CPU Usage
```bash
# Profile CPU usage
bun --cpu-profile src/cli.ts

# Adjust polling interval
export QCHAT_POLL_INTERVAL=0.5
```

### Debug Mode

Enable debug mode for detailed diagnostics:

```bash
# Enable all debug features
export QCHAT_DEBUG=1
export QCHAT_VERBOSE=1
export DEBUG=ralph:*

# Run with debug logging
bun run ralph \
  --agent q \
  --verbose \
  --debug \
  --log-level DEBUG
```

## Security Considerations

### 1. Input Validation

Always validate and sanitize inputs:

```typescript
const MAX_PROMPT_LENGTH = 100000;
const BLOCKED_PATTERNS = ['<script', 'javascript:', 'data:'];

function validatePrompt(prompt: string): string {
  // Check prompt length
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error('Prompt exceeds maximum length');
  }

  // Sanitize special characters
  let sanitized = prompt.replace(/\0/g, '');

  // Check for injection attempts
  if (BLOCKED_PATTERNS.some((pattern) => prompt.toLowerCase().includes(pattern))) {
    throw new Error('Potentially malicious prompt detected');
  }

  return sanitized;
}
```

### 2. Process Isolation

Run Q Chat processes with limited privileges:

```bash
# Create dedicated user
useradd -r -s /bin/false qchat-user

# Run with limited privileges
sudo -u qchat-user bun run ralph --agent q
```

### 3. Network Security

Configure firewall rules for the health check endpoint:

```bash
# Allow health check port only from monitoring systems
iptables -A INPUT -p tcp --dport 8080 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j DROP
```

## Maintenance and Updates

### Rolling Updates

Perform zero-downtime updates:

```bash
#!/bin/bash
# rolling-update.sh

# Start new version
docker-compose up -d ralph-qchat-new

# Wait for health check
while ! curl -f http://localhost:8081/health; do
  sleep 5
done

# Switch traffic (update load balancer/proxy)
nginx -s reload

# Stop old version
docker-compose stop ralph-qchat-old
```

### Backup and Recovery

Regular checkpoint backups:

```bash
# Backup checkpoints
tar -czf checkpoints-$(date +%Y%m%d).tar.gz checkpoints/

# Backup configuration
cp -r config/ backup/config-$(date +%Y%m%d)/

# Restore from backup
tar -xzf checkpoints-20240101.tar.gz
cp -r backup/config-20240101/* config/
```

## Performance Benchmarks

Expected performance metrics in production:

| Metric | Value | Notes |
|--------|-------|-------|
| **Latency (p50)** | < 500ms | For simple prompts |
| **Latency (p99)** | < 2000ms | For complex prompts |
| **Throughput** | 100 req/min | Single instance |
| **Concurrency** | 10-20 | Concurrent requests |
| **Memory Usage** | < 500MB | Per instance |
| **CPU Usage** | < 50% | Average utilization |
| **Error Rate** | < 0.1% | Production target |
| **Availability** | > 99.9% | With proper monitoring |

## Best Practices

1. **Always use checkpointing** for long-running tasks
2. **Monitor resource usage** continuously
3. **Implement rate limiting** to prevent overload
4. **Use connection pooling** for better performance
5. **Enable structured logging** for easier debugging
6. **Set appropriate timeouts** based on workload
7. **Implement circuit breakers** for fault tolerance
8. **Regular backup** of checkpoints and configuration
9. **Test disaster recovery** procedures regularly
10. **Keep Q CLI updated** to latest stable version

## Support and Resources

- **Documentation**: [Ralph Orchestrator Docs](https://ralph-orchestrator-ts.readthedocs.io)
- **Issues**: [GitHub Issues](https://github.com/acazau/ralph-orchestrator-ts/issues)
- **Community**: [Discord Server](https://discord.gg/ralph-orchestrator)

## Appendix: Systemd Service

```ini
# /etc/systemd/system/ralph-qchat.service
[Unit]
Description=Ralph Orchestrator TypeScript with Q Chat Adapter
After=network.target

[Service]
Type=simple
User=qchat-user
Group=qchat-group
WorkingDirectory=/opt/ralph-orchestrator-ts
Environment="QCHAT_TIMEOUT=300"
Environment="QCHAT_VERBOSE=1"
Environment="BUN_INSTALL=/home/qchat-user/.bun"
Environment="PATH=/home/qchat-user/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/home/qchat-user/.bun/bin/bun run ralph --agent q --config /etc/ralph/qchat.yaml
Restart=always
RestartSec=10
StandardOutput=append:/var/log/ralph/qchat.log
StandardError=append:/var/log/ralph/qchat-error.log

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable ralph-qchat.service
systemctl start ralph-qchat.service
systemctl status ralph-qchat.service
```
