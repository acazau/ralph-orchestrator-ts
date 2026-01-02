# Production Deployment Guide

## Overview

This guide covers deploying Ralph Orchestrator TypeScript in production environments, including server setup, automation, monitoring, and scaling considerations.

## Deployment Options

### 1. Local Server Deployment

#### System Requirements
- **OS**: Linux (Ubuntu 20.04+, RHEL 8+, Debian 11+), macOS 12+
- **Bun**: 1.0+
- **Git**: 2.25+
- **Memory**: 4GB minimum, 8GB recommended
- **Storage**: 20GB available space
- **Network**: Stable internet for AI agent APIs

#### Installation Script
```bash
#!/bin/bash
# ralph-install.sh

# Update system (Ubuntu/Debian)
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y git curl unzip

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install AI agents
npm install -g @anthropic-ai/claude-code
npm install -g @google/gemini-cli
# Install Q following its documentation

# Clone Ralph TypeScript
git clone https://github.com/acazau/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts

# Install dependencies
bun install

# Set permissions
chmod +x src/cli.ts

# Create systemd service
sudo cp scripts/ralph.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ralph
```

### 2. Docker Deployment

#### Dockerfile
```dockerfile
FROM oven/bun:1 AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for npm global packages
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install AI CLI tools
RUN npm install -g @anthropic-ai/claude-code @google/gemini-cli

# Create ralph user
RUN useradd -m -s /bin/bash ralph
WORKDIR /home/ralph

# Copy application
COPY --chown=ralph:ralph . /home/ralph/ralph-orchestrator-ts/
WORKDIR /home/ralph/ralph-orchestrator-ts

# Install dependencies
RUN bun install --production

# Switch to ralph user
USER ralph

# Expose web dashboard port
EXPOSE 3000

# Default command
CMD ["bun", "run", "cli", "run"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  ralph:
    build: .
    container_name: ralph-orchestrator-ts
    restart: unless-stopped
    volumes:
      - ./workspace:/home/ralph/workspace
      - ./prompts:/home/ralph/prompts
      - ralph-agent:/home/ralph/ralph-orchestrator-ts/.agent
    environment:
      - RALPH_MAX_ITERATIONS=100
      - RALPH_AGENT=auto
      - RALPH_CHECKPOINT_INTERVAL=5
    ports:
      - "3000:3000"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  web:
    build: .
    container_name: ralph-web
    restart: unless-stopped
    command: ["bun", "run", "web"]
    ports:
      - "3000:3000"
    volumes:
      - ralph-agent:/home/ralph/ralph-orchestrator-ts/.agent
    depends_on:
      - ralph

volumes:
  ralph-agent:
```

### 3. Cloud Deployment

#### AWS EC2
```bash
#!/bin/bash
# User data script for EC2 instance

# Install dependencies
yum update -y
yum install -y git curl unzip

# Install Bun
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Install Ralph
cd /opt
git clone https://github.com/acazau/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts
bun install

# Configure as service
cat > /etc/systemd/system/ralph.service << EOF
[Unit]
Description=Ralph Orchestrator TypeScript
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/ralph-orchestrator-ts
ExecStart=/home/ec2-user/.bun/bin/bun run cli run
Restart=on-failure
RestartSec=10
Environment="PATH=/home/ec2-user/.bun/bin:/usr/local/bin:/usr/bin"

[Install]
WantedBy=multi-user.target
EOF

systemctl enable ralph
systemctl start ralph
```

#### Kubernetes Deployment
```yaml
# ralph-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ralph-orchestrator-ts
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ralph
  template:
    metadata:
      labels:
        app: ralph
    spec:
      containers:
      - name: ralph
        image: ralph-orchestrator-ts:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: config
          mountPath: /config
        env:
        - name: RALPH_MAX_ITERATIONS
          valueFrom:
            configMapKeyRef:
              name: ralph-config
              key: maxIterations
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: ralph-workspace
      - name: config
        configMap:
          name: ralph-config
---
apiVersion: v1
kind: Service
metadata:
  name: ralph-service
spec:
  selector:
    app: ralph
  ports:
  - port: 3000
    targetPort: 3000
  type: LoadBalancer
```

