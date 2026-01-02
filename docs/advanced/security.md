# Security Considerations

## Overview

Ralph Orchestrator executes AI agents with significant system access. This document outlines security considerations and best practices for safe operation.

## Threat Model

### Potential Risks

1. **Unintended Code Execution**
   - AI agents may generate and execute harmful code
   - File system modifications beyond project scope
   - System command execution

2. **Data Exposure**
   - API keys in prompts or code
   - Sensitive data in Git history
   - Credentials in state files

3. **Resource Exhaustion**
   - Infinite loops in generated code
   - Excessive API calls
   - Disk space consumption

4. **Supply Chain**
   - Compromised AI CLI tools
   - Malicious prompt injection
   - Dependency vulnerabilities

## Security Controls

Ralph implements multiple security layers to protect against threats:

```
 Security Defense Layers

   +-------------------+
   |    User Input     |
   +-------------------+
     |
     |
     v
   +-------------------+
   | Input Validation  |
   +-------------------+
     |
     |
     v
   +-------------------+
   | Process Isolation |
   +-------------------+
     |
     |
     v
   +-------------------+
   |  File Boundaries  |
   +-------------------+
     |
     |
     v
   +-------------------+
   |    Git Safety     |
   +-------------------+
     |
     |
     v
   +-------------------+
   | Env Sanitization  |
   +-------------------+
     |
     |
     v
   +-------------------+
   |     AI Agent      |
   +-------------------+
```

<details>
<summary>graph-easy source</summary>

```
graph { label: "Security Defense Layers"; flow: south; }
[ User Input ] { shape: rounded; } -> [ Input Validation ]
[ Input Validation ] -> [ Process Isolation ]
[ Process Isolation ] -> [ File Boundaries ]
[ File Boundaries ] -> [ Git Safety ]
[ Git Safety ] -> [ Env Sanitization ]
[ Env Sanitization ] -> [ AI Agent ] { shape: rounded; }
```

</details>

### Process Isolation

Ralph runs AI agents in subprocesses using Bun's `spawn()` API with:

- Timeout protection (5 minutes default)
- Output size limits
- Error boundaries

```typescript
const proc = Bun.spawn(command, {
  cwd: options.cwd,
  env: filteredEnv,  // Sanitized environment
  stdout: 'pipe',
  stderr: 'pipe',
});

// Handle timeout
let timeoutId: Timer | undefined;
if (options.timeout) {
  timeoutId = setTimeout(() => {
    proc.kill();
  }, options.timeout);
}

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);

if (timeoutId) {
  clearTimeout(timeoutId);
}
```

### File System Boundaries

#### Restricted Paths

- Work within project directory
- No access to system files
- Preserve .git integrity

#### Safe Defaults

```typescript
import { resolve, relative, isAbsolute } from 'node:path';

function validatePath(path: string, projectRoot: string = process.cwd()): boolean {
  const absolutePath = isAbsolute(path) ? path : resolve(projectRoot, path);
  const relativePath = relative(projectRoot, absolutePath);

  // Ensure path doesn't escape project directory
  return !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function sanitizePath(path: string, projectRoot: string = process.cwd()): string {
  if (!validatePath(path, projectRoot)) {
    throw new Error(`Path ${path} is outside project directory`);
  }
  return resolve(projectRoot, path);
}
```

### Git Safety

#### Protected Operations

- No force pushes
- No branch deletion
- No history rewriting

#### Checkpoint-Only Commits

```typescript
import { createCheckpoint } from './utils/git.ts';

// Ralph only creates checkpoint commits
await createCheckpoint(iteration, 'Checkpoint message');

// Internal implementation uses safe git commands
async function safeGitCommit(message: string): Promise<void> {
  // Stage all changes
  await Bun.spawn(['git', 'add', '.']).exited;

  // Commit without dangerous flags
  await Bun.spawn([
    'git', 'commit',
    '-m', message,
    '--no-gpg-sign',  // Avoid GPG issues
  ]).exited;
}
```

### Environment Sanitization

#### Filtered Variables

