# Context Management

## Overview

Managing context windows effectively is crucial for Ralph Orchestrator's success. AI agents have limited context windows, and exceeding them can cause failures or degraded performance.

## Context Window Limits

### Current Agent Limits

| Agent | Context Window | Token Limit | Approximate Characters |
|-------|---------------|-------------|----------------------|
| Claude | 200K tokens | 200,000 | ~800,000 chars |
| Gemini | 32K tokens | 32,768 | ~130,000 chars |
| Q Chat | 8K tokens | 8,192 | ~32,000 chars |

## Context Components

### What Consumes Context

1. **PROMPT.md file** - The task description
2. **Previous outputs** - Agent responses
3. **File contents** - Code being modified
4. **System messages** - Instructions to agent
5. **Error messages** - Debugging information

### Context Calculation

```typescript
interface ContextStats {
  promptLength: number;
  contextLength: number;
  errorCount: number;
  lastUpdated: string | null;
}

async function estimateContextUsage(
  promptFile: string,
  workspaceFiles: string[]
): Promise<{
  characters: number;
  estimatedTokens: number;
  percentageUsed: Record<string, number>;
}> {
  let totalChars = 0;

  // Prompt file
  const promptContent = await Bun.file(promptFile).text();
  totalChars += promptContent.length;

  // Workspace files
  for (const filePath of workspaceFiles) {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      totalChars += (await file.text()).length;
    }
  }

  // Estimate tokens (rough: 4 chars = 1 token)
  const estimatedTokens = totalChars / 4;

  return {
    characters: totalChars,
    estimatedTokens,
    percentageUsed: {
      claude: (estimatedTokens / 200000) * 100,
      gemini: (estimatedTokens / 32768) * 100,
      q: (estimatedTokens / 8192) * 100,
    },
  };
}
```

## Context Optimization Strategies

### 1. Prompt Optimization

#### Keep Prompts Concise
```markdown
# Bad - Too verbose
Create a comprehensive TypeScript application that implements a calculator
with extensive error handling, logging capabilities, user-friendly
interface, and support for basic arithmetic operations including
addition, subtraction, multiplication, and division...

# Good - Concise and clear
Create a TypeScript calculator with:
- Basic operations: +, -, *, /
- Error handling for division by zero
- Simple CLI interface
```

#### Use Structured Format
```markdown
# Task: Calculator Module

## Requirements:
- [ ] Basic operations (add, subtract, multiply, divide)
- [ ] Input validation
- [ ] Unit tests

## Constraints:
- TypeScript with Bun
- No external dependencies
- 100% test coverage
```

### 2. File Management

#### Split Large Files
```typescript
// Instead of one large file
// calculator.ts (5000 lines)

// Use modular structure
// calculator/
//   ├── index.ts
//   ├── operations.ts (500 lines)
//   ├── validators.ts (300 lines)
//   ├── interface.ts (400 lines)
//   └── utils.ts (200 lines)
```

#### Exclude Unnecessary Files
```json
{
  "exclude_patterns": [
    "*.js",
    "node_modules",
    "*.log",
    "*.test.ts",
    "docs/",
    ".git/"
  ]
}
```

### 3. Incremental Processing

#### Task Decomposition
```markdown
# Instead of one large task
"Build a complete web application"

# Break into phases
Phase 1: Create project structure
Phase 2: Implement data models
Phase 3: Add API endpoints
Phase 4: Build frontend
Phase 5: Add tests
```

#### Checkpoint Strategy
```typescript
async function createContextAwareCheckpoint(
  iteration: number,
  contextUsage: { percentageUsed: Record<string, number> },
  currentAgent: string
): Promise<void> {
  const agentPercentage = contextUsage.percentageUsed[currentAgent] ?? 0;

  if (agentPercentage > 70) {
    // Reset context by creating checkpoint
    await createCheckpoint(iteration);
    // Clear working memory
    clearAgentMemory();
    // Summarize progress
    createProgressSummary();
  }
}
```

### 4. Context Window Sliding

#### Maintain Rolling Context
```typescript
class ContextManager {
  private context: string = '';
  private errorHistory: string[] = [];
  private maxContextSize: number;

  constructor(options: ContextManagerOptions = {}) {
    this.maxContextSize = options.maxContextSize ?? 8000;
  }

  updateContext(output: string): void {
    this.context = output;

    // Trim if too long
    if (this.context.length > this.maxContextSize) {
      const trimmed = this.context.slice(-this.maxContextSize);
      this.context = `[...truncated...]\n${trimmed}`;
    }
  }

  addErrorFeedback(error: string): void {
    this.errorHistory.push(error);

    // Keep only recent errors
    if (this.errorHistory.length > 10) {
      this.errorHistory.shift();
    }
  }

  getContext(): string {
    return this.context;
  }
}
```

