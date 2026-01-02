# Installation Guide

Comprehensive installation instructions for Ralph Orchestrator TypeScript.

## System Requirements

### Minimum Requirements

- **Bun**: 1.0 or higher
- **Memory**: 512 MB RAM
- **Disk**: 100 MB free space
- **OS**: Linux, macOS, or Windows

### Recommended Requirements

- **Bun**: 1.1 or higher
- **Memory**: 2 GB RAM
- **Disk**: 1 GB free space
- **Git**: For checkpoint features
- **Network**: Stable internet connection

## Installation Methods

### Method 1: Git Clone (Recommended)

```bash
# Clone the repository
git clone https://github.com/acazau/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts

# Install dependencies
bun install

# Verify installation
bun run cli --version
```

### Method 2: Direct Download

```bash
# Download the latest release
wget https://github.com/acazau/ralph-orchestrator-ts/archive/refs/tags/v1.0.0.tar.gz

# Extract the archive
tar -xzf v1.0.0.tar.gz
cd ralph-orchestrator-ts-1.0.0

# Install dependencies
bun install
```

### Method 3: npm Install (Coming Soon)

```bash
# Future installation via npm/bun
bun add ralph-orchestrator-ts
```

## AI Agent Installation

Ralph requires at least one AI agent to function. Choose and install one or more:

### Claude (Anthropic)

Claude is the recommended agent for most use cases.

```bash
# Install via npm
npm install -g @anthropic-ai/claude-code

# Or download from
# https://claude.ai/code

# Verify installation
claude --version
```

**Configuration:**
```bash
# Set your API key (if required)
export ANTHROPIC_API_KEY="your-api-key-here"
```

### Q Chat

Q Chat is a lightweight alternative agent.

```bash
# Clone from repository
git clone https://github.com/qchat/qchat.git
cd qchat
# Follow installation instructions

# Verify installation
q --version
```

**Configuration:**
```bash
# Configure Q Chat
q config --set api_key="your-api-key"
```

### Gemini (Google)

Gemini provides access to Google's AI models.

```bash
# Install via npm
npm install -g @google/gemini-cli

# Verify installation
gemini --version
```

**Configuration:**
```bash
# Set your API key
export GEMINI_API_KEY="your-api-key-here"

# Or use config file
gemini config set api_key "your-api-key"
```

## Dependency Installation

### Required Packages

Ralph Orchestrator TypeScript dependencies are managed via `package.json`:

```bash
# Install all dependencies
bun install
```

### Core Dependencies

The project uses the following key dependencies:

- **commander**: CLI argument parsing
- **chalk**: Terminal styling
- **ora**: Loading spinners
- **fuzzball**: Fuzzy string matching for loop detection
- **js-yaml**: YAML configuration parsing
- **systeminformation**: System metrics monitoring
- **hono**: Web server for monitoring interface

### Development Dependencies

```bash
# Install dev dependencies (included in bun install)
# - @biomejs/biome: Linting and formatting
# - typescript: Type checking
# - @types/bun: Bun type definitions
```

## Verification

### Verify Installation

Run these commands to verify your installation:

```bash
# Check Bun version
bun --version  # Should be 1.0+

# Check Ralph Orchestrator
bun run cli --version

# Check for available agents
bun run cli --list-agents

# Run a test
echo "Say hello (orchestrator will iterate until completion)" > test.md
bun run cli --prompt test.md --dry-run
```

### Expected Output

```
Ralph Orchestrator TypeScript v1.0.0
Bun 1.1.0
Available agents: claude, q, gemini
Dry run completed successfully
```

## Platform-Specific Instructions

### Linux

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Ubuntu/Debian - Install Git
sudo apt update
sudo apt install git

# Fedora/RHEL
sudo dnf install git

# Arch Linux
sudo pacman -S git
```

### macOS

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Or using Homebrew
brew tap oven-sh/bun
brew install bun

# Install Git
brew install git

# Verify installation
bun --version
```

### Windows

```powershell
# Using PowerShell as Administrator

# Install Bun
powershell -c "irm bun.sh/install.ps1 | iex"

# Or use WSL for better compatibility
wsl --install

# Inside WSL
curl -fsSL https://bun.sh/install | bash

# Install Git
winget install Git.Git

# Clone Ralph
git clone https://github.com/acazau/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts

# Run Ralph
bun run cli --prompt PROMPT.md
```

### Docker (Alternative)

```dockerfile
# Dockerfile
FROM oven/bun:1.1

WORKDIR /app
COPY . /app

RUN bun install

# Install your preferred AI agent
RUN npm install -g @anthropic-ai/claude-code

CMD ["bun", "run", "cli"]
```

```bash
# Build and run
docker build -t ralph-orchestrator-ts .
docker run -v $(pwd):/app ralph-orchestrator-ts --prompt PROMPT.md
```

## Configuration Files

### Basic Configuration

Create a configuration file for default settings:

```bash
# Create ralph.json
cat > ralph.json << EOF
{
  "agent": "claude",
  "max_iterations": 100,
  "max_runtime": 14400,
  "checkpoint_interval": 5,
  "verbose": false
}
EOF
```

### Environment Variables

Set environment variables for common settings:

```bash
# Add to your ~/.bashrc or ~/.zshrc
export RALPH_AGENT="claude"
export RALPH_MAX_ITERATIONS="100"
export RALPH_MAX_COST="50.0"
export RALPH_VERBOSE="false"
```

## Troubleshooting Installation

### Common Issues

#### Bun Not Found

```bash
ERROR: bun: command not found
```

**Solution**: Install Bun
```bash
curl -fsSL https://bun.sh/install | bash
# Then restart your terminal or run:
source ~/.bashrc
```

#### Agent Not Found

```bash
ERROR: No AI agents detected
```

**Solution**: Install at least one agent
```bash
npm install -g @anthropic-ai/claude-code
# or
npm install -g @google/gemini-cli
```

#### Permission Denied

```bash
Permission denied: './src/cli.ts'
```

**Solution**: Make executable
```bash
chmod +x src/cli.ts
```

#### Module Not Found

```bash
Cannot find module 'commander'
```

**Solution**: Install dependencies
```bash
bun install
```

## Uninstallation

To remove Ralph Orchestrator TypeScript:

```bash
# Remove the directory
rm -rf ralph-orchestrator-ts

# Remove configuration files
rm ~/.ralph.json
```

## Next Steps

After installation:

1. Read the [Quick Start Guide](quick-start.md)
2. Configure your [AI Agents](guide/agents.md)
3. Learn about [Configuration Options](guide/configuration.md)
4. Try the [Examples](examples/index.md)

## Getting Help

If you encounter issues:

- Check the [FAQ](faq.md)
- Read [Troubleshooting](troubleshooting.md)
- Open an [issue on GitHub](https://github.com/acazau/ralph-orchestrator-ts/issues)
- Join the [discussions](https://github.com/acazau/ralph-orchestrator-ts/discussions)

---

Continue to the [User Guide](guide/overview.md)