```typescript
const SAFE_ENV_VARS = [
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'LC_ALL',
  'TERM',
  'BUN_INSTALL',
  'NODE_ENV',
];

function getSafeEnv(): Record<string, string> {
  const safeEnv: Record<string, string> = {};

  for (const key of SAFE_ENV_VARS) {
    const value = process.env[key];
    if (value) {
      safeEnv[key] = value;
    }
  }

  return safeEnv;
}
```

#### No Credential Exposure

- Never pass API keys through environment
- Agents should use their own credential stores
- No secrets in prompts or logs

## Best Practices

### 1. Prompt Security

#### DO

- Review prompts before execution
- Use specific, bounded instructions
- Include safety constraints

#### DON'T

- Include credentials in prompts
- Request system-level changes
- Use unbounded iterations

### 2. Agent Configuration

#### Claude

```bash
# Use with appropriate flags
claude --print PROMPT.md
```

#### Gemini

```bash
# Limit context and capabilities
gemini --no-web PROMPT.md
```

### 3. Repository Setup

#### .gitignore

```gitignore
# Security-sensitive files
*.key
*.pem
.env
.env.*
.env.local
.env.production
secrets/
credentials/

# Ralph workspace
.agent/metrics/
.agent/logs/
.agent/cache/

# Bun
bun.lockb

# Node
node_modules/
```

#### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files

  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ["--baseline", ".secrets.baseline"]
```

### 4. Runtime Monitoring

#### Resource Monitoring

```typescript
// Monitor memory usage
function checkMemoryUsage(maxMB: number = 1024): boolean {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

  if (heapUsedMB > maxMB) {
    console.warn(`Memory usage high: ${heapUsedMB.toFixed(0)}MB`);
    return false;
  }

  return true;
}

// Monitor CPU time
function checkCpuTime(startTime: number, maxSeconds: number = 3600): boolean {
  const elapsed = (Date.now() - startTime) / 1000;

  if (elapsed > maxSeconds) {
    console.warn(`CPU time exceeded: ${elapsed.toFixed(0)}s`);
    return false;
  }

  return true;
}
```

#### Audit Logging

```typescript
interface AuditLog {
  event: string;
  agent: string;
  timestamp: number;
  user: string;
  promptHash: string;
  success: boolean;
  duration?: number;
}

async function logAuditEvent(log: AuditLog): Promise<void> {
  const logLine = JSON.stringify(log);
  const auditFile = Bun.file('.agent/logs/audit.jsonl');

  const existing = await auditFile.exists() ? await auditFile.text() : '';
  await Bun.write(auditFile, existing + logLine + '\n');
}

// Usage
await logAuditEvent({
  event: 'agent_execution',
  agent: 'claude',
  timestamp: Date.now(),
  user: process.env.USER ?? 'unknown',
  promptHash: await hashPrompt(prompt),
  success: true,
  duration: 15.5,
});