## Advanced Techniques

### 1. Context Compression

```typescript
function compressContext(text: string, maxLength: number = 1000): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Extract key sections
  const lines = text.split('\n');
  const importantLines: string[] = [];
  const markers = ['#', 'function ', 'class ', 'export ', 'ERROR', 'TODO'];

  for (const line of lines) {
    if (markers.some((marker) => line.includes(marker))) {
      importantLines.push(line);
    }
  }

  let compressed = importantLines.join('\n');

  // If still too long, truncate with summary
  if (compressed.length > maxLength) {
    return compressed.slice(0, maxLength - 20) + '\n... (truncated)';
  }

  return compressed;
}
```

### 2. Semantic Chunking

```typescript
async function chunkBySemantics(codeFile: string): Promise<string[]> {
  const chunks: string[] = [];
  let currentChunk: string[] = [];

  const content = await Bun.file(codeFile).text();
  const lines = content.split('\n');

  for (const line of lines) {
    currentChunk.push(line);

    // End chunk at logical boundaries
    if (
      line.trim().startsWith('function ') ||
      line.trim().startsWith('class ') ||
      line.trim().startsWith('export ')
    ) {
      if (currentChunk.length > 1) {
        chunks.push(currentChunk.slice(0, -1).join('\n'));
        currentChunk = [line];
      }
    }
  }

  // Add remaining
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}
```

### 3. Progressive Disclosure

```typescript
type DetailLevel = 'summary' | 'outline' | 'essential' | 'detailed';

class ProgressiveContext {
  private levels: Record<DetailLevel, number> = {
    summary: 100,      // Brief summary
    outline: 500,      // Structure only
    essential: 2000,   // Key components
    detailed: 10000,   // Full details
  };

  getContextAtLevel(content: string, level: DetailLevel = 'essential'): string {
    const maxChars = this.levels[level];

    switch (level) {
      case 'summary':
        return this.createSummary(content, maxChars);
      case 'outline':
        return this.extractOutline(content, maxChars);
      case 'essential':
        return this.extractEssential(content, maxChars);
      default:
        return content.slice(0, maxChars);
    }
  }

  private createSummary(content: string, maxChars: number): string {
    // Extract first paragraph or heading
    const firstParagraph = content.split('\n\n')[0] ?? '';
    return firstParagraph.slice(0, maxChars);
  }

  private extractOutline(content: string, maxChars: number): string {
    // Extract headings and function signatures
    const lines = content.split('\n');
    const outline = lines
      .filter((line) => line.match(/^(#|function|class|export|interface)/))
      .join('\n');
    return outline.slice(0, maxChars);
  }

  private extractEssential(content: string, maxChars: number): string {
    // Keep imports, exports, and key definitions
    const lines = content.split('\n');
    const essential = lines
      .filter((line) =>
        line.match(/^(import|export|interface|type|class|function|const)/)
      )
      .join('\n');
    return essential.slice(0, maxChars);
  }
}
```

## Context Monitoring

### Track Usage

```typescript
import { Glob } from 'bun';

async function monitorContextUsage(): Promise<{
  characters: number;
  estimatedTokens: number;
  percentageUsed: Record<string, number>;
}> {
  const glob = new Glob('**/*.ts');
  const files: string[] = [];

  for await (const file of glob.scan('.')) {
    files.push(file);
  }

  const usage = await estimateContextUsage('PROMPT.md', files);

  // Log warning if approaching limits
  for (const [agent, percentage] of Object.entries(usage.percentageUsed)) {
    if (percentage > 80) {
      console.warn(
        `Context usage for ${agent}: ${percentage.toFixed(1)}% - Consider optimization`
      );
    }
  }

  // Save metrics
  await Bun.write(
    '.agent/metrics/context_usage.json',
    JSON.stringify(usage, null, 2)
  );

  return usage;
}
```

## Best Practices

### 1. Start Small
- Begin with minimal context
- Add detail only when needed
- Remove completed sections