## Configuration Management

### Environment Variables
```bash
# /etc/environment or .env file
RALPH_HOME=/opt/ralph-orchestrator-ts
RALPH_WORKSPACE=/var/ralph/workspace
RALPH_LOG_LEVEL=INFO
RALPH_MAX_ITERATIONS=100
RALPH_MAX_RUNTIME=14400
RALPH_AGENT=claude
RALPH_CHECKPOINT_INTERVAL=5
RALPH_RETRY_DELAY=2
RALPH_GIT_ENABLED=true
RALPH_ARCHIVE_ENABLED=true
```

### Configuration File
```typescript
// config/production.ts
import type { RalphConfig } from '../src/types/index.ts';

export const productionConfig: Partial<RalphConfig> = {
  agent: 'claude',
  maxIterations: 100,
  maxRuntime: 14400,
  checkpointInterval: 5,
  retryDelay: 2,
  maxRetries: 5,
  gitCheckpoint: true,
  verbose: false,
  adapters: {
    claude: {
      timeout: 300000,
      retries: 3,
    },
    gemini: {
      timeout: 300000,
      retries: 3,
    },
    q: {
      timeout: 180000,
      retries: 3,
    },
  },
};
```

### JSON Configuration
```json
{
  "production": {
    "agent": "claude",
    "maxIterations": 100,
    "maxRuntime": 14400,
    "checkpointInterval": 5,
    "retryDelay": 2,
    "maxRetries": 5,
    "gitCheckpoint": true,
    "security": {
      "sandboxEnabled": true,
      "allowedDirectories": ["/workspace"],
      "forbiddenCommands": ["rm -rf", "sudo", "su"],
      "maxFileSize": 10485760
    }
  }
}
```

## Automation

### Systemd Service
```ini
# /etc/systemd/system/ralph.service
[Unit]
Description=Ralph Orchestrator TypeScript Service
Documentation=https://github.com/acazau/ralph-orchestrator-ts
After=network.target

[Service]
Type=simple
User=ralph
Group=ralph
WorkingDirectory=/opt/ralph-orchestrator-ts
ExecStart=/home/ralph/.bun/bin/bun run cli run --config production.json
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=30
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ralph
Environment="BUN_INSTALL=/home/ralph/.bun"
Environment="PATH=/home/ralph/.bun/bin:/usr/local/bin:/usr/bin"

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/ralph-orchestrator-ts /var/ralph

[Install]
WantedBy=multi-user.target
```

### Cron Jobs
```bash
# /etc/cron.d/ralph
# Clean old logs weekly
0 2 * * 0 ralph /opt/ralph-orchestrator-ts/scripts/cleanup.sh

# Backup state daily
0 3 * * * ralph tar -czf /backup/ralph-$(date +\%Y\%m\%d).tar.gz /opt/ralph-orchestrator-ts/.agent

# Health check every 5 minutes
*/5 * * * * ralph /opt/ralph-orchestrator-ts/scripts/health-check.sh || systemctl restart ralph
```

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy Ralph

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package.json'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun test
      - run: bun run typecheck

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t ralph-orchestrator-ts:${{ github.sha }} .

      - name: Push to registry
        run: |
          docker tag ralph-orchestrator-ts:${{ github.sha }} ${{ secrets.REGISTRY }}/ralph:latest
          docker push ${{ secrets.REGISTRY }}/ralph:latest

      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/ralph-orchestrator-ts
            git pull
            bun install
            systemctl restart ralph
```

## Monitoring in Production

### Prometheus Metrics Exporter
```typescript
// src/monitoring/prometheus.ts
import { Hono } from 'hono';

const app = new Hono();

// Metrics storage
let metrics = {
  ralph_iterations_total: 0,
  ralph_errors_total: 0,
  ralph_runtime_seconds: 0,
  ralph_cost_dollars: 0,
};

// Prometheus format endpoint
app.get('/metrics', (c) => {
  const output = Object.entries(metrics)
    .map(([key, value]) => `${key} ${value}`)
    .join('\n');

  return c.text(output, 200, {
    'Content-Type': 'text/plain; version=0.0.4',
  });
});

