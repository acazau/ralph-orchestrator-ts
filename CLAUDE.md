# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ralph Orchestrator TypeScript is an AI agent orchestration system implementing the "Ralph Wiggum technique" - putting AI agents in a continuous loop until a task is complete. This is a TypeScript/Bun port of the original ralph-orchestrator Python project.

## Development Commands

### Building and Running
```bash
# Type check
bun run typecheck

# Lint code
bun run lint

# Format code
bun run format

# Build
bun run build
```

### Testing
```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Run specific test file
bun test tests/config.test.ts
```

### Running the CLI
```bash
# Development mode with auto-reload
bun run dev

# CLI commands
bun run cli run              # Run orchestration
bun run cli init             # Initialize project
bun run cli status           # Check status
bun run cli clean            # Clean workspace
bun run cli prompt           # Show/generate prompt
bun run cli web              # Start web dashboard
```

## Architecture Overview

### Core Orchestration Loop (src/orchestrator.ts)

The `RalphOrchestrator` class implements a continuous execution loop:

1. **Safety checks** - Validate iteration count, runtime, and cost limits before each iteration
2. **Completion detection** - Check for task completion markers in the context
3. **Agent execution** - Execute the AI agent with current prompt/context
4. **Metrics tracking** - Record cost, tokens, timing, and success/failure
5. **Checkpointing** - Create git commits at regular intervals for recovery
6. **Loop detection** - Identify and break infinite loops

Key design: The orchestrator runs until explicit stop conditions are met (max iterations, completion marker, cost limit, loop detection, or manual stop).

### Adapter System (src/adapters/)

The adapter layer provides a unified interface (`ToolAdapter`) for executing different AI agents:

- **ClaudeAdapter** - Uses Claude CLI (`claude` command)
- **GeminiAdapter** - Uses Gemini CLI (`gemini` command)
- **QChatAdapter** - Uses Amazon Q CLI (`q` command)
- **ACPAdapter** - Agent Communication Protocol (JSON-RPC over stdio)

Each adapter:
- Implements availability checking (command exists)
- Executes via `Bun.spawn()` subprocess
- Handles stdout/stderr capture
- Estimates costs based on token usage
- Supports optional file-based prompt input

Auto-detection (`autoDetectAdapter`) checks adapters in priority order and selects the first available.

### State Management

Ralph maintains state in `.agent/` directory:
```
.agent/
├── metrics/        # Performance and telemetry data
├── checkpoints/    # Git checkpoint markers
├── prompts/        # Archived prompt history
├── plans/          # Agent planning documents
├── cache/          # Context cache
└── workspace/      # Temporary working files
```

### Configuration (src/config.ts, src/types/config.ts)

Configuration is hierarchical with validation:
1. Default values (`CONFIG_DEFAULTS`)
2. YAML file (`ralph.yml`)
3. CLI arguments (highest priority)

Key validation rules:
- Iterations, runtime, cost must be non-negative
- Context threshold must be 0.0-1.0
- Warnings for unusual values (single iteration, very short timeout)

### Safety Guards (src/safety/)

The `SafetyGuard` class provides runtime protection:
- **Max iterations** - Prevents runaway loops
- **Max runtime** - Time-based limits
- **Max cost** - Budget enforcement
- **Loop detection** - Identifies repeated outputs (fuzzy string matching)
- **Consecutive failure tracking** - Circuit breaker for persistent errors

### Context Management (src/context/)

The `ContextManager` handles prompt construction:
- Loads prompt from file or direct text
- Maintains conversation history
- Detects completion markers (`DONE`, `COMPLETED`, etc.)
- Adds error feedback for failed iterations
- Manages context window limits

### Web Dashboard (src/web/)

Built with Hono framework:
- **Database** - SQLite for run history, users, sessions
- **Authentication** - JWT-based with bcrypt password hashing
- **Rate limiting** - Token bucket algorithm per IP
- **WebSocket** - Real-time updates via `/ws`
- **API routes** - RESTful endpoints for orchestrator control

Default admin credentials: `admin` / `admin123`

## Important Patterns

### Subprocess Execution

