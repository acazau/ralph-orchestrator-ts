# CLI API Reference

## Overview

The CLI API provides the command-line interface for Ralph Orchestrator, including commands, arguments, and shell integration.

## Main CLI Interface

Ralph Orchestrator uses [Commander.js](https://github.com/tj/commander.js) for CLI parsing.

### Available Commands

```bash
ralph <command> [options]

Commands:
  run        Run the orchestration loop
  init       Initialize a new Ralph project
  status     Check Ralph status
  clean      Clean Ralph workspace
  prompt     Generate or show prompt
  web        Start the web dashboard
  help       Display help for command
```

### Global Options

```bash
Options:
  -V, --version  Output version number
  -h, --help     Display help for command
```

## Run Command

Main command for starting the orchestration loop.

```bash
ralph run [options]
```

### Options

```typescript
interface RunOptions {
  /** AI agent to use */
  agent: 'claude' | 'q' | 'gemini' | 'acp' | 'auto';

  /** Prompt file path */
  prompt: string;

  /** Direct prompt text (overrides --prompt) */
  promptText?: string;

  /** Maximum iterations */
  maxIterations: number;

  /** Maximum runtime in seconds */
  maxRuntime: number;

  /** Checkpoint interval */
  checkpointInterval: number;

  /** Retry delay in seconds */
  retryDelay: number;

  /** Maximum total tokens */
  maxTokens: number;

  /** Maximum cost in USD */
  maxCost: number;

  /** Context window size */
  contextWindow: number;

  /** Context threshold (0-1) */
  contextThreshold: number;

  /** Disable git checkpointing */
  noGit: boolean;

  /** Disable prompt archiving */
  noArchive: boolean;

  /** Enable verbose output */
  verbose: boolean;

  /** Dry run mode */
  dryRun: boolean;

  /** Output format */
  outputFormat: 'plain' | 'rich' | 'json';

  /** Verbosity level */
  outputVerbosity: 'quiet' | 'normal' | 'verbose' | 'debug';

  /** Configuration file path */
  config?: string;

  /** ACP agent command */
  acpAgent?: string;

  /** ACP permission mode */
  acpPermissionMode?: string;
}
```

### CLI Arguments

```bash
ralph run
  -a, --agent <type>              AI agent to use (claude, q, gemini, acp, auto) [default: "auto"]
  -P, --prompt <file>             Prompt file path [default: "PROMPT.md"]
  -p, --prompt-text <text>        Direct prompt text (overrides --prompt)
  -i, --max-iterations <n>        Maximum iterations [default: 100]
  -t, --max-runtime <n>           Maximum runtime in seconds [default: 14400]
  -c, --checkpoint-interval <n>   Checkpoint interval [default: 5]
  -r, --retry-delay <n>           Retry delay in seconds [default: 2]
  --max-tokens <n>                Maximum total tokens [default: 1000000]
  --max-cost <n>                  Maximum cost in USD [default: 50]
  --context-window <n>            Context window size [default: 200000]
  --context-threshold <n>         Context threshold [default: 0.8]
  --no-git                        Disable git checkpointing
  --no-archive                    Disable prompt archiving
  -v, --verbose                   Enable verbose output
  --dry-run                       Dry run mode
  --output-format <format>        Output format (plain, rich, json) [default: "rich"]
  --output-verbosity <level>      Verbosity level (quiet, normal, verbose, debug) [default: "normal"]
  --config <file>                 Configuration file path
  --acp-agent <command>           ACP agent command
  --acp-permission-mode <mode>    ACP permission mode
```

### Examples

```bash
# Run with auto-detected agent
ralph run

# Run with specific agent
ralph run -a claude

# Run with Claude agent
ralph run -a claude -i 50

# Run with ACP agent using Gemini
ralph run -a acp --acp-agent gemini --acp-permission-mode auto_approve

# Run with custom prompt file
ralph run -P task.md -i 25 --max-cost 10

# Run with configuration file
ralph run --config ralph.yml

# Run in verbose mode
ralph run -v --output-verbosity debug

# Dry run
ralph run --dry-run
```

## Init Command

Initialize a new Ralph project.

```bash
ralph init [options]
```

### Options

```bash
  -f, --force    Overwrite existing files
```

### What It Creates

```
.agent/
  workspace/     # Temporary workspace
  prompts/       # Archived prompts
  checkpoints/   # Git checkpoints
  metrics/       # Execution metrics
  cache/         # Cache directory
ralph.yml        # Configuration file
PROMPT.md        # Task prompt template
```

### Examples

```bash
# Initialize new project
ralph init

# Force overwrite existing files
ralph init --force
```

## Status Command

Check current Ralph status.

```bash
ralph status
```

### Output

```
Ralph Orchestrator Status

Git repository: Yes
Uncommitted changes: No
PROMPT.md: Found
ralph.yml: Found
.agent/: Initialized
```

## Clean Command

Clean Ralph workspace.

```bash
ralph clean [options]
```

### Options

```bash
  --all    Remove all Ralph files including prompts
```

### Examples

```bash
# Clean cache and metrics
ralph clean

# Remove everything
ralph clean --all
```

## Prompt Command

Generate or show prompt content.

```bash
ralph prompt [options]
```

### Options

```bash
  -s, --show       Show current prompt
  -g, --generate   Generate new prompt template
```

### Examples

```bash
# Show current prompt
ralph prompt --show

# Generate template
ralph prompt --generate
```

## Web Command

Start the web dashboard.

```bash
ralph web [options]
```

### Options

```bash
  -p, --port <n>              Server port [default: 3000]
  -H, --hostname <host>       Server hostname [default: "0.0.0.0"]
  --no-auth                   Disable authentication
  --db <path>                 Database path [default: ".agent/ralph.db"]
  --admin-password <password> Admin password
```

### Examples

```bash
# Start with defaults
ralph web

# Custom port
ralph web -p 8080

# With authentication disabled
ralph web --no-auth

# Custom database path
ralph web --db ./data/ralph.db
```

## Programmatic CLI Usage

```typescript
import { Command } from 'commander';
import { RalphOrchestrator } from 'ralph-orchestrator-ts';
import { createConfigFromArgs, loadConfig } from 'ralph-orchestrator-ts/config';

const program = new Command();

program
  .command('run')
  .description('Run orchestrator')
  .option('-a, --agent <type>', 'AI agent to use', 'auto')
  .option('-i, --max-iterations <n>', 'Maximum iterations', '100')
  .action(async (options) => {
    const config = createConfigFromArgs({
      agent: options.agent,
      maxIterations: parseInt(options.maxIterations, 10),
    });

    const orchestrator = new RalphOrchestrator(config);
    await orchestrator.run();
  });

program.parse();
```

## Configuration Loading

```typescript
import { loadConfig, createConfigFromArgs, ConfigValidator } from 'ralph-orchestrator-ts';

// Load from file
const { config, validation } = await loadConfig('ralph.yml');

if (!validation.valid) {
  for (const error of validation.errors) {
    console.error(`${error.field}: ${error.message}`);
  }
  process.exit(1);
}

// Show warnings
for (const warning of validation.warnings) {
  console.warn(warning.message);
}

// Create from CLI arguments
const config = createConfigFromArgs({
  agent: 'claude',
  maxIterations: 50,
  verbose: true,
});

// Validate configuration
const result = ConfigValidator.validate(config);
```

## Shell Completion

### Bash Completion

```bash
# ralph-completion.bash
_ralph_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    opts="run init status clean prompt web help"

    case "${prev}" in
        ralph)
            COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
            return 0
            ;;
        --agent|-a)
            COMPREPLY=( $(compgen -W "claude q gemini acp auto" -- ${cur}) )
            return 0
            ;;
        --acp-agent)
            COMPREPLY=( $(compgen -c -- ${cur}) )
            return 0
            ;;
        --acp-permission-mode)
            COMPREPLY=( $(compgen -W "auto_approve deny_all allowlist interactive" -- ${cur}) )
            return 0
            ;;
        --output-format)
            COMPREPLY=( $(compgen -W "plain rich json" -- ${cur}) )
            return 0
            ;;
        --output-verbosity)
            COMPREPLY=( $(compgen -W "quiet normal verbose debug" -- ${cur}) )
            return 0
            ;;
    esac

    # File completion for prompt files
    if [[ ${cur} == *.md ]]; then
        COMPREPLY=( $(compgen -f -X '!*.md' -- ${cur}) )
        return 0
    fi

    COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
}

complete -F _ralph_completion ralph
```

### ZSH Completion

```zsh
# ralph-completion.zsh
#compdef ralph

_ralph() {
    local -a commands
    commands=(
        'run:Run orchestration loop'
        'init:Initialize project'
        'status:Show status'
        'clean:Clean workspace'
        'prompt:Show or generate prompt'
        'web:Start web dashboard'
        'help:Show help'
    )

    _arguments \
        '--version[Show version]' \
        '--help[Show help]' \
        '1:command:->command' \
        '*::arg:->args'

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case $words[1] in
                run)
                    _arguments \
                        '--agent[AI agent]:agent:(claude q gemini acp auto)' \
                        '--prompt[Prompt file]:file:_files -g "*.md"' \
                        '--prompt-text[Prompt text]:text' \
                        '--max-iterations[Max iterations]:number' \
                        '--max-runtime[Max runtime]:seconds' \
                        '--checkpoint-interval[Checkpoint interval]:number' \
                        '--retry-delay[Retry delay]:seconds' \
                        '--max-tokens[Max tokens]:number' \
                        '--max-cost[Max cost]:dollars' \
                        '--context-window[Context window]:tokens' \
                        '--context-threshold[Context threshold]:ratio' \
                        '--no-git[Disable git]' \
                        '--no-archive[Disable archiving]' \
                        '--verbose[Verbose output]' \
                        '--dry-run[Dry run mode]' \
                        '--output-format[Output format]:format:(plain rich json)' \
                        '--output-verbosity[Verbosity]:level:(quiet normal verbose debug)' \
                        '--config[Config file]:file:_files -g "*.yml"' \
                        '--acp-agent[ACP agent]:command' \
                        '--acp-permission-mode[Permission mode]:mode:(auto_approve deny_all allowlist interactive)'
                    ;;
                init)
                    _arguments \
                        '--force[Overwrite existing]'
                    ;;
                clean)
                    _arguments \
                        '--all[Remove all files]'
                    ;;
                prompt)
                    _arguments \
                        '--show[Show prompt]' \
                        '--generate[Generate template]'
                    ;;
                web)
                    _arguments \
                        '--port[Server port]:port' \
                        '--hostname[Server hostname]:host' \
                        '--no-auth[Disable auth]' \
                        '--db[Database path]:file:_files' \
                        '--admin-password[Admin password]:password'
                    ;;
            esac
            ;;
    esac
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 130 | Interrupted by user (Ctrl+C) |

## Environment Variables

The CLI respects these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `RALPH_AGENT` | Default agent type | `auto` |
| `RALPH_MAX_ITERATIONS` | Maximum iterations | `100` |
| `RALPH_MAX_RUNTIME` | Maximum runtime (seconds) | `14400` |
| `RALPH_VERBOSE` | Enable verbose mode | `false` |
| `RALPH_DRY_RUN` | Enable dry run mode | `false` |

## See Also

- [Configuration API](config.md)
- [Orchestrator API](orchestrator.md)
- [Agents API](agents.md)