### 2. Use References
```markdown
# Instead of including full code
See `calculator.ts` for implementation details

# Reference specific sections
Refer to lines 45-67 in `utils.ts` for error handling
```

### 3. Summarize Periodically
```typescript
async function createIterationSummary(iterationNum: number): Promise<void> {
  if (iterationNum % 10 === 0) {
    const summary = {
      completed: [] as string[],
      inProgress: [] as string[],
      pending: [] as string[],
      issues: [] as string[],
    };

    // ... populate summary from state

    await Bun.write(
      `.agent/summaries/summary_${iterationNum}.md`,
      formatSummary(summary)
    );
  }
}

function formatSummary(summary: Record<string, string[]>): string {
  return Object.entries(summary)
    .map(([key, items]) => `## ${key}\n${items.map((i) => `- ${i}`).join('\n')}`)
    .join('\n\n');
}
```

### 4. Clean Working Directory
```bash
# Remove unnecessary files
rm -f *.js
rm -rf node_modules
rm -f *.log

# Archive old iterations
tar -czf .agent/archive/iteration_1-50.tar.gz .agent/prompts/prompt_*.md
rm .agent/prompts/prompt_*.md
```

## Troubleshooting

### Context Overflow Symptoms

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Agent forgets earlier instructions | Context window full | Create checkpoint and reset |
| Incomplete responses | Hitting token limits | Reduce prompt size |
| Repeated work | Lost context | Use summaries |
| Errors about missing information | Context truncated | Split into smaller tasks |

### Recovery Strategies

```typescript
async function recoverFromContextOverflow(): Promise<string> {
  // 1. Save current state
  await saveState();

  // 2. Create summary of work done
  const summary = await createWorkSummary();

  // 3. Reset with minimal context
  const newPrompt = `
Continue from checkpoint. Previous work summary:
${summary}

Current task: ${await getCurrentTask()}
`;

  // 4. Resume with fresh context
  return newPrompt;
}

async function saveState(): Promise<void> {
  const state = {
    timestamp: new Date().toISOString(),
    iteration: getCurrentIteration(),
    context: getContext(),
  };
  await Bun.write('.agent/state/recovery.json', JSON.stringify(state, null, 2));
}

async function createWorkSummary(): Promise<string> {
  // Extract key accomplishments from recent outputs
  const recentOutputs = await getRecentOutputs(5);
  return recentOutputs
    .map((output, i) => `Iteration ${i + 1}: ${output.slice(0, 200)}...`)
    .join('\n');
}

async function getCurrentTask(): Promise<string> {
  const prompt = await Bun.file('PROMPT.md').text();
  const uncheckedTasks = prompt.match(/- \[ \] .+/g) ?? [];
  return uncheckedTasks[0] ?? 'Continue with remaining tasks';
}
```

## Agent-Specific Tips

### Claude (200K context)
- Can handle large codebases
- Include more context for better results
- Use for complex, multi-file tasks

### Gemini (32K context)
- Balance between context and detail
- Good for medium-sized projects
- Optimize file inclusion

### Q Chat (8K context)
- Minimize context aggressively
- Focus on single files/functions
- Use for targeted tasks

## Configuration

```typescript
interface ContextManagementConfig {
  maxPromptSize: number;
  maxFileSize: number;
  maxFilesIncluded: number;
  compressionEnabled: boolean;
  slidingWindowSize: number;
  checkpointOnHighUsage: boolean;
  usageWarningThreshold: number;
  usageCriticalThreshold: number;
}

const defaultContextConfig: ContextManagementConfig = {
  maxPromptSize: 5000,
  maxFileSize: 10000,
  maxFilesIncluded: 10,
  compressionEnabled: true,
  slidingWindowSize: 5,
  checkpointOnHighUsage: true,
  usageWarningThreshold: 80,
  usageCriticalThreshold: 95,
};
```

## TypeScript Context Manager

The TypeScript implementation provides a `ContextManager` class in `src/context/manager.ts`:

```typescript
import { ContextManager } from './context/index.ts';

const contextManager = new ContextManager({
  promptFile: 'PROMPT.md',
  maxContextSize: 8000,
  cacheDir: '.agent/cache',
});

// Get current prompt
const prompt = await contextManager.getPrompt();

// Update context with agent output
contextManager.updateContext(agentOutput);

// Check for completion
const isComplete = await contextManager.hasCompletionMarker();

// Save/restore context
await contextManager.saveToCache('session-key');
await contextManager.loadFromCache('session-key');
```