async function hashPrompt(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

## Security Checklist

### Before Running Ralph

- [ ] Review PROMPT.md for unsafe instructions
- [ ] Check no credentials in prompt
- [ ] Verify working directory is correct
- [ ] Ensure Git repository is backed up
- [ ] Confirm agent tools are up-to-date

### During Execution

- [ ] Monitor resource usage
- [ ] Watch for unexpected file changes
- [ ] Check agent output for anomalies
- [ ] Verify checkpoints are created
- [ ] Ensure no sensitive data in logs

### After Completion

- [ ] Review generated code for security issues
- [ ] Check Git history for exposed secrets
- [ ] Verify no system files were modified
- [ ] Clean up temporary files
- [ ] Rotate any potentially exposed credentials

## Incident Response

### If Compromise Suspected

1. **Immediate Actions**

   ```bash
   # Stop Ralph
   pkill -f "bun run"

   # Preserve evidence
   cp -r .agent /tmp/ralph-incident-$(date +%s)

   # Check for modifications
   git status
   git diff
   ```

2. **Investigation**
   - Review .agent/metrics/state.json
   - Check system logs
   - Examine Git history
   - Analyze agent outputs

3. **Recovery**

   ```bash
   # Reset to last known good state
   git reset --hard <last-good-commit>

   # Clean workspace
   rm -rf .agent

   # Rotate credentials if needed
   # Update API keys for affected services
   ```

## Sandboxing Options

### Docker Container

```dockerfile
FROM oven/bun:1
RUN useradd -m -s /bin/bash ralph
USER ralph
WORKDIR /home/ralph/project
COPY --chown=ralph:ralph . .
CMD ["bun", "run", "cli", "run"]
```

### Virtual Machine

```bash
# Run in VM with snapshot
vagrant up
vagrant ssh -c "cd /project && bun run cli run"
vagrant snapshot restore clean
```

### Restricted User

```bash
# Create restricted user
sudo useradd -m -s /bin/bash ralph-runner
sudo usermod -L ralph-runner  # No password login

# Run as restricted user
sudo -u ralph-runner bun run cli run
```

## API Key Management

### Secure Storage

#### Never Store Keys In

- PROMPT.md files
- Git repositories
- Environment variables in scripts
- Log files

#### Recommended Approaches

1. Agent-specific credential stores
2. System keychain/keyring
3. Encrypted vault (e.g., HashiCorp Vault)
4. Cloud secret managers (AWS Secrets Manager, GCP Secret Manager)

### Environment Variables with .env

```typescript
// Bun automatically loads .env files
// Create .env.local (gitignored) for local development

// .env.local
ANTHROPIC_API_KEY=sk-ant-...

// Access in code
const apiKey = process.env.ANTHROPIC_API_KEY;
```

### Key Rotation

```bash
# Regular rotation schedule
# 1. Generate new keys from provider dashboard
# 2. Update local .env files
# 3. Test with new keys
# 4. Revoke old keys in provider dashboard
```

## Compliance Considerations

### Data Privacy

- Don't process PII in prompts
- Sanitize outputs before sharing
- Comply with data residency requirements

### Audit Trail

- Maintain execution logs
- Track prompt modifications
- Document agent interactions

### Access Control

- Limit who can run Ralph
- Restrict agent permissions
- Control repository access

## Security Updates

Stay current with:

- Bun runtime updates
- AI CLI tool updates
- TypeScript/npm security patches
- Git security advisories
- Dependency vulnerabilities

```bash
# Check for updates
bun upgrade

# Update AI CLI tools
npm update -g @anthropic-ai/claude-code

# Check for vulnerabilities
bun pm audit

# Update dependencies
bun update
```

## Input Validation

### Prompt Validation

```typescript
interface PromptValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

function validatePrompt(prompt: string): PromptValidationResult {
  const result: PromptValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
  };

  // Check for potential secrets
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9-_]{20,}/i,
    /password\s*[:=]\s*["']?[^\s"']+/i,
    /sk-[a-zA-Z0-9]{20,}/,  // OpenAI/Anthropic key format
    /ghp_[a-zA-Z0-9]{36}/,  // GitHub token
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(prompt)) {
      result.errors.push('Potential secret detected in prompt');
      result.valid = false;
    }
  }

  // Check for dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,
    /sudo\s+/,
    /chmod\s+777/,
    /curl\s+.*\|\s*bash/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(prompt)) {
      result.warnings.push('Potentially dangerous command in prompt');
    }
  }

  // Check prompt length
  if (prompt.length > 100000) {
    result.warnings.push('Prompt exceeds recommended length');
  }

  return result;
}
```

### Output Sanitization

```typescript
function sanitizeOutput(output: string): string {
  // Remove potential secrets from output
  let sanitized = output;

  // Mask API keys
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***');

  // Mask GitHub tokens
  sanitized = sanitized.replace(/ghp_[a-zA-Z0-9]{36}/g, 'ghp_***REDACTED***');

  // Mask generic API keys
  sanitized = sanitized.replace(
    /api[_-]?key["']?\s*[:=]\s*["']?([a-zA-Z0-9-_]{20,})["']?/gi,
    'api_key=***REDACTED***'
  );

  return sanitized;
}
```

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email security report to the maintainers
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and provide fixes promptly.
