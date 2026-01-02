# Docker Deployment Guide

Deploy Ralph Orchestrator TypeScript using Docker for consistent, reproducible environments.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ (optional, for multi-container setups)
- At least one AI CLI tool API key configured
- 2GB RAM minimum, 4GB recommended
- 10GB disk space for images and data

## Quick Start

### Using Pre-built Image

```bash
# Pull the latest image
docker pull ghcr.io/acazau/ralph-orchestrator-ts:latest

# Run with default settings
docker run -it \
  -v $(pwd):/workspace \
  -e CLAUDE_API_KEY=$CLAUDE_API_KEY \
  ghcr.io/acazau/ralph-orchestrator-ts:latest
```

### Building from Source

Create a `Dockerfile` in your project root:

```dockerfile
# Multi-stage build for optimal size
FROM oven/bun:1-alpine as builder

# Install build dependencies
RUN apk add --no-cache git

# Copy package files
WORKDIR /build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun build ./src/index.ts --outdir ./dist --target bun

# Runtime stage
FROM oven/bun:1-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    nodejs \
    npm

# Install AI CLI tools
RUN npm install -g @anthropic-ai/claude-code
RUN npm install -g @google/gemini-cli

# Copy application
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Entry point
ENTRYPOINT ["bun", "run", "/app/dist/index.js"]
CMD ["--help"]
```

Build and run:

```bash
# Build the image
docker build -t ralph-orchestrator-ts:local .

# Run with your prompt
docker run -it \
  -v $(pwd):/workspace \
  -e CLAUDE_API_KEY=$CLAUDE_API_KEY \
  ralph-orchestrator-ts:local \
  --agent claude \
  --prompt PROMPT.md
```

## Docker Compose Setup

For complex deployments with multiple services:

```yaml
# docker-compose.yml
version: '3.8'

services:
  ralph:
    image: ghcr.io/acazau/ralph-orchestrator-ts:latest
    container_name: ralph-orchestrator-ts
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - Q_API_KEY=${Q_API_KEY}
      - RALPH_MAX_ITERATIONS=100
      - RALPH_MAX_RUNTIME=14400
    volumes:
      - ./workspace:/workspace
      - ./prompts:/prompts:ro
      - ralph-cache:/app/.cache
    networks:
      - ralph-network
    restart: unless-stopped
    command:
      - --agent=auto
      - --prompt=/prompts/PROMPT.md
      - --verbose

  # Optional: Monitoring with Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: ralph-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - ralph-network
    ports:
      - "9090:9090"

  # Optional: Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: ralph-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/dashboards:/etc/grafana/provisioning/dashboards
    networks:
      - ralph-network
    ports:
      - "3000:3000"

volumes:
  ralph-cache:
  prometheus-data:
  grafana-data:

networks:
  ralph-network:
    driver: bridge
```

Start the stack:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f ralph

# Stop all services
docker-compose down
```

## Environment Variables

Configure Ralph through environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_API_KEY` | Anthropic Claude API key | Required for Claude |
| `GEMINI_API_KEY` | Google Gemini API key | Required for Gemini |
| `Q_API_KEY` | Q Chat API key | Required for Q |
| `RALPH_AGENT` | Default agent (claude/gemini/q/auto) | auto |
| `RALPH_MAX_ITERATIONS` | Maximum loop iterations | 100 |
| `RALPH_MAX_RUNTIME` | Maximum runtime in seconds | 14400 |
| `RALPH_MAX_TOKENS` | Maximum total tokens | 1000000 |
| `RALPH_MAX_COST` | Maximum cost in USD | 50.0 |
| `RALPH_CHECKPOINT_INTERVAL` | Git checkpoint frequency | 5 |
| `RALPH_VERBOSE` | Enable verbose logging | false |
| `RALPH_DRY_RUN` | Test mode without execution | false |

## Volume Mounts

Essential directories to mount:

```bash
docker run -it \
  -v $(pwd)/workspace:/workspace \           # Working directory
  -v $(pwd)/prompts:/prompts:ro \           # Prompt files (read-only)
  -v $(pwd)/.agent:/app/.agent \            # Agent state
  -v $(pwd)/.git:/workspace/.git \          # Git repository
  -v ~/.ssh:/root/.ssh:ro \                 # SSH keys (if needed)
  ralph-orchestrator-ts:latest
```

## Security Considerations

### Running as Non-Root User

```dockerfile
# Add to Dockerfile
RUN adduser -D -u 1000 ralph
USER ralph
```

