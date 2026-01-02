# SonarQube Scanning for Ralph Orchestrator

This directory contains the SonarQube scanning sub-agent system for Ralph Orchestrator, built using the Claude Agent SDK following the ADW (AI Developer Workflows) pattern.

## Overview

The SonarQube scanning system provides automatic code quality scanning integrated with Ralph's orchestration loop. It can scan changed files incrementally or perform full project scans, with results viewable in a local SonarQube instance.

## Architecture

The system follows a modular ADW architecture with the following components:

```
.adws/
├── adw_modules/              # Reusable modules
│   ├── agent.ts              # Claude Agent SDK execution
│   ├── data_types.ts         # Type definitions
│   ├── docker_ops.ts         # Docker container management
│   ├── result_parser.ts      # Results parsing and formatting
│   ├── scan_ops.ts           # Scan execution
│   ├── serialization.ts      # Message serialization
│   ├── sonarqube_ops.ts      # SonarQube API client
│   └── utils.ts              # Utility functions
├── adw_sonar_scan.ts         # CLI: Execute scans
├── adw_sonar_setup.ts        # CLI: Initial setup
└── agents/                   # Per-run outputs and state
    └── {adw_id}/
        ├── sonar-scanner/
        │   ├── cc_raw_output.jsonl
        │   ├── cc_raw_output.json
        │   ├── cc_final_object.json
        │   ├── scan_results.json
        │   └── scan_report.md
        └── adw_state.json
```

## Quick Start

### 1. Initial Setup

Run the setup script to initialize SonarQube:

```bash
bun run ./.adws/adw_sonar_setup.ts
```

This will:
- Start a SonarQube Docker container
- Wait for it to become healthy
- Guide you through token generation
- Create configuration file at `~/.ralph/sonarqube/config.yml`

### 2. Manual Scans

Execute scans manually:

```bash
# Scan changed files only (incremental)
bun run ./.adws/adw_sonar_scan.ts changed

# Scan entire project (full)
bun run ./.adws/adw_sonar_scan.ts full
```

After scanning, results are automatically fetched and displayed. You can also view them separately:

```bash
# View latest scan results
bun run ./.adws/adw_sonar_results.ts
```

Results include:
- Quality gate status and metrics
- Top 10 high-priority issues with file locations
- Structured JSON output at `.adws/scan_issues.json`

### 3. Automatic Scans with Ralph

Configure automatic scanning in `ralph.yml`:

```yaml
sonarqube:
  enabled: true
  autoStart: false
  scanOnCheckpoint: true        # Scan after git checkpoints
  scanAfterIteration: false     # Scan after each iteration
  scanMode: changed             # 'changed' or 'full'
  failOnQualityGate: false      # Halt on quality gate failure
```

Then run Ralph normally:

```bash
bun run cli run
```

## Configuration

### Global Configuration (Connection Details)

Location: `~/.config/sonarqube/config.yml`

```yaml
sonarqube:
  url: http://localhost:9000
  token: your-generated-token-here

  container:
    name: ralph-sonarqube
    image: sonarqube:community
    port: 9000
```

### Project Configuration (Scan Settings)

Location: `sonar-project.properties` (in project root)

```properties
sonar.projectKey=ralph-orchestrator-ts
sonar.projectName=Ralph Orchestrator TypeScript
sonar.sources=.
sonar.sourceEncoding=UTF-8

sonar.exclusions=\
  node_modules/**,\
  .git/**,\
  dist/**,\
  build/**,\
  coverage/**,\
  .adws/agents/**,\
  .agent/**,\
  **/*.test.ts,\
  **/*.spec.ts,\
  **/test/**,\
  **/tests/**
```

### Ralph Configuration

Add to `ralph.yml`:

```yaml
# SonarQube Integration
sonarqube:
  enabled: true                 # Enable/disable scanning
  autoStart: false              # Auto-start container (not yet implemented)
  scanOnCheckpoint: true        # Scan after git checkpoints
  scanAfterIteration: false     # Scan after each iteration
  scanMode: changed             # 'changed' (incremental) or 'full'
  failOnQualityGate: false      # Halt orchestration on quality gate failure
```

## Scan Modes

### Changed Mode (Incremental)

Scans only files that have been modified or added since the last commit:

```bash
bun run ./.adws/adw_sonar_scan.ts changed
```

**Use when:**
- Making iterative changes
- Running frequent scans
- Faster feedback needed

**Limitations:**
- May miss issues in unchanged files
- Historical issues not re-scanned

### Full Mode (Complete)

Scans the entire project:

