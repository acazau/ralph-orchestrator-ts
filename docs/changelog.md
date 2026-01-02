# Changelog

All notable changes to Ralph Orchestrator TypeScript will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial TypeScript/Bun port of Ralph Orchestrator
- **Completion Marker Detection**: Task can now signal completion via `- [x] TASK_COMPLETE` checkbox marker in prompt file
  - Orchestrator checks for marker before each iteration
  - Immediately exits loop when marker is found
  - Supports both `- [x] TASK_COMPLETE` and `[x] TASK_COMPLETE` formats
- **Loop Detection**: Automatic detection of repetitive agent outputs using fuzzball
  - Compares current output against last 5 outputs
  - Uses 90% similarity threshold to detect loops
  - Prevents infinite loops from runaway agents
- **Per-iteration Telemetry**: Capture detailed metrics for each iteration
- ASCII architecture diagrams for completion detection and loop prevention

### Changed

- Migrated from Python to TypeScript/Bun runtime
- Replaced `pip install` with `bun install`
- Replaced `python` commands with `bun run`
- Replaced `pytest` with `bun test`
- Replaced `uvicorn` with `bun run web` (Hono server)
- Updated all import statements to TypeScript ES modules
- Replaced `psutil` with `systeminformation` for system metrics
- Replaced `rapidfuzz` with `fuzzball` for fuzzy string matching
- Replaced `click` CLI framework with `commander`
- Replaced `rich` terminal output with `chalk` and `ora`

## [1.0.0] - 2025-01

### Added

- Initial TypeScript implementation
- Multi-agent support (Claude, Gemini, Q Chat)
- Git-based checkpointing
- Prompt archiving
- State persistence
- Comprehensive test suite
- CLI implementation with commander
- Configuration management
- Metrics collection
- Web monitoring interface with Hono

### Features

- Auto-detection of available AI agents
- Configurable iteration and runtime limits
- Error recovery with exponential backoff
- Verbose and dry-run modes
- JSON configuration file support
- Environment variable configuration
- Type-safe implementation with TypeScript

### Documentation

- Complete README with examples
- Installation instructions
- Usage guide
- API documentation
- Contributing guidelines

---

## Version History Summary

### Major Versions

- **1.0.0** - First stable TypeScript release

### Versioning Policy

We use Semantic Versioning (SemVer):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

### Deprecation Policy

Features marked for deprecation will:

1. Be documented in the changelog
2. Show deprecation warnings for 2 minor versions
3. Be removed in the next major version

### Support Policy

- **Current version**: Full support with bug fixes and features
- **Previous minor version**: Bug fixes only
- **Older versions**: Community support only

## Upgrade Guide

### From Python to TypeScript

If migrating from the Python ralph-orchestrator:

1. **Runtime Changes**
   - Old: `python ralph_orchestrator.py` -> New: `bun run cli`
   - Old: `pip install` -> New: `bun install`
   - Old: `pytest` -> New: `bun test`

2. **Configuration Changes**
   - Configuration format remains compatible (JSON)
   - Environment variables work the same way

3. **File Structure**
   - State files remain in `.agent/metrics/`
   - Checkpoint format unchanged

### Migration Script

```bash
#!/bin/bash
# Migrate from Python to TypeScript version

# Backup old installation
cp -r ralph-orchestrator ralph-orchestrator.backup

# Clone TypeScript version
git clone https://github.com/acazau/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts

# Install dependencies
bun install

# Copy existing configuration
cp ../ralph-orchestrator.backup/ralph.json . 2>/dev/null
cp ../ralph-orchestrator.backup/PROMPT.md . 2>/dev/null

# Migrate state files
cp -r ../ralph-orchestrator.backup/.agent . 2>/dev/null

echo "Migration complete!"
```

## Release Process

### 1. Pre-release Checklist

- [ ] All tests passing (`bun test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped in package.json
- [ ] README examples tested

### 2. Release Steps

```bash
# 1. Update version
vim package.json  # Update version number

# 2. Commit changes
git add -A
git commit -m "Release version X.Y.Z"

# 3. Tag release
git tag -a vX.Y.Z -m "Version X.Y.Z"

# 4. Push to GitHub
git push origin main --tags

# 5. Create GitHub release
gh release create vX.Y.Z --title "Version X.Y.Z" --notes-file RELEASE_NOTES.md
```

### 3. Post-release

- [ ] Announce on social media
- [ ] Update documentation site
- [ ] Close related issues
- [ ] Plan next release

## Contributors

Thanks to all contributors who have helped improve Ralph Orchestrator TypeScript:

- Geoffrey Huntley (@ghuntley) - Original Ralph Wiggum technique
- Python ralph-orchestrator contributors
- Community contributors via GitHub

## How to Contribute

See [CONTRIBUTING.md](contributing.md) for details on:

- Reporting bugs
- Suggesting features
- Submitting pull requests
- Development setup

## Links

- [GitHub Repository](https://github.com/acazau/ralph-orchestrator-ts)
- [Issue Tracker](https://github.com/acazau/ralph-orchestrator-ts/issues)
- [Discussions](https://github.com/acazau/ralph-orchestrator-ts/discussions)
- [Original Python Version](https://github.com/mikeyobrien/ralph-orchestrator)
