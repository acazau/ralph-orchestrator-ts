# Web Monitoring Quick Start

Get the Ralph Orchestrator web monitoring dashboard up and running in 5 minutes.

## 1. Start the Web Server

### Option A: Using the CLI

```bash
# Start the web server with default settings
bun run cli web

# Or with custom port
bun run cli web --port 8080

# With authentication enabled
bun run cli web --auth
```

### Option B: Standalone TypeScript Script

Create `start-web.ts`:

```typescript
#!/usr/bin/env bun
import { WebMonitor } from './src/web/server.js';

async function main() {
  // Create and start the web server
  const monitor = new WebMonitor({
    host: '0.0.0.0',
    port: 8000,
    enableAuth: false  // Disable auth for quick testing
  });

  console.log('🚀 Web server starting at http://localhost:8000');
  console.log('📊 Dashboard will open automatically...');

  await monitor.run();
}

main();
```

Run it:
```bash
bun run start-web.ts
```

### Option C: Integrated with Orchestrator

```typescript
#!/usr/bin/env bun
import { RalphOrchestrator } from './src/orchestrator.js';
import { WebMonitor } from './src/web/server.js';

async function main() {
  // Start web monitor
  const monitor = new WebMonitor({
    host: '0.0.0.0',
    port: 8000,
    enableAuth: false
  });

  const monitorTask = monitor.run();

  // Run orchestrator with web monitoring
  const orchestrator = new RalphOrchestrator({
    agentName: 'claude',
    promptFile: 'PROMPT.md',
    webMonitor: monitor
  });

  console.log(`🌐 Web dashboard: http://localhost:8000`);
  console.log(`🤖 Starting orchestrator with ${orchestrator.agentName}`);

  // Run orchestrator
  await orchestrator.run();
}

main();
```

## 2. Access the Dashboard

Open your browser to: **http://localhost:8000**

You'll see:
- 📊 **System Metrics**: CPU, memory, and process count
- 🤖 **Active Orchestrators**: Running tasks and status
- 📝 **Live Logs**: Real-time agent output
- 📜 **History**: Previous execution runs

## 3. Enable Authentication (Production)

For production deployments, enable authentication:

```bash
# Set environment variables
export RALPH_WEB_SECRET_KEY="your-secret-key-minimum-32-chars"
export RALPH_WEB_USERNAME="admin"
export RALPH_WEB_PASSWORD="secure-password-here"

# Start with authentication enabled
bun run cli web --auth
```

Or in code:
```typescript
const monitor = new WebMonitor({
  host: '0.0.0.0',
  port: 8000,
  enableAuth: true,  // Enable authentication
  secretKey: process.env.RALPH_WEB_SECRET_KEY,
  username: process.env.RALPH_WEB_USERNAME,
  password: process.env.RALPH_WEB_PASSWORD
});
```

## 4. Monitor Your Orchestrators

### View Task Progress
Click the **Tasks** button on any orchestrator card to see:
- Current task being executed
- Pending tasks in queue
- Completed tasks with timing

### Control Execution
- **Pause**: Temporarily stop orchestrator
- **Resume**: Continue execution
- **Edit Prompt**: Modify task on-the-fly

### Check System Health
The metrics panel updates every 5 seconds showing:
- CPU usage percentage
- Memory usage (used/total)
- Number of active processes

## 5. Common Commands

### Check if web server is running
```bash
curl http://localhost:8000/api/status
```

### View active orchestrators
```bash
curl http://localhost:8000/api/orchestrators
```

### Get system metrics
```bash
curl http://localhost:8000/api/metrics
```

## 6. Docker Quick Start

```dockerfile
# Dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 8000
CMD ["bun", "run", "cli", "web", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t ralph-web .
docker run -p 8000:8000 ralph-web
```

## 7. Troubleshooting

### Port already in use
```bash
# Find process using port 8000
lsof -i :8000
# Or use a different port
bun run cli web --port 8080
```

### Can't connect to dashboard
```bash
# Check if server is running
ps aux | grep bun
# Check firewall settings
sudo ufw allow 8000
```

### WebSocket disconnecting
- Check browser console for errors
- Ensure no proxy is blocking WebSocket
- Try disabling authentication for testing

## Next Steps

- 📖 Read the [full web monitoring guide](./web-monitoring.md)
- 🔒 Configure [authentication and security](./web-monitoring.md#security-considerations)
- 🚀 Deploy to [production](./web-monitoring.md#production-deployment)
- 📊 Explore the [API endpoints](./web-monitoring.md#api-endpoints)
