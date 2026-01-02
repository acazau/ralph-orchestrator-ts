# Web Monitoring Dashboard

The Ralph Orchestrator includes a powerful web-based monitoring dashboard that provides real-time visibility into agent execution, task progress, and system health metrics. This guide covers everything you need to know about setting up, running, and using the web monitoring interface.

## Features

### Core Capabilities

- **Real-time Monitoring**: Live updates via WebSocket connection with automatic reconnection
- **Orchestrator Management**: View active orchestrators, pause/resume execution, and monitor status
- **Task Queue Visualization**: See current, pending, and completed tasks with progress indicators
- **System Metrics**: CPU, memory, and process monitoring with live updates
- **Execution History**: Persistent storage of run history in SQLite database
- **Authentication**: JWT-based authentication with configurable security
- **Prompt Editing**: Real-time prompt editing capability that takes effect on next iteration
- **Dark/Light Theme**: Toggle between themes with preference persistence
- **Responsive Design**: Works on screens from 320px to 4K displays

### Security Features

- JWT token-based authentication with password hashing
- Configurable authentication (can be disabled for local use)
- Admin-only endpoints for user management
- Automatic token refresh on unauthorized responses
- Environment variable configuration for production deployments

## Installation & Setup

### Prerequisites

The web monitoring dashboard is included with the Ralph Orchestrator installation. Ensure you have:

```bash
# Ralph Orchestrator installed
bun install

# Required packages (automatically installed)
# - hono (web framework)
# - jose (JWT handling)
# - systeminformation (system metrics)
```

### Configuration

The web server can be configured through environment variables:

```bash
# Authentication settings
export RALPH_WEB_SECRET_KEY="your-secret-key-here"  # JWT signing key
export RALPH_WEB_USERNAME="admin"                    # Default username
export RALPH_WEB_PASSWORD="your-secure-password"     # Default password

# Server settings
export RALPH_WEB_HOST="0.0.0.0"                     # Host to bind to
export RALPH_WEB_PORT="8000"                        # Port to listen on
export RALPH_WEB_ENABLE_AUTH="true"                 # Enable/disable authentication

# Database settings
export RALPH_WEB_DB_PATH="~/.ralph/history.db"      # SQLite database path
```

## Starting the Web Server

### Method 1: Using the CLI

```bash
# Start the web server
bun run web

# Or with the CLI
bun run src/cli.ts web --port 8000
```

### Method 2: Standalone TypeScript Script

Create `start_web.ts`:

```typescript
import { WebMonitor } from './src/web';

// Start the web server
const monitor = new WebMonitor({
  host: '0.0.0.0',
  port: 8000,
  enableAuth: true, // Set to false for local development
});

console.log('Starting web server at http://localhost:8000');
await monitor.start();
```

Run it:
```bash
bun run start_web.ts
```

### Method 3: With Orchestrator Integration

```typescript
import { RalphOrchestrator } from './src/orchestrator';
import { WebMonitor } from './src/web';

// Start web monitor
const monitor = new WebMonitor({ host: '0.0.0.0', port: 8000 });
await monitor.start();

// Create and register an orchestrator
const orchestrator = new RalphOrchestrator({
  agent: 'claude',
  promptFile: 'PROMPT.md',
  webMonitor: monitor, // Pass monitor instance
});

// The orchestrator will automatically register with the monitor
await orchestrator.run();
```

### Method 4: Command Line

```bash
# Start web server only
bun run src/cli.ts web --host 0.0.0.0 --port 8000

# Start orchestrator with web server
bun run src/cli.ts run --web --web-port 8000
```

## Accessing the Dashboard

### Initial Login

1. Navigate to `http://localhost:8000` in your web browser
2. You'll be redirected to the login page
3. Enter credentials:
   - Default username: `admin`
   - Default password: `ralph-admin-2024`
   - Or use your configured environment variables

### Dashboard Overview

The main dashboard consists of several sections:

#### Header Bar
- **Connection Status**: Shows WebSocket connection state (connected/disconnected)
- **Username Display**: Shows logged-in user
- **Theme Toggle**: Switch between dark and light themes
- **Logout Button**: End current session

