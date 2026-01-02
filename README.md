# ralph-orchestrator-ts

TypeScript/Bun port of [ralph-orchestrator](https://github.com/mikeyobrien/ralph-orchestrator) - an AI agent orchestration system that implements the Ralph Wiggum technique.

## Overview

Ralph Orchestrator puts AI agents in a continuous loop until a task is complete. The basic principle: give an AI agent a task prompt, let it iterate and self-correct, monitor for completion, and stop when done.

## Installation

```bash
# Clone the repository
git clone https://github.com/acazau/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts

# Install dependencies
bun install
```

## Quick Start

```bash
# Initialize a new project
bun run cli init

# Edit PROMPT.md with your task

# Run the orchestration loop
bun run cli run
```

## CLI Commands

```bash
# Run orchestration
ralph run [options]

# Initialize project
ralph init [--force]

# Check status
ralph status

# Clean workspace
ralph clean [--all]

# Show/generate prompt
ralph prompt [--show|--generate]
```

## Configuration

Create a `ralph.yml` file in your project root:

```yaml
agent: auto
prompt_file: PROMPT.md
max_iterations: 100
max_runtime: 14400
checkpoint_interval: 5
max_cost: 50.0
```

## CLI Options

```
-a, --agent <type>         AI agent (claude, q, gemini, acp, auto)
-P, --prompt <file>        Prompt file path
-p, --prompt-text <text>   Direct prompt text
-i, --max-iterations <n>   Maximum iterations
-t, --max-runtime <n>      Maximum runtime (seconds)
-c, --checkpoint <n>       Checkpoint interval
--max-cost <n>             Maximum cost (USD)
--no-git                   Disable git checkpointing
-v, --verbose              Verbose output
--config <file>            Config file path
```

## Web Dashboard

Start the web dashboard for monitoring and control:

```bash
# Start web server
bun run cli web

# With options
ralph web --port 3000 --hostname 0.0.0.0 --no-auth
```

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/status` - System status
- `GET /api/runs` - List runs
- `POST /api/runs` - Start new run
- `GET /api/runs/:id` - Get run details
- `POST /api/runs/:id/stop` - Stop a run
- `GET /api/stats` - Statistics

**WebSocket:** Connect to `/ws` for real-time updates.

**Authentication:** JWT-based. Default admin: `admin` / `admin123`

## Supported Adapters

- **Claude** - Anthropic Claude via Claude CLI
- **Gemini** - Google Gemini via Gemini CLI
- **Q Chat** - Amazon Q via Q CLI
- **ACP** - Agent Client Protocol (JSON-RPC)

## Features

- Multi-agent support with automatic fallback
- Git-based checkpointing
- Cost tracking and limits
- Loop detection
- Safety guards (iteration, runtime, cost limits)
- Per-iteration telemetry
- Task extraction from prompts

## Development

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Run in development mode
bun run dev

# Build
bun run build
```

## Project Structure

```
src/
├── index.ts           # Main exports
├── cli.ts             # CLI entry point
├── orchestrator.ts    # Core orchestration loop
├── config.ts          # Configuration
├── types/             # TypeScript types
├── adapters/          # AI agent adapters
├── metrics/           # Telemetry & cost tracking
├── safety/            # Safety guards
├── context/           # Context management
├── output/            # Output formatting
├── web/               # Web dashboard (Hono)
└── utils/             # Utilities
```

## License

MIT