All AI agents run via `Bun.spawn()` with:
- Timeout handling
- stdout/stderr capture
- Exit code checking
- Environment variable passing

Example from `src/adapters/base.ts`:
```typescript
const proc = Bun.spawn(command, {
  cwd: options.cwd,
  env: { ...process.env, ...options.env },
  stdout: 'pipe',
  stderr: 'pipe',
});
```

### Error Handling and Retry

The orchestrator uses configurable retry with exponential backoff:
- Record failure in safety guard
- Set trigger reason to `RECOVERY`
- Retry delay between iterations
- Fallback adapters if primary fails

### Type Safety

TypeScript is used extensively:
- All configuration has strong types
- Enums for agent types, trigger reasons
- Interfaces for adapters, metrics, safety checks
- Type guards for validation

### Testing Strategy

Tests use Bun's native test runner:
- Unit tests for config, metrics, safety, context
- Adapter tests (with mocking for CLI commands)
- Web API tests (database, auth, routes)
- Setup file at `tests/setup.ts` for shared fixtures

## Key Constraints

1. **Bun Runtime** - This project requires Bun (not Node.js). Use Bun APIs where available.

2. **CLI Tool Dependencies** - Adapters expect external CLI tools (`claude`, `gemini`, `q`) to be installed and available in PATH.

3. **Git Integration** - Checkpointing requires a git repository. The orchestrator checks `isGitRepo()` before creating checkpoints.

4. **Prompt File** - Default is `PROMPT.md` in the working directory. Must exist unless `--prompt-text` is provided.

5. **Completion Markers** - The orchestrator looks for specific keywords in context to determine task completion. Agents should output these markers explicitly.

## Configuration Precedence

When working with configuration:
1. Start with `CONFIG_DEFAULTS` in `src/types/config.ts`
2. Merge with `ralph.yml` if present
3. Override with CLI args (highest priority)
4. Validate with `ConfigValidator`

## Web Dashboard Usage

To run the web dashboard:
```bash
bun run cli web --port 3000 --hostname 0.0.0.0
```

Key endpoints:
- `GET /health` - Health check
- `GET /api/status` - Current orchestrator state
- `POST /api/runs` - Start new orchestration run
- `GET /api/runs/:id` - Get run details
- `POST /api/runs/:id/stop` - Stop a run
- `WS /ws` - WebSocket for real-time updates

## Common Development Patterns

### Adding a New Adapter

1. Create adapter class extending `ToolAdapter` in `src/adapters/`
2. Implement required methods: `checkAvailability()`, `execute()`, `executeWithFile()`, `estimateCost()`
3. Add to factory in `src/adapters/index.ts`
4. Add enum value to `AgentType` in `src/types/config.ts`
5. Update auto-detection priority order if needed

### Adding Configuration Options

1. Add field to `RalphConfig` interface in `src/types/config.ts`
2. Add default value to `CONFIG_DEFAULTS`
3. Add validation method to `ConfigValidator` in `src/config.ts`
4. Update CLI option in `src/cli.ts`
5. Update `createConfigFromArgs()` mapping

### Adding Metrics

1. Add field to appropriate tracker (`MetricsTracker`, `CostTracker`, or `IterationStats`)
2. Update `toDict()` or `toSummary()` methods
3. Record metric at appropriate point in orchestration loop
4. Add to web API response if needed

## Biome Configuration

This project uses Biome for linting and formatting (not ESLint/Prettier). Configuration is in `biome.json` (if present) or package.json.

## SonarQube Operations (CRITICAL)

⚠️ **NEVER use curl or direct HTTP requests to the SonarQube API.** Always use the ADW scripts or delegate to subagents.

The project has specialized subagents and ADW scripts for all SonarQube-related tasks:

### Available Subagents

1. **docker-manager** (`.claude/agents/docker-manager.md`)
   - Manages SonarQube Docker container lifecycle
   - Start/stop containers, check health status
   - Use for: Container operations, health checks

2. **scan-executor** (`.claude/agents/scan-executor.md`)
   - Executes SonarQube code quality scans
   - Handles changed file detection, scanner execution
   - Use for: Running scans (changed or full mode)

