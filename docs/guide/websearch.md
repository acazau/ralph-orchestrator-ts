# WebSearch Integration Guide

## Overview

Ralph Orchestrator now includes full WebSearch support for the Claude adapter, enabling Claude to search the web for current information, research topics, and access data beyond its knowledge cutoff.

## Features

WebSearch allows Claude to:
- Search for current events and recent news
- Research technical documentation and best practices
- Find up-to-date information about libraries and frameworks
- Gather data from multiple sources
- Access real-time information (weather, stock prices, etc.)

## Configuration

### Default Configuration

WebSearch is **enabled by default** when using the Claude adapter. No additional configuration is required.

### Explicit Configuration

You can explicitly control WebSearch in several ways:

#### 1. Via CLI (Automatic)

When using Ralph with Claude, WebSearch is automatically enabled:

```bash
bun run cli run -a claude  # WebSearch is enabled by default
```

#### 2. Via Adapter Configuration

```typescript
import { ClaudeAdapter } from './adapters/claude.js';

// Create adapter with WebSearch enabled (default)
const adapter = new ClaudeAdapter();
adapter.configure({ enableWebSearch: true });  // This is the default

// Or disable WebSearch if needed
adapter.configure({ enableWebSearch: false });
```

#### 3. Via Orchestrator

```typescript
import { RalphOrchestrator } from './orchestrator.js';

const orchestrator = new RalphOrchestrator({
  promptFile: 'TASK.md',
  primaryTool: 'claude'
});

// Claude adapter automatically has WebSearch enabled
await orchestrator.run();
```

## Usage Examples

### Example 1: Research Current Topics

```typescript
const adapter = new ClaudeAdapter();
adapter.configure({ enableAllTools: true });

const response = await adapter.execute(`
  Search the web for the latest developments in quantum computing
  and create a summary of the most significant breakthroughs in 2024.
`);
```

### Example 2: Technical Documentation Research

```typescript
const response = await adapter.execute(`
  Use WebSearch to find the latest best practices for TypeScript async programming.
  Compare different approaches and provide recommendations.
`, { enableWebSearch: true });
```

### Example 3: Real-time Information

```typescript
const response = await adapter.execute(`
  Search for current weather conditions in major tech hubs:
  - San Francisco
  - Seattle
  - Austin
  - New York

  Also find the current stock prices for major tech companies.
`, { enableAllTools: true });
```

### Example 4: Framework Research

```typescript
const response = await adapter.execute(`
  Research the latest features in React 19 and Next.js 15.
  Use WebSearch to find migration guides and breaking changes.
  Create a comparison table of new features.
`);
```

## Combining with Other Tools

WebSearch works seamlessly with other Claude tools:

```typescript
const response = await adapter.execute(`
  1. Use WebSearch to find the latest TypeScript web framework benchmarks
  2. Create a comparison table in a file called benchmarks.md
  3. Search local codebase for current framework usage
  4. Provide recommendations based on findings
`, { enableAllTools: true });
```

## Testing WebSearch

Run the included test script to verify WebSearch functionality:

```bash
bun test test/websearch.test.ts
```

This will test:
- Basic WebSearch functionality
- WebSearch with specific tool lists
- Async WebSearch operations

## Best Practices

1. **Be Specific**: Provide clear search queries for better results
2. **Combine Sources**: Use WebSearch with local file analysis for comprehensive research
3. **Verify Information**: Cross-reference important information from multiple searches
4. **Time-Sensitive Data**: Use WebSearch for current events, prices, and recent developments
5. **Documentation**: Search for official documentation and recent updates

## Security Considerations

When WebSearch is enabled, Claude can:
- Access any publicly available web content
- Make HTTP/HTTPS requests to external sites
- Process and analyze web page content

Consider your security requirements when enabling WebSearch in production environments.

## Troubleshooting

### WebSearch Not Working

1. Verify Claude SDK is installed:
   ```bash
   bun install @anthropic-ai/sdk
   ```

2. Check if WebSearch is enabled:
   ```typescript
   const adapter = new ClaudeAdapter({ verbose: true });
   adapter.configure({
     enableWebSearch: true,
     enableAllTools: true
   });
   ```

3. Test with a simple query:
   ```typescript
   const response = await adapter.execute(
     "What is the current date?",
     { enableWebSearch: true }
   );
   ```

### Rate Limiting

WebSearch may be subject to rate limits. If you encounter issues:
- Add delays between searches
- Batch related queries together
- Use caching when appropriate

## Advanced Configuration

### Custom Tool Lists with WebSearch

```typescript
// Enable only specific tools including WebSearch
adapter.configure({
  allowedTools: ['WebSearch', 'Read', 'Write', 'Edit'],
  enableWebSearch: true
});
```

### Conditional WebSearch

```typescript
// Enable WebSearch only for specific tasks
if (taskRequiresResearch) {
  adapter.configure({ enableWebSearch: true });
} else {
  adapter.configure({ enableWebSearch: false });
}
```

## Integration with Ralph Workflows

WebSearch enhances Ralph's capabilities in various workflows:

1. **Documentation Generation**: Research and create up-to-date documentation
2. **Dependency Updates**: Find latest versions and migration guides
3. **Bug Investigation**: Search for known issues and solutions
4. **Best Practices**: Research current industry standards
5. **API Integration**: Find API documentation and examples

## Performance Tips

- Cache search results when appropriate
- Batch related searches together
- Use specific search queries for faster results
- Combine with local tools for comprehensive analysis

## Future Enhancements

Planned improvements for WebSearch integration:
- Search result caching
- Custom search providers
- Advanced filtering options
- Search history tracking
- Offline fallback options
