# Contributing to Ralph Orchestrator TypeScript

Thank you for your interest in contributing to Ralph Orchestrator TypeScript! This guide will help you get started with contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](https://github.com/acazau/ralph-orchestrator-ts/blob/main/CODE_OF_CONDUCT.md). Please read it before contributing.

## Ways to Contribute

### 1. Report Bugs

Found a bug? Help us fix it:

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information
   - Error messages/logs

**Bug Report Template:**
```markdown
## Description
Brief description of the bug

## Steps to Reproduce
1. Run command: `bun run cli ...`
2. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., Ubuntu 22.04]
- Bun: [e.g., 1.1.0]
- Ralph Version: [e.g., 1.0.0]
- AI Agent: [e.g., claude]

## Logs
```
Error messages here
```
```

### 2. Suggest Features

Have an idea? We'd love to hear it:

1. **Check existing feature requests**
2. **Open a discussion** for major changes
3. **Create a feature request** with:
   - Use case description
   - Proposed solution
   - Alternative approaches
   - Implementation considerations

### 3. Improve Documentation

Documentation improvements are always welcome:

- Fix typos and grammar
- Clarify confusing sections
- Add missing information
- Create new examples
- Translate documentation

### 4. Contribute Code

Ready to code? Follow these steps:

#### Setup Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/ralph-orchestrator-ts.git
cd ralph-orchestrator-ts

# Install dependencies
bun install

# Run tests to verify setup
bun test

# Run type checking
bun run typecheck

# Run linting
bun run lint
```

#### Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number
   ```

2. **Make changes**
   - Follow existing code style
   - Add/update tests
   - Update documentation

3. **Test your changes**
   ```bash
   # Run all tests
   bun test

   # Run specific test file
   bun test src/orchestrator.test.ts

   # Run tests in watch mode
   bun test --watch

   # Type check
   bun run typecheck
   ```

4. **Format and lint code**
   ```bash
   # Format with Biome
   bun run format

   # Lint with Biome
   bun run lint
   ```

5. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   # Use conventional commits: feat, fix, docs, test, refactor, style, chore
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Development Guidelines

### Code Style

We use Biome for linting and formatting with these preferences:

- **Line length**: 100 characters
- **Quotes**: Double quotes for strings
- **Imports**: Organized and sorted
- **Type annotations**: Use where beneficial
- **JSDoc comments**: For public APIs

**Example:**
```typescript
/**
 * Calculate token usage cost.
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param agentType - Type of AI agent
 * @returns Cost in USD
 * @throws Error if agent_type is unknown
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  agentType: string = "claude"
): number {
  if (!(agentType in TOKEN_COSTS)) {
    throw new Error(`Unknown agent: ${agentType}`);
  }

  const rates = TOKEN_COSTS[agentType];
  const cost = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  return Math.round(cost * 10000) / 10000;
}
```

### Testing Guidelines

All new features require tests:

1. **Unit tests** for individual functions
2. **Integration tests** for workflows
3. **Edge cases** and error conditions
4. **Documentation** of test purpose

**Test Example:**
```typescript
import { describe, test, expect } from "bun:test";
import { calculateCost } from "./cost";

describe("calculateCost", () => {
  test("calculates cost for Claude correctly", () => {
    const cost = calculateCost(1000, 500, "claude");
    expect(cost).toBe(0.0105);
  });

  test("throws error for invalid agent", () => {
    expect(() => calculateCost(1000, 500, "invalid")).toThrow("Unknown agent");
  });

  test("handles zero tokens", () => {
    const cost = calculateCost(0, 0, "claude");
    expect(cost).toBe(0);
  });
});
```

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `style:` Code style changes
- `chore:` Maintenance tasks
- `perf:` Performance improvements

**Examples:**
```bash
feat: add Gemini agent support
fix: resolve token overflow in long prompts
docs: update installation guide for Windows
test: add integration tests for checkpointing
refactor: extract prompt validation logic
```

### Pull Request Process

1. **Title**: Use conventional commit format
2. **Description**: Explain what and why
3. **Testing**: Describe testing performed
4. **Screenshots**: Include if UI changes
5. **Checklist**: Complete PR template

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] All tests pass
- [ ] Added new tests
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Updated documentation
- [ ] No breaking changes
```

## Project Structure

```
ralph-orchestrator-ts/
├── src/                    # TypeScript source
│   ├── index.ts           # Main entry point
│   ├── cli.ts             # CLI implementation
│   ├── orchestrator.ts    # Main orchestrator
│   ├── agents/            # Agent implementations
│   │   ├── base.ts
│   │   ├── claude.ts
│   │   └── gemini.ts
│   ├── config/            # Configuration
│   ├── metrics/           # Metrics collection
│   ├── utils/             # Utilities
│   └── web/               # Web interface
├── docs/                   # Documentation
├── tests/                  # Test files
├── .agent/                 # Runtime data
└── package.json           # Dependencies
```

## Testing

### Run Tests

```bash
# All tests
bun test

# Specific test file
bun test src/orchestrator.test.ts

# Watch mode
bun test --watch

# With coverage (if configured)
bun test --coverage
```

### Test Categories

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test component interaction
3. **E2E Tests**: Test complete workflows
4. **Performance Tests**: Test resource usage
5. **Security Tests**: Test input validation

## Documentation

### Building Docs Locally

```bash
# If using a documentation generator
# Install dependencies and run
bun install
# Documentation preview commands TBD
```

### Documentation Standards

- Clear, concise language
- Code examples for all features
- Explain the "why" not just "how"
- Keep examples up-to-date
- Include troubleshooting tips

## Release Process

1. **Version Bump**: Update version in package.json
2. **Changelog**: Update CHANGELOG.md
3. **Tests**: Ensure all tests pass
4. **Documentation**: Update if needed
5. **Tag**: Create version tag
6. **Release**: Create GitHub release

## Getting Help

### For Contributors

- [GitHub Discussions](https://github.com/acazau/ralph-orchestrator-ts/discussions)
- [Issue Tracker](https://github.com/acazau/ralph-orchestrator-ts/issues)

### Resources

- [Architecture Overview](advanced/architecture.md)
- [API Documentation](api/orchestrator.md)
- [Testing Guide](testing.md)

## Recognition

Contributors are recognized in:

- [CONTRIBUTORS.md](https://github.com/acazau/ralph-orchestrator-ts/blob/main/CONTRIBUTORS.md)
- Release notes
- Documentation credits

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Ralph Orchestrator TypeScript!