```bash
# Run with user mapping
docker run -it \
  --user $(id -u):$(id -g) \
  -v $(pwd):/workspace \
  ralph-orchestrator-ts:latest
```

### Secrets Management

Never hardcode API keys. Use Docker secrets or environment files:

```bash
# .env file (add to .gitignore!)
CLAUDE_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
Q_API_KEY=...

# Run with env file
docker run -it \
  --env-file .env \
  -v $(pwd):/workspace \
  ralph-orchestrator-ts:latest
```

### Network Isolation

```bash
# Create isolated network
docker network create ralph-isolated

# Run with network isolation
docker run -it \
  --network ralph-isolated \
  --network-alias ralph \
  -v $(pwd):/workspace \
  ralph-orchestrator-ts:latest
```

## Resource Limits

Prevent runaway containers:

```bash
docker run -it \
  --memory="4g" \
  --memory-swap="4g" \
  --cpu-shares=512 \
  --pids-limit=100 \
  -v $(pwd):/workspace \
  ralph-orchestrator-ts:latest
```

## Health Checks

Add health monitoring:

```dockerfile
# Add to Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD bun --version || exit 1
```

## Debugging

### Interactive Shell

```bash
# Start with shell instead of ralph
docker run -it \
  -v $(pwd):/workspace \
  --entrypoint /bin/sh \
  ralph-orchestrator-ts:latest

# Inside container
bun run /app/dist/index.js --dry-run
```

### View Logs

```bash
# Follow container logs
docker logs -f <container-id>

# Save logs to file
docker logs <container-id> > ralph.log 2>&1
```

### Inspect Running Container

```bash
# Execute commands in running container
docker exec -it <container-id> /bin/sh

# Check process status
docker exec <container-id> ps aux

# View environment
docker exec <container-id> env
```

## Production Deployment

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Create secrets
echo $CLAUDE_API_KEY | docker secret create claude_key -
echo $GEMINI_API_KEY | docker secret create gemini_key -

# Deploy stack
docker stack deploy -c docker-compose.yml ralph-stack

# Scale service
docker service scale ralph-stack_ralph=3
```

### Using Kubernetes

See [Kubernetes Deployment Guide](kubernetes.md) for container orchestration at scale.

## Monitoring and Metrics

### Export Metrics

```typescript
// Enable metrics in config
docker run -it \
  -e RALPH_ENABLE_METRICS=true \
  -e RALPH_METRICS_PORT=8080 \
  -p 8080:8080 \
  ralph-orchestrator-ts:latest
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ralph'
    static_configs:
      - targets: ['ralph:8080']
    metrics_path: '/metrics'
```

## Troubleshooting

### Common Issues

#### Permission Denied

```bash
# Fix volume permissions
docker run -it \
  --user $(id -u):$(id -g) \
  -v $(pwd):/workspace:Z \  # SELinux context
  ralph-orchestrator-ts:latest
```

#### Out of Memory

```bash
# Increase memory limit
docker run -it \
  --memory="8g" \
  --memory-swap="8g" \
  ralph-orchestrator-ts:latest
```

#### Network Timeouts

```bash
# Increase timeout values
docker run -it \
  -e RALPH_RETRY_DELAY=5 \
  -e RALPH_MAX_RETRIES=10 \
  ralph-orchestrator-ts:latest
```

### Debug Mode

```bash
# Enable debug logging
docker run -it \
  -e LOG_LEVEL=DEBUG \
  -e RALPH_VERBOSE=true \
  ralph-orchestrator-ts:latest \
  --verbose --dry-run
```

## Best Practices

1. **Always use specific image tags** in production (not `latest`)
2. **Mount prompts as read-only** to prevent accidental modification
3. **Use .dockerignore** to exclude unnecessary files
4. **Implement health checks** for automatic recovery
5. **Set resource limits** to prevent resource exhaustion
6. **Use multi-stage builds** to minimize image size
7. **Scan images for vulnerabilities** with tools like Trivy
8. **Never commit secrets** to version control
9. **Use volume mounts** for persistent data
10. **Monitor container logs** and metrics

## Example .dockerignore

```
# .dockerignore
.git
.github
node_modules
*.log
.env
.env.*
dist/
coverage/
tests/
*.md
!README.md
```

## Next Steps

- [Kubernetes Deployment](kubernetes.md) - For container orchestration
- [CI/CD Integration](ci-cd.md) - Automate Docker builds
- [Production Guide](production.md) - Best practices for production