// Update metrics from state files
async function collectMetrics(): Promise<void> {
  const stateFile = Bun.file('.agent/metrics/state.json');

  if (await stateFile.exists()) {
    const state = await stateFile.json();
    metrics.ralph_iterations_total = state.iterations ?? 0;
    metrics.ralph_errors_total = state.errors ?? 0;
    metrics.ralph_runtime_seconds = (state.elapsedHours ?? 0) * 3600;
  }

  const costFile = Bun.file('.agent/metrics/costs.json');
  if (await costFile.exists()) {
    const costs = await costFile.json();
    metrics.ralph_cost_dollars = costs.totalCost ?? 0;
  }
}

// Start collector
setInterval(collectMetrics, 30000);

export default {
  port: 9090,
  fetch: app.fetch,
};
```

### Logging Setup
```typescript
// src/utils/production-logger.ts
import { createLogger } from './logger.ts';

interface LogEntry {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  module?: string;
  function?: string;
  extra?: Record<string, unknown>;
}

class JSONLogger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  private formatLog(level: string, message: string, extra?: Record<string, unknown>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      ...extra,
    };
    return JSON.stringify(entry);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    console.log(this.formatLog('INFO', message, extra));
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    console.warn(this.formatLog('WARN', message, extra));
  }

  error(message: string, extra?: Record<string, unknown>): void {
    console.error(this.formatLog('ERROR', message, extra));
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    if (process.env.RALPH_DEBUG) {
      console.debug(this.formatLog('DEBUG', message, extra));
    }
  }
}

export function createProductionLogger(name: string): JSONLogger {
  return new JSONLogger(name);
}
```

## Security Hardening

### User Isolation
```bash
# Create dedicated user
sudo useradd -r -s /bin/bash -m -d /opt/ralph ralph
sudo chown -R ralph:ralph /opt/ralph-orchestrator-ts