3. **result-analyzer** (`.claude/agents/result-analyzer.md`)
   - Fetches and formats SonarQube scan results
   - Parses API responses, formats summaries
   - Use for: Fetching issues, analyzing results, generating reports

### When to Use Subagents

- **Fetching SonarQube issues**: Delegate to `result-analyzer`
- **Running SonarQube scans**: Delegate to `scan-executor`
- **Container management**: Delegate to `docker-manager`
- **Any curl commands to SonarQube API**: Delegate to `result-analyzer`

### How to Execute SonarQube Operations

**Option 1: Use ADW Scripts (Preferred)**

The `.adws/` directory contains scripts that implement the subagent logic:

```bash
# Fetch and display SonarQube results
bun run ./.adws/adw_sonar_results.ts

# Run a SonarQube scan
bun run ./.adws/adw_sonar_scan.ts

# Setup SonarQube container
bun run ./.adws/adw_sonar_setup.ts
```

**Option 2: Use Task Tool for Subagents (if available)**

If the Task tool is available, invoke subagents:
```
Task(agent: "result-analyzer", context: {...})
Task(agent: "scan-executor", context: {...})
Task(agent: "docker-manager", context: {...})
```

### ❌ DO NOT (Examples of what NOT to do)

```bash
# WRONG - Never do this:
curl -u admin:token http://localhost:9000/api/issues/search
curl http://localhost:9000/api/qualitygates/project_status
curl -X POST http://localhost:9000/api/...

# WRONG - Don't rely on cached JSON files:
cat .adws/scan_issues.json  # This file may be stale!
```

### ✅ DO (Correct approaches)

```bash
# Query live results with filters
bun run ./.adws/adw_sonar_results.ts --status=OPEN
bun run ./.adws/adw_sonar_results.ts --severity=CRITICAL,MAJOR
bun run ./.adws/adw_sonar_results.ts --format=json --status=OPEN

# Run scans
bun run ./.adws/adw_sonar_scan.ts full
bun run ./.adws/adw_sonar_scan.ts changed
```

### Query Tool Options

The `adw_sonar_results.ts` script supports live queries with filtering:

```bash
# Filter by status
bun run ./.adws/adw_sonar_results.ts --status=OPEN
bun run ./.adws/adw_sonar_results.ts --status=OPEN,CONFIRMED

# Filter by severity
bun run ./.adws/adw_sonar_results.ts --severity=CRITICAL,MAJOR

# Filter by type
bun run ./.adws/adw_sonar_results.ts --type=BUG,VULNERABILITY

# Filter by rule
bun run ./.adws/adw_sonar_results.ts --rule=typescript:S1135

# Filter by file
bun run ./.adws/adw_sonar_results.ts --file=src/orchestrator.ts

# Combine filters
bun run ./.adws/adw_sonar_results.ts --status=OPEN --severity=CRITICAL,MAJOR

# Query security hotspots
bun run ./.adws/adw_sonar_results.ts --hotspots

# Query hotspots needing review
bun run ./.adws/adw_sonar_results.ts --hotspots --hotspot-status=TO_REVIEW

# Get hotspots as JSON
bun run ./.adws/adw_sonar_results.ts --hotspots --format=json

# Query code duplications
bun run ./.adws/adw_sonar_results.ts --duplications

# Get duplications as JSON (includes line numbers and file references)
bun run ./.adws/adw_sonar_results.ts --duplications --format=json

# Output formats
bun run ./.adws/adw_sonar_results.ts --format=json     # JSON for scripting
bun run ./.adws/adw_sonar_results.ts --format=summary  # Summary metrics only
bun run ./.adws/adw_sonar_results.ts --format=table    # Default table view

# Limit results
bun run ./.adws/adw_sonar_results.ts --limit=10
```

### ADW Scripts Available

| Script | Purpose |
|--------|---------|
| `.adws/adw_sonar_results.ts` | Live query tool - fetch issues, hotspots, and duplications |
| `.adws/adw_sonar_scan.ts` | Execute SonarQube scans (changed or full mode) |
| `.adws/adw_sonar_setup.ts` | Setup/start SonarQube Docker container |