```bash
bun run ./.adws/adw_sonar_scan.ts full
```

**Use when:**
- Initial project setup
- Major refactoring
- Comprehensive audit needed
- Before releases

## Docker Container Management

### Start Container

```bash
docker start ralph-sonarqube
```

Or use the setup script:
```bash
bun run ./.adws/adw_sonar_setup.ts
```

### Stop Container

```bash
docker stop ralph-sonarqube
```

### View Logs

```bash
docker logs ralph-sonarqube --tail 100
```

### Remove Container

```bash
docker rm -f ralph-sonarqube
docker volume rm sonarqube_data sonarqube_logs sonarqube_extensions
```

## Accessing Results

### SonarQube Dashboard

Open in browser: http://localhost:9000

Default credentials (change on first login):
- Username: `admin`
- Password: `admin`

### Structured Issue Data

All issues are saved to `.adws/scan_issues.json` for programmatic consumption:

```json
{
  "summary": {
    "projectKey": "ralph-orchestrator-ts",
    "qualityGate": "OK",
    "bugs": 0,
    "vulnerabilities": 0,
    "codeSmells": 73,
    "securityHotspots": 3,
    "totalIssues": 73,
    "dashboardUrl": "http://localhost:9000/..."
  },
  "issues": [
    {
      "key": "issue-uuid",
      "severity": "CRITICAL",
      "type": "CODE_SMELL",
      "rule": "typescript:S3776",
      "message": "Refactor to reduce complexity...",
      "file": "src/orchestrator.ts",
      "line": 134,
      "status": "OPEN"
    }
  ]
}
```

**Use this file to:**
- Filter issues by severity (CRITICAL, MAJOR, etc.)
- Process issues programmatically
- Track progress over multiple scans
- Integrate with CI/CD pipelines

### Command Line Output

The results viewer displays:

```
============================================================
SonarQube Scan Summary
============================================================

Status: ✓ SUCCESS
Quality Gate: ✓ PASSED

Issues:
  Bugs: 0
  Vulnerabilities: 0
  Code Smells: 73 (high)
  Security Hotspots: 3 (low)

⚠️  Top Priority Issues (High Severity):
------------------------------------------------------------

Issue #1 [CRITICAL]
File: src/orchestrator.ts
Line: 134
Problem: Refactor to reduce Cognitive Complexity...
Rule: typescript:S3776
Link: http://localhost:9000/project/issues?id=...

[... more issues ...]
```

## Sub-Agent Architecture

The scan system uses **three specialized sub-agents** that work together:

### Agent Definitions

Located in `.claude/agents/`:

#### 1. docker-manager.md (Haiku)
- **Purpose**: Docker container lifecycle management
- **Tools**: `Bash(docker:*)` only
- **Responsibilities**:
  - Check container status
  - Start/stop containers
  - Wait for health checks
  - Report container state
- **Why Haiku**: Simple, fast Docker operations

#### 2. scan-executor.md (Sonnet)
- **Purpose**: Main scan coordination and execution
- **Tools**: `Bash`, `Read`, `Write`
- **Responsibilities**:
  - Detect files to scan (git integration)
  - Execute SonarScanner via Docker
  - Monitor scan progress
  - Handle errors with remediation steps
- **Why Sonnet**: Complex decision-making and coordination

#### 3. result-analyzer.md (Haiku)
- **Purpose**: Results fetching and formatting
- **Tools**: `Bash`, `Read`, `Write`
- **Responsibilities**:
  - Fetch data from SonarQube API
  - Parse JSON responses
  - Format output for display
  - Save structured JSON
- **Why Haiku**: Fast data transformation

### Orchestration Flow

The main orchestrator (`adw_sonar_scan.ts`) coordinates them in sequence:

```
1. Orchestrator spawns @docker-manager
   → Checks container health
   → Returns status

2. If healthy, orchestrator spawns @scan-executor
   → Detects files
   → Runs scanner
   → Returns scan results

3. If successful, orchestrator spawns @result-analyzer
   → Fetches API data
   → Formats output
   → Saves JSON
```

### Observable Outputs

Each agent execution produces:
- `.adws/agents/{adw_id}/sonar-scanner/cc_raw_output.jsonl` - Raw messages
- `.adws/agents/{adw_id}/sonar-scanner/cc_raw_output.json` - Parsed messages
- `.adws/agents/{adw_id}/sonar-scanner/cc_final_object.json` - Final result
- `.adws/scan_issues.json` - Structured issue data

### Benefits of Sub-Agent Architecture

