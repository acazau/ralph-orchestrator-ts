#!/usr/bin/env bun
/**
 * SonarQube Scan CLI - Multi-Phase Sub-Agent Workflow
 *
 * Each sub-agent is a separate promptClaudeSdk() call with state persistence.
 *
 * Phases:
 * 1. docker-manager (Haiku) - Check/start container
 * 2. scan-executor (Sonnet) - Execute scan
 * 3. result-analyzer (Haiku) - Fetch and format results
 *
 * Usage:
 *   bun run ./.adws/adw_sonar_scan.ts [mode]
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { promptClaudeSdk } from './adw_modules/agent';
import { generateShortId } from './adw_modules/utils';
import type { ScanMode } from './adw_modules/data_types';

// ============================================================================
// CONFIGURATION
// ============================================================================

async function loadConfig() {
    const configPath = `${process.env.HOME}/.config/sonarqube/config.yml`;
    const configText = await readFile(configPath, 'utf-8');
    const lines = configText.split('\n');
    const config: any = {};

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('url:')) {
            config.url = trimmed.split('url:')[1].trim();
        } else if (trimmed.startsWith('token:')) {
            config.token = trimmed.split('token:')[1].trim();
        } else if (trimmed.startsWith('- ') && !config.exclusions) {
            config.exclusions = [];
        }
        if (config.exclusions && trimmed.startsWith('- ')) {
            config.exclusions.push(trimmed.substring(2).trim().replace(/['"]/g, ''));
        }
    }
    return config;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface WorkflowState {
    adwId: string;
    phase: string;
    dockerStatus?: { running: boolean; healthy: boolean };
    scanStatus?: { success: boolean; filesAnalyzed?: number };
    resultsStatus?: { success: boolean; outputFile?: string };
}

async function saveState(outputDir: string, state: WorkflowState) {
    await writeFile(join(outputDir, 'adw_state.json'), JSON.stringify(state, null, 2));
}

// ============================================================================
// PHASE 1: DOCKER MANAGER (Haiku)
// ============================================================================

async function runDockerManager(adwId: string, outputDir: string): Promise<boolean> {
    console.log('\n📦 Phase 1: Docker Manager (Haiku)');
    console.log('-'.repeat(50));

    const agentDir = join(outputDir, 'docker-manager');
    await mkdir(agentDir, { recursive: true });

    const response = await promptClaudeSdk({
        prompt: `You are a Docker container manager. Check if the SonarQube container is running and healthy.

## Tasks

1. Check if container "ralph-sonarqube" is running:
   docker ps --filter "name=ralph-sonarqube" --format "{{.Status}}"

2. If not running, check if it exists:
   docker ps -a --filter "name=ralph-sonarqube" --format "{{.Status}}"

3. If exists but stopped, start it:
   docker start ralph-sonarqube

4. Check SonarQube health:
   curl -s http://localhost:9000/api/system/status

5. Report status as JSON:
   {"running": true/false, "healthy": true/false, "message": "..."}

Keep responses brief. Use only docker and curl commands.`,
        adwId,
        agentName: 'docker-manager',
        outputFile: join(agentDir, 'cc_raw_output.jsonl'),
        workingDir: process.cwd(),
        maxTurns: 10,
        dangerouslySkipPermissions: true,  // bypass permission prompts for sub-agents
    });

    console.log(response.success ? '✓ Docker check complete' : '✗ Docker check failed');
    console.log(response.output.substring(0, 500));

    // Parse response for status
    const healthy = response.output.toLowerCase().includes('"healthy": true') ||
                    response.output.toLowerCase().includes('status":"up') ||
                    response.output.includes('UP');

    return healthy;
}

// ============================================================================
// PHASE 2: SCAN EXECUTOR (Sonnet)
// ============================================================================

async function runScanExecutor(
    adwId: string,
    outputDir: string,
    config: any,
    mode: ScanMode
): Promise<boolean> {
    console.log('\n🔍 Phase 2: Scan Executor (Sonnet)');
    console.log('-'.repeat(50));

    const agentDir = join(outputDir, 'scan-executor');
    await mkdir(agentDir, { recursive: true });

    const exclusions = config.exclusions?.join(',') || 'node_modules/**,dist/**,build/**';

    const response = await promptClaudeSdk({
        prompt: `You are a SonarQube scan executor. Run a code quality scan with coverage.

## Configuration
- Mode: ${mode}
- Project Key: ralph-orchestrator-ts
- SonarQube URL (for scanner): http://host.docker.internal:9000
- Token: ${config.token}
- Exclusions: ${exclusions}

## Tasks

1. Generate test coverage report (REQUIRED for coverage metrics):
   bun test --coverage --coverage-reporter=lcov

2. Verify coverage file was created:
   ls -la coverage/lcov.info

3. If mode is "changed", detect files to scan:
   git diff --name-only HEAD 2>/dev/null || echo "new repo"
   git diff --cached --name-only
   git ls-files --others --exclude-standard | head -20

4. Execute SonarScanner with coverage:
   docker run --rm \\
     -e SONAR_HOST_URL="http://host.docker.internal:9000" \\
     -e SONAR_TOKEN="${config.token}" \\
     -v "$(pwd):/usr/src" \\
     sonarsource/sonar-scanner-cli \\
     -Dsonar.projectKey=ralph-orchestrator-ts \\
     -Dsonar.projectName="Ralph Orchestrator TypeScript" \\
     -Dsonar.sources=src \\
     -Dsonar.tests=tests \\
     -Dsonar.typescript.lcov.reportPaths=coverage/lcov.info \\
     -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \\
     -Dsonar.exclusions="${exclusions}"

5. Report result:
   {"success": true/false, "filesAnalyzed": N, "message": "..."}

Execute the scan now. Make sure to run tests with coverage FIRST before running the scanner.`,
        adwId,
        agentName: 'scan-executor',
        outputFile: join(agentDir, 'cc_raw_output.jsonl'),
        workingDir: process.cwd(),
        maxTurns: 15,
        dangerouslySkipPermissions: true,  // bypass permission prompts for sub-agents
    });

    console.log(response.success ? '✓ Scan complete' : '✗ Scan failed');
    console.log(response.output.substring(0, 800));

    return response.success && !response.output.toLowerCase().includes('error');
}

// ============================================================================
// PHASE 3: RESULT ANALYZER (Haiku)
// ============================================================================

async function runResultAnalyzer(
    adwId: string,
    outputDir: string,
    config: any
): Promise<boolean> {
    console.log('\n📊 Phase 3: Result Analyzer (Haiku)');
    console.log('-'.repeat(50));

    const agentDir = join(outputDir, 'result-analyzer');
    await mkdir(agentDir, { recursive: true });

    const response = await promptClaudeSdk({
        prompt: `You are a SonarQube results analyzer. Fetch and display scan results.

## Configuration
- URL: ${config.url}
- Token: ${config.token}
- Project: ralph-orchestrator-ts

## Tasks

1. Fetch quality gate:
   curl -s -u "${config.token}:" "${config.url}/api/qualitygates/project_status?projectKey=ralph-orchestrator-ts"

2. Fetch metrics:
   curl -s -u "${config.token}:" "${config.url}/api/measures/component?component=ralph-orchestrator-ts&metricKeys=bugs,vulnerabilities,code_smells,security_hotspots,coverage,duplicated_lines_density,ncloc"

3. Fetch issues (top 50):
   curl -s -u "${config.token}:" "${config.url}/api/issues/search?componentKeys=ralph-orchestrator-ts&ps=50&s=SEVERITY&asc=false"

4. Display summary:
   - Quality gate status (PASSED/FAILED)
   - Bugs, Vulnerabilities, Code Smells counts
   - Top 10 issues with file:line and message
   - NO time estimates

5. Save results to .adws/scan_issues.json with structure:
   {"summary": {...}, "issues": [...]}

Use Write tool to save the JSON file.`,
        adwId,
        agentName: 'result-analyzer',
        outputFile: join(agentDir, 'cc_raw_output.jsonl'),
        workingDir: process.cwd(),
        maxTurns: 15,
        dangerouslySkipPermissions: true,  // bypass permission prompts for sub-agents
    });

    console.log(response.success ? '✓ Analysis complete' : '✗ Analysis failed');
    console.log(response.output);

    return response.success;
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const mode: ScanMode = (args[0] as ScanMode) || 'changed';

    if (mode !== 'changed' && mode !== 'full') {
        console.error(`Invalid mode: ${mode}. Use 'changed' or 'full'.`);
        process.exit(1);
    }

    // Load config
    console.log('Loading configuration...');
    const config = await loadConfig();
    console.log(`✓ Config loaded (URL: ${config.url})`);

    // Generate ADW ID
    const adwId = generateShortId();
    const outputDir = join(process.cwd(), '.adws', 'agents', adwId);
    await mkdir(outputDir, { recursive: true });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`SonarQube Scan Workflow`);
    console.log(`ADW ID: ${adwId}`);
    console.log(`Mode: ${mode}`);
    console.log('='.repeat(60));

    // Initialize state
    const state: WorkflowState = { adwId, phase: 'starting' };

    try {
        // Phase 1: Docker Manager
        state.phase = 'docker-manager';
        const dockerHealthy = await runDockerManager(adwId, outputDir);
        state.dockerStatus = { running: true, healthy: dockerHealthy };
        await saveState(outputDir, state);

        if (!dockerHealthy) {
            console.error('\n❌ SonarQube container not healthy. Run setup first.');
            process.exit(1);
        }

        // Phase 2: Scan Executor
        state.phase = 'scan-executor';
        const scanSuccess = await runScanExecutor(adwId, outputDir, config, mode);
        state.scanStatus = { success: scanSuccess };
        await saveState(outputDir, state);

        if (!scanSuccess) {
            console.error('\n❌ Scan failed. Check logs above.');
            process.exit(1);
        }

        // Phase 3: Result Analyzer
        state.phase = 'result-analyzer';
        const analysisSuccess = await runResultAnalyzer(adwId, outputDir, config);
        state.resultsStatus = { success: analysisSuccess, outputFile: '.adws/scan_issues.json' };
        await saveState(outputDir, state);

        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('Workflow Complete');
        console.log('='.repeat(60));
        console.log(`✓ Phase 1: Docker Manager - Container healthy`);
        console.log(`✓ Phase 2: Scan Executor - Scan ${scanSuccess ? 'succeeded' : 'completed'}`);
        console.log(`✓ Phase 3: Result Analyzer - Results ${analysisSuccess ? 'saved' : 'displayed'}`);
        console.log(`\nOutputs: ${outputDir}`);
        console.log(`Issues: .adws/scan_issues.json`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error(`\n❌ Workflow error in phase ${state.phase}:`, error);
        await saveState(outputDir, { ...state, phase: `error:${state.phase}` });
        process.exit(1);
    }
}

main().catch(console.error);