# Set restrictive permissions
chmod 750 /opt/ralph-orchestrator-ts
chmod 640 /opt/ralph-orchestrator-ts/src/*.ts
chmod 750 /opt/ralph-orchestrator-ts/src/cli.ts
```

### Network Security
```bash
# Firewall rules (iptables)
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT  # HTTPS for AI agents
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT   # Git SSH
iptables -A OUTPUT -j DROP                       # Block other outbound

# Or using ufw
ufw allow out 443/tcp
ufw allow out 22/tcp
ufw default deny outgoing
```

### API Key Management
```bash
# Use Bun's .env support
echo "ANTHROPIC_API_KEY=your-key" >> .env.production

# Or use system keyring (macOS)
security add-generic-password -a ralph -s anthropic_api_key -w "your-key"

# Retrieve in code
const apiKey = process.env.ANTHROPIC_API_KEY;
```

## Scaling Considerations

### Horizontal Scaling with Job Queue
```typescript
// src/queue/job-queue.ts

interface Job {
  id: string;
  promptFile: string;
  config: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
}

class JobQueue {
  private jobs: Job[] = [];
  private db: ReturnType<typeof import('bun:sqlite').Database>;

  constructor(dbPath: string = '.agent/jobs.db') {
    this.db = new (require('bun:sqlite').Database)(dbPath);
    this.initDB();
  }

  private initDB(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        promptFile TEXT,
        config TEXT,
        status TEXT,
        createdAt INTEGER
      )
    `);
  }

  addJob(promptFile: string, config: Record<string, unknown>): string {
    const job: Job = {
      id: crypto.randomUUID(),
      promptFile,
      config,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.db.run(
      'INSERT INTO jobs (id, promptFile, config, status, createdAt) VALUES (?, ?, ?, ?, ?)',
      [job.id, job.promptFile, JSON.stringify(job.config), job.status, job.createdAt]
    );

    return job.id;
  }

  getNextJob(): Job | null {
    const row = this.db.query(
      'SELECT * FROM jobs WHERE status = ? ORDER BY createdAt LIMIT 1'
    ).get('pending');

    if (row) {
      return {
        ...row,
        config: JSON.parse(row.config),
      } as Job;
    }
    return null;
  }

  updateJobStatus(id: string, status: Job['status']): void {
    this.db.run('UPDATE jobs SET status = ? WHERE id = ?', [status, id]);
  }
}

export { JobQueue, type Job };
```

### Resource Limits
```typescript
// src/utils/resource-limits.ts

// Note: Bun doesn't have direct resource limit APIs like Python's resource module
// Use process monitoring and external limits instead

interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuSeconds: number;
  maxFileSizeMB: number;
}

class ResourceMonitor {
  private limits: ResourceLimits;
  private startTime: number;

  constructor(limits: ResourceLimits) {
    this.limits = limits;
    this.startTime = Date.now();
  }

  async checkLimits(): Promise<{ ok: boolean; reason?: string }> {
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryMB = memUsage.heapUsed / 1024 / 1024;

    if (memoryMB > this.limits.maxMemoryMB) {
      return { ok: false, reason: `Memory limit exceeded: ${memoryMB.toFixed(0)}MB` };
    }

    // Check CPU time
    const cpuSeconds = (Date.now() - this.startTime) / 1000;
    if (cpuSeconds > this.limits.maxCpuSeconds) {
      return { ok: false, reason: `CPU time limit exceeded: ${cpuSeconds.toFixed(0)}s` };
    }

    return { ok: true };
  }
}

export { ResourceMonitor, type ResourceLimits };
```

## Backup and Recovery

### Automated Backups
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backup/ralph"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf $BACKUP_DIR/ralph_$TIMESTAMP.tar.gz \
    /opt/ralph-orchestrator-ts/.agent \
    /opt/ralph-orchestrator-ts/*.json \
    /opt/ralph-orchestrator-ts/PROMPT.md

# Keep only last 30 days
find $BACKUP_DIR -name "ralph_*.tar.gz" -mtime +30 -delete

# Sync to S3 (optional)
if command -v aws &> /dev/null; then
    aws s3 sync $BACKUP_DIR s3://my-bucket/ralph-backups/
fi
```

### Disaster Recovery
```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1
RESTORE_DIR="/opt/ralph-orchestrator-ts"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: restore.sh <backup-file>"
    exit 1
fi

# Stop service
systemctl stop ralph

# Restore backup
tar -xzf $BACKUP_FILE -C /

# Reset Git repository
cd $RESTORE_DIR
git reset --hard HEAD

# Reinstall dependencies
bun install

# Restart service
systemctl start ralph
```

## Health Checks

### HTTP Health Endpoint
```typescript
// src/web/health.ts
import { Hono } from 'hono';
import { Glob } from 'bun';

const app = new Hono();

app.get('/health', async (c) => {
  try {
    const checks: Record<string, string> = {};
    let status: 'healthy' | 'unhealthy' = 'healthy';

    // Check prompt file
    if (await Bun.file('PROMPT.md').exists()) {
      checks.promptFile = 'ok';
    } else {
      checks.promptFile = 'missing';
      status = 'unhealthy';
    }

    // Check agents
    for (const agent of ['claude', 'q', 'gemini']) {
      const proc = Bun.spawn(['which', agent], { stdout: 'pipe' });
      await proc.exited;
      checks[agent] = proc.exitCode === 0 ? 'available' : 'not found';
    }

    // Check state files
    const glob = new Glob('.agent/metrics/*.json');
    let stateFileCount = 0;
    for await (const _ of glob.scan('.')) {
      stateFileCount++;
    }
    checks.stateFiles = `${stateFileCount} files`;

    return c.json({ status, checks });
  } catch (error) {
    return c.json({ status: 'error', message: String(error) }, 500);
  }
});

export default app;
```

## Production Checklist

### Pre-Deployment
- [ ] All tests passing (`bun test`)
- [ ] TypeScript type checking (`bun run typecheck`)
- [ ] Configuration reviewed
- [ ] API keys secured
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Resource limits set
- [ ] Security hardening applied

### Deployment
- [ ] Service installed
- [ ] Permissions set correctly
- [ ] Logging configured
- [ ] Health checks working
- [ ] Metrics collection active
- [ ] Backup job scheduled

### Post-Deployment
- [ ] Service running
- [ ] Logs being generated
- [ ] Metrics visible
- [ ] Test job successful
- [ ] Alerts configured
- [ ] Documentation updated