- **Cost-efficient**: Haiku for simple tasks, Sonnet only where needed
- **Observable**: Separate JSONL outputs per agent
- **Modular**: Each agent has clear boundaries
- **Composable**: Agents can be reused in other workflows
- **Tool-scoped**: Each agent only has access to tools it needs

## Troubleshooting

### Container Won't Start

**Error:** Port 9000 already in use

**Solution:**
```bash
# Find what's using the port
lsof -i:9000  # macOS/Linux
netstat -ano | findstr :9000  # Windows

# Stop the conflicting service
docker stop ralph-sonarqube
```

**Error:** vm.max_map_count too low (Linux only)

**Solution:**
```bash
sudo sysctl -w vm.max_map_count=524288
```

### Scanner Fails

**Error:** Authentication failed

**Solution:**
- Check token in `~/.config/sonarqube/config.yml`
- Regenerate token in SonarQube UI
- Verify token has project creation permissions

**Error:** Project not found

**Solution:**
- Create project manually in SonarQube UI
- Or let scanner auto-create on first run
- Verify project key matches configuration

### Health Check Timeout

**Error:** Container didn't become healthy

**Solution:**
```bash
# Check logs
docker logs ralph-sonarqube --tail 100

# Restart container
docker restart ralph-sonarqube

# Increase wait time (edit scan script)
```

## Advanced Usage

### Custom Scan Configuration

Create a custom scan with specific parameters:

```typescript
import { executeScan } from './.adws/adw_modules/scan_ops';

const result = await executeScan('changed', {
  projectKey: 'my-project',
  projectName: 'My Project',
  sonarToken: 'my-token',
  exclusions: ['tests/**', 'mocks/**'],
});
```

### Manual API Queries

Use the SonarQube API client directly:

```typescript
import { SonarQubeClient } from './.adws/adw_modules/sonarqube_ops';

const client = new SonarQubeClient({
  url: 'http://localhost:9000',
  token: 'your-token',
});

const issues = await client.fetchIssues('my-project');
const qualityGate = await client.fetchQualityGate('my-project');
```

### Programmatic Scan Execution

From within Ralph orchestrator code:

```typescript
import { SonarQubeExecutor } from './src/sonarqube/executor';

const executor = new SonarQubeExecutor({
  enabled: true,
  scanOnCheckpoint: true,
  scanAfterIteration: false,
  scanMode: 'changed',
  failOnQualityGate: false,
});

await executor.executeScan('changed');
```

## File Locations

| File | Purpose |
|------|---------|
| `~/.config/sonarqube/config.yml` | SonarQube connection (URL, token) |
| `sonar-project.properties` | Project scan settings (exclusions) |
| `.claude/agents/docker-manager.md` | Docker sub-agent definition |
| `.claude/agents/scan-executor.md` | Scan sub-agent definition |
| `.claude/agents/result-analyzer.md` | Results sub-agent definition |
| `.adws/adw_sonar_scan.ts` | Main orchestrator CLI |
| `.adws/adw_sonar_setup.ts` | Initial setup CLI |
| `.adws/adw_sonar_results.ts` | Results viewer CLI |
| `.adws/agents/{adw_id}/` | Per-run agent outputs |
| `.adws/scan_issues.json` | Latest scan issues (JSON) |
| `.adws/adw_modules/` | Reusable modules |
| `src/sonarqube/executor.ts` | Ralph integration |

## Development

### Adding New Modules

1. Create module in `.adws/adw_modules/`
2. Export functions with clear types
3. Keep modules under 300 lines
4. Document all exported functions

### Extending Scan Capabilities

1. Add new scan modes in `scan_ops.ts`
2. Update types in `data_types.ts`
3. Add CLI options in `adw_sonar_scan.ts`
4. Update documentation

### Testing Modules

```bash
# Test Docker operations
bun test .adws/adw_modules/docker_ops.test.ts

# Test scan execution
bun test .adws/adw_modules/scan_ops.test.ts

# Integration test
bun run ./.adws/adw_sonar_scan.ts full
```

## Resources

- [SonarQube Documentation](https://docs.sonarqube.org/latest/)
- [SonarScanner CLI](https://docs.sonarqube.org/latest/analyzing-source-code/scanners/sonarscanner/)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
- [Ralph Orchestrator](../README.md)

## Support

For issues or questions:

1. Check SonarQube logs: `docker logs ralph-sonarqube`
2. Check scan outputs: `.adws/agents/{adw_id}/`
3. Review configuration: `~/.config/sonarqube/config.yml`
4. Consult troubleshooting section above

## License

Same as Ralph Orchestrator (MIT)