#### System Metrics Panel
- **CPU Usage**: Real-time CPU utilization percentage
- **Memory Usage**: Current memory usage and total available
- **Active Processes**: Number of running processes
- **Updates**: Refreshes every 5 seconds

#### Orchestrator Cards
Each active orchestrator displays:
- **ID and Agent Type**: Unique identifier and AI agent being used
- **Status Badge**: Running, Paused, Completed, or Failed
- **Current Iteration**: Progress through task iterations
- **Runtime**: Total execution time
- **Task Queue**: Inline view of current task with progress
- **Control Buttons**:
  - **Pause/Resume**: Control orchestrator execution
  - **Tasks**: View detailed task queue
  - **Edit Prompt**: Modify prompt in real-time
  - **View Details**: (Future) Detailed orchestrator view

#### Live Logs Panel
- **Real-time Output**: Shows agent output and system messages
- **Pause/Resume**: Control log auto-scrolling
- **Clear**: Clear current log display
- **Severity Indicators**: Color-coded by message type

#### Execution History Table
- **Recent Runs**: Shows last 10 completed runs
- **Run Details**: Start time, duration, iterations, final status
- **Database Persistence**: Survives server restarts

## API Endpoints

The web server provides a comprehensive REST API:

### Authentication Endpoints

```http
POST /api/auth/login
Content-Type: application/json
{
  "username": "admin",
  "password": "your-password"
}

Response:
{
  "accessToken": "eyJ...",
  "tokenType": "bearer"
}
```

```http
GET /api/auth/verify
Authorization: Bearer <token>

Response:
{
  "valid": true,
  "username": "admin"
}
```

### Monitoring Endpoints

```http
GET /api/status
Authorization: Bearer <token>

Response:
{
  "status": "running",
  "orchestrators": 2,
  "version": "1.0.0"
}
```

```http
GET /api/orchestrators
Authorization: Bearer <token>

Response:
[
  {
    "id": "orch_abc123",
    "agent": "claude",
    "status": "running",
    "iteration": 5,
    "startTime": "2024-01-01T00:00:00Z"
  }
]
```

```http
GET /api/orchestrators/{id}/tasks
Authorization: Bearer <token>

Response:
{
  "currentTask": {
    "content": "Implement authentication",
    "status": "in_progress",
    "startTime": "2024-01-01T00:00:00Z"
  },
  "queue": [...],
  "completed": [...]
}
```

### Control Endpoints

```http
POST /api/orchestrators/{id}/pause
Authorization: Bearer <token>
```

```http
POST /api/orchestrators/{id}/resume
Authorization: Bearer <token>
```

### Prompt Management

```http
GET /api/orchestrators/{id}/prompt
Authorization: Bearer <token>

Response:
{
  "content": "# Task: ...",
  "path": "/path/to/PROMPT.md",
  "lastModified": "2024-01-01T00:00:00Z"
}
```

```http
POST /api/orchestrators/{id}/prompt
Authorization: Bearer <token>
Content-Type: application/json
{
  "content": "# Updated Task: ..."
}
```

### WebSocket Connection

```typescript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token',
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle updates: orchestrator_update, metrics_update, log_message
};
```

## Database Schema

The web server uses SQLite for persistent storage:

### Tables

#### orchestrator_runs
```sql
CREATE TABLE orchestrator_runs (
    run_id TEXT PRIMARY KEY,
    orchestrator_id TEXT NOT NULL,
    agent_name TEXT,
    prompt_path TEXT,
    start_time REAL NOT NULL,
    end_time REAL,
    status TEXT NOT NULL,
    total_iterations INTEGER DEFAULT 0,
    final_error TEXT,
    metadata TEXT
);
```

#### iteration_history
```sql
CREATE TABLE iteration_history (
    iteration_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    iteration_number INTEGER NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL,
    status TEXT NOT NULL,
    agent_output TEXT,
    error_message TEXT,
    metrics TEXT,
    FOREIGN KEY (run_id) REFERENCES orchestrator_runs(run_id)
);
```

#### task_history
```sql
CREATE TABLE task_history (
    task_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    task_content TEXT NOT NULL,
    status TEXT NOT NULL,
    start_time REAL,
    end_time REAL,
    iteration_completed INTEGER,
    FOREIGN KEY (run_id) REFERENCES orchestrator_runs(run_id)
);
```

