---
name: sonar-scan
description: Execute SonarQube code quality scan
---

You are a SonarQube scanning agent. Execute a code quality scan on the current project.

## Context

- **Scan Mode**: {{scan_mode}} (changed or full)
- **Project Path**: {{project_path}}
- **SonarQube URL**: {{sonarqube_url}}

## Tasks

### 1. Pre-flight Checks

Before starting the scan, verify the environment:

- Check if SonarQube container is running using docker_ops module
- Verify configuration file exists at ~/.config/sonarqube/config.yml
- Confirm current directory is a git repository
- Load SonarQube configuration (URL, token, project key)

If any checks fail, report the issue and provide remediation steps.

### 2. Detect Scan Scope

Determine what files need to be scanned based on scan mode:

**For 'changed' mode:**
- Run: `git status --porcelain | grep -E "^[AM]"`
- Parse the output to get list of modified and added files
- If no changes detected, exit with message: "No changes to scan"
- Log the number of files to be scanned

**For 'full' mode:**
- Scan entire project (no file filtering)
- Log that full project scan will be performed

### 3. Execute Scanner

Run the SonarQube scanner:

- Use the scan_ops.executeScan() function from .adws/adw_modules/scan_ops.ts
- Pass scan mode and detected files (if changed mode)
- Monitor scanner output and log progress
- Handle scanner errors gracefully:
  - If container not running, suggest running setup
  - If authentication fails, check token configuration
  - If project not found, suggest creating project first

### 4. Wait for Scan Completion

- Extract task ID from scanner output
- Use scan_ops.waitForScanCompletion() to poll task status
- Show progress updates every 30 seconds
- Handle timeout gracefully (suggest checking SonarQube logs)

### 5. Fetch and Analyze Results

Once scan completes, run the results analyzer:

- Execute: `bun run ./.adws/adw_sonar_results.ts`
- This will automatically:
  - Fetch quality gate status and all metrics
  - Retrieve all issues with full details
  - Display formatted summary and top priority issues
  - Save structured output to `.adws/scan_issues.json`

### 6. Display Actionable Issues

The results viewer will show:

- Quality gate status (PASSED/FAILED)
- Issue counts by type and severity
- Code metrics (lines, duplication)
- **Top 10 high-priority issues** with:
  - File path and line number
  - Problem description
  - Rule ID
  - Link to SonarQube for details
  - **NO time estimates** (time is irrelevant)

### 7. Save Structured Output

All issues are saved to `.adws/scan_issues.json` with:

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
      "key": "...",
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

## Error Handling

If errors occur at any stage:

1. **Container Not Running**: Suggest running `/sonar-setup` first
2. **Authentication Failed**: Check token in config.yml
3. **Project Not Found**: Provide instructions to create project in SonarQube UI
4. **Scanner Failed**: Show scanner logs and suggest checking exclusions
5. **Timeout**: Provide SonarQube logs and suggest increasing timeout

## Success Criteria

The scan is considered successful when:

- Scanner executes without errors
- Task completes with SUCCESS status
- Results are fetched from API
- Report is generated and saved
- Quality gate status is determined

## Notes

- Use the ADW modules in .adws/adw_modules/ for all operations
- Do not execute raw Docker commands directly; use docker_ops module
- All file operations should use absolute paths
- Log progress at each step for observability
