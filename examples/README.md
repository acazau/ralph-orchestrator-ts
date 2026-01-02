# Ralph Orchestrator Examples

Practical examples demonstrating how to use Ralph Orchestrator for various tasks.

## Available Examples

### [Hello SonarQube](./hello-sonarqube/)
**Difficulty**: Beginner | **Time**: 10-20 min | **Cost**: ~$0.50

A "hello world" example that demonstrates:
- Building a simple greeting service
- Running SonarQube scans for quality validation
- Iterating until quality gates pass
- Test coverage requirements

```bash
bun run cli run -P examples/hello-sonarqube/PROMPT.md
```

---

## Running Examples

### Prerequisites

1. Install dependencies:
   ```bash
   bun install
   ```

2. Have an AI CLI tool available:
   - `claude` (Claude CLI)
   - `gemini` (Gemini CLI)
   - `q` (Amazon Q CLI)

3. For SonarQube examples, start the container:
   ```bash
   bun run ./.adws/adw_sonar_setup.ts
   ```

### Basic Usage

```bash
# Run any example
bun run cli run -P examples/<example-name>/PROMPT.md

# With options
bun run cli run -P examples/<example-name>/PROMPT.md \
  --agent claude \
  --max-iterations 30 \
  --max-cost 5.0

# Monitor with web dashboard
bun run cli web &
bun run cli run -P examples/<example-name>/PROMPT.md
```

## Creating Your Own Examples

1. Create a directory under `examples/`
2. Add a `PROMPT.md` with:
   - Clear objective
   - Specific requirements
   - Completion criteria
3. Optionally add a `README.md` with instructions

### Prompt Template

```markdown
# Task: [Title]

## Objective
[What should be built]

## Requirements
[Specific features and constraints]

## Technical Specs
[Languages, frameworks, patterns]

## Quality Process (if using SonarQube)
[Commands to run scans and check results]

## Completion Criteria
[How to know when done]

When complete, output: TASK_COMPLETED
```

## Tips

- **Be Specific**: Vague prompts lead to vague results
- **Include Tests**: Always require tests in prompts
- **Set Limits**: Use `--max-iterations` and `--max-cost`
- **Use SonarQube**: Quality gates prevent sloppy code
- **Monitor Progress**: Use `bun run cli web` for real-time updates
