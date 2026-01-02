# Hello SonarQube Example

A "hello world" example demonstrating Ralph Orchestrator with SonarQube integration for continuous code quality validation.

## What This Example Does

1. **Task**: Build a simple greeting service module
2. **Quality Loop**: After each implementation step, run SonarQube analysis
3. **Iterate**: Fix any issues found until quality gates pass
4. **Complete**: Only finish when code works AND meets quality standards

## Prerequisites

1. **SonarQube Running**
   ```bash
   # Start SonarQube container
   bun run ./.adws/adw_sonar_setup.ts

   # Verify it's healthy
   bun run ./.adws/adw_sonar_results.ts --format=summary
   ```

2. **AI CLI Available**
   - Claude CLI (`claude`), or
   - Gemini CLI (`gemini`), or
   - Amazon Q CLI (`q`)

## Running the Example

### Option 1: From Project Root
```bash
# Run with the example prompt
bun run cli run -P examples/hello-sonarqube/PROMPT.md

# With specific agent
bun run cli run -P examples/hello-sonarqube/PROMPT.md -a claude

# With limits
bun run cli run -P examples/hello-sonarqube/PROMPT.md --max-iterations 30 --max-cost 5.0
```

### Option 2: Copy to PROMPT.md
```bash
cp examples/hello-sonarqube/PROMPT.md PROMPT.md
bun run cli run
```

## Expected Behavior

The AI agent will:

1. **Implement** the greeting service functions
2. **Write tests** for all functionality
3. **Run SonarQube scan** to check quality
4. **Review issues** if any are found
5. **Fix issues** (code smells, missing coverage, etc.)
6. **Re-scan** until quality gates pass
7. **Complete** when all criteria are met

## Quality Gates

| Metric | Threshold |
|--------|-----------|
| Bugs | 0 |
| Vulnerabilities | 0 |
| Code Smells (Open) | 0 |
| Coverage | >= 80% |
| Duplications | < 3% |

## Monitoring Progress

```bash
# Watch SonarQube results in real-time
watch -n 10 'bun run ./.adws/adw_sonar_results.ts --format=summary'

# Or use the web dashboard
bun run cli web &
open http://localhost:3000
```

## Expected Output

After successful completion:

```
src/examples/
  greeting-service.ts    # ~50-80 lines
tests/examples/
  greeting-service.test.ts  # ~100-150 lines
```

SonarQube Dashboard:
- Quality Gate: **PASSED**
- Bugs: **0**
- Vulnerabilities: **0**
- Code Smells: **0**
- Coverage: **80%+**

## Typical Run

- **Iterations**: 10-20
- **Time**: 5-15 minutes
- **Cost**: $0.10-$1.00 (depends on agent)

## Learning Points

This example demonstrates:

1. **Quality-Driven Development** - Code isn't "done" until it passes quality gates
2. **Continuous Validation** - SonarQube scans after each change
3. **Automated Fixes** - AI reads issues and self-corrects
4. **Coverage Requirements** - Tests are mandatory, not optional
5. **Clean Code** - Zero tolerance for code smells

## Troubleshooting

### SonarQube Not Running
```bash
bun run ./.adws/adw_sonar_setup.ts
```

### Scan Fails
```bash
# Check container status
docker ps | grep sonarqube

# Check logs
docker logs ralph-sonarqube --tail 50
```

### Quality Gate Never Passes
Increase iterations:
```bash
bun run cli run -P examples/hello-sonarqube/PROMPT.md --max-iterations 50
```