### Database Location

By default, the database is stored at `~/.ralph/history.db`. You can query it directly:

```bash
sqlite3 ~/.ralph/history.db "SELECT * FROM orchestrator_runs ORDER BY start_time DESC LIMIT 10;"
```

## Production Deployment

### Using Docker

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application
COPY . .

# Set environment variables
ENV RALPH_WEB_HOST=0.0.0.0
ENV RALPH_WEB_PORT=8000
ENV RALPH_WEB_ENABLE_AUTH=true

# Expose port
EXPOSE 8000

# Run the web server
CMD ["bun", "run", "web"]
```

### Using systemd

Create `/etc/systemd/system/ralph-web.service`:

```ini
[Unit]
Description=Ralph Orchestrator Web Monitor
After=network.target

[Service]
Type=simple
User=ralph
WorkingDirectory=/opt/ralph-orchestrator-ts
Environment="RALPH_WEB_SECRET_KEY=your-secret-key"
Environment="RALPH_WEB_USERNAME=admin"
Environment="RALPH_WEB_PASSWORD=secure-password"
ExecStart=/usr/local/bin/bun run web
Restart=always

[Install]
WantedBy=multi-user.target
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name ralph.example.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

## Troubleshooting

### Common Issues

#### WebSocket Connection Fails
```typescript
// Check browser console for errors
// Ensure authentication token is valid
// Verify CORS settings if running on different port
```

#### Authentication Issues
```bash
# Reset to default credentials
unset RALPH_WEB_USERNAME
unset RALPH_WEB_PASSWORD
# Default: admin / ralph-admin-2024
```

#### Database Errors
```bash
# Check database permissions
ls -la ~/.ralph/history.db

# Reset database if corrupted
rm ~/.ralph/history.db
# Will be recreated on next start
```

#### Performance Issues
```typescript
// Increase WebSocket ping interval
const monitor = new WebMonitor({
  wsPingInterval: 60, // Default is 30
  metricsInterval: 10, // Default is 5
});
```

### Debug Mode

Enable detailed logging:

```typescript
import { WebMonitor } from './src/web';

const monitor = new WebMonitor({
  debug: true,
  verbose: true,
});
```

## Security Considerations

### Production Checklist

- [ ] Change default credentials
- [ ] Use strong JWT secret key (minimum 32 characters)
- [ ] Enable HTTPS in production
- [ ] Configure firewall rules
- [ ] Implement rate limiting
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Backup database regularly

### Environment Variables

Never commit credentials to version control. Use a `.env` file:

```bash
# .env (add to .gitignore)
RALPH_WEB_SECRET_KEY=your-very-long-secret-key-here
RALPH_WEB_USERNAME=admin
RALPH_WEB_PASSWORD=super-secure-password-2024
```

## API Rate Limiting

The web server includes built-in rate limiting:

```typescript
import { WebMonitor } from './src/web';

const monitor = new WebMonitor({
  rateLimitEnabled: true,
  rateLimitRequests: 100, // Requests per minute
  rateLimitWindow: 60,    // Window in seconds
});
```

## Extending the Dashboard

### Custom Metrics

Add custom metrics to the dashboard:

```typescript
// In your orchestrator
await monitor.sendMetric('customMetric', {
  value: 42,
  label: 'Custom Metric',
  unit: 'items',
});
```

### Custom API Endpoints

Extend the web server with custom endpoints using Hono:

```typescript
import { Hono } from 'hono';
import { WebMonitor } from './src/web';

const monitor = new WebMonitor({ port: 8000 });

// Add custom routes
monitor.app.get('/api/custom/endpoint', (c) => {
  return c.json({ message: 'Custom response' });
});

await monitor.start();
```

## Support

For issues, questions, or feature requests:

- **GitHub Issues**: [Report bugs or request features](https://github.com/acazau/ralph-orchestrator-ts/issues)
- **Documentation**: [Full documentation](https://github.com/acazau/ralph-orchestrator-ts)

## Version History

- **v1.0.0**: Initial web monitoring dashboard
  - Real-time monitoring via WebSocket
  - JWT authentication
  - SQLite persistence
  - Task queue visualization
  - Prompt editing capability
  - Responsive design
