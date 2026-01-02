/**
 * Scan Operations Module - SonarQube Scanner Execution
 *
 * This module handles the execution of SonarQube scans including:
 * - Changed file detection via Git
 * - Scanner execution via Docker
 * - Scan progress monitoring
 * - Report generation
 *
 * Key Functions:
 * - detectChangedFiles - Git integration for changed-file detection
 * - executeScan - Docker-based scanner execution
 * - waitForScanCompletion - Progress monitoring
 * - generateScanReport - Report generation
 */

import { spawn } from 'bun';
import { join } from 'path';
import type { ScanResult, ScanMode } from './data_types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SCANNER_IMAGE = 'sonarsource/sonar-scanner-cli:latest';
const DEFAULT_SONAR_HOST_URL = 'http://host.docker.internal:9000';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Execute a shell command and return the result.
 *
 * @param cmd - Command and arguments
 * @param cwd - Working directory
 * @returns Object with stdout, stderr, and exitCode
 */
async function executeCommand(
    cmd: string[],
    cwd?: string
): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}> {
    try {
        const proc = spawn({
            cmd,
            cwd: cwd || process.cwd(),
            stdout: 'pipe',
            stderr: 'pipe',
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        return { stdout, stderr, exitCode };
    } catch (error) {
        return {
            stdout: '',
            stderr: (error as Error).message,
            exitCode: 1,
        };
    }
}

// ============================================================================
// GIT INTEGRATION
// ============================================================================

/**
 * Detect changed files in the Git repository.
 *
 * Uses `git status --porcelain` to find modified and added files.
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Array of changed file paths
 */
export async function detectChangedFiles(cwd?: string): Promise<string[]> {
    const result = await executeCommand(['git', 'status', '--porcelain'], cwd);

    if (result.exitCode !== 0) {
        console.warn(`Git status failed: ${result.stderr}`);
        return [];
    }

    // Parse git status output
    // Format: "XY filename" where X is staged, Y is unstaged
    // We care about: M (modified), A (added), ? (untracked)
    const changedFiles: string[] = [];
    const lines = result.stdout.split('\n').filter((line) => line.trim());

    for (const line of lines) {
        const match = line.match(/^([ MADRCU?!]{2})\s+(.+)$/);
        if (match) {
            const [, status, filepath] = match;
            // Include modified (M), added (A), and untracked (?) files
            if (status.includes('M') || status.includes('A') || status.includes('?')) {
                changedFiles.push(filepath.trim());
            }
        }
    }

    return changedFiles;
}

/**
 * Get the project root directory (Git repository root).
 *
 * @param cwd - Working directory (defaults to process.cwd())
 * @returns Project root path
 */
export async function getProjectRoot(cwd?: string): Promise<string> {
    const result = await executeCommand(['git', 'rev-parse', '--show-toplevel'], cwd);

    if (result.exitCode !== 0) {
        throw new Error(`Not a git repository: ${result.stderr}`);
    }

    return result.stdout.trim();
}

// ============================================================================
// SCANNER EXECUTION
// ============================================================================

/**
 * Execute a SonarQube scan.
 *
 * Runs the SonarQube scanner via Docker with the specified mode and files.
 *
 * @param mode - Scan mode ('changed' for incremental, 'full' for complete)
 * @param options - Scan options
 * @returns Scan result
 */
export async function executeScan(
    mode: ScanMode,
    options: {
        projectKey: string;
        projectName?: string;
        sonarHostUrl?: string;
        sonarToken: string;
        files?: string[];
        cwd?: string;
        exclusions?: string[];
    }
): Promise<ScanResult> {
    const startTime = Date.now();
    const projectRoot = options.cwd || process.cwd();
    const sonarHostUrl = options.sonarHostUrl || DEFAULT_SONAR_HOST_URL;

    console.log(`Starting ${mode} scan for project: ${options.projectKey}`);

    // Prepare scanner properties
    const scannerProps: string[] = [
        `-Dsonar.projectKey=${options.projectKey}`,
        `-Dsonar.host.url=${sonarHostUrl}`,
        `-Dsonar.token=${options.sonarToken}`,
        '-Dsonar.sources=.',
    ];

    if (options.projectName) {
        scannerProps.push(`-Dsonar.projectName=${options.projectName}`);
    }

    // Exclusions are defined in sonar-project.properties
    // Only add extra exclusions if explicitly provided
    if (options.exclusions && options.exclusions.length > 0) {
        scannerProps.push(`-Dsonar.exclusions=${options.exclusions.join(',')}`);
    }

    // For changed mode, limit scan to specific files
    if (mode === 'changed' && options.files && options.files.length > 0) {
        console.log(`Scanning ${options.files.length} changed files`);
        scannerProps.push(`-Dsonar.inclusions=${options.files.join(',')}`);
    }

    // Build Docker command
    const dockerCmd = [
        'docker',
        'run',
        '--rm',
        '--network',
        'host',
        '-v',
        `${projectRoot}:/usr/src`,
        '-w',
        '/usr/src',
        SCANNER_IMAGE,
        ...scannerProps,
    ];

    console.log('Executing scanner...');

    // Execute scanner
    const result = await executeCommand(dockerCmd, projectRoot);

    const scanTime = Date.now() - startTime;

    if (result.exitCode !== 0) {
        console.error('Scanner failed:');
        console.error(result.stderr);

        return {
            success: false,
            projectKey: options.projectKey,
            bugs: 0,
            vulnerabilities: 0,
            codeSmells: 0,
            securityHotspots: 0,
            qualityGate: 'ERROR',
            dashboardUrl: `${sonarHostUrl}/dashboard?id=${options.projectKey}`,
            scanTime,
        };
    }

    console.log('Scanner completed successfully');

    // Extract task ID from output if available
    const taskIdMatch = result.stdout.match(/task\?id=([a-zA-Z0-9-]+)/);
    const taskId = taskIdMatch ? taskIdMatch[1] : undefined;

    return {
        success: true,
        projectKey: options.projectKey,
        bugs: 0, // Will be populated by result parser
        vulnerabilities: 0,
        codeSmells: 0,
        securityHotspots: 0,
        qualityGate: 'NONE', // Will be populated by result parser
        dashboardUrl: `${sonarHostUrl}/dashboard?id=${options.projectKey}`,
        scanTime,
        taskId,
    };
}

/**
 * Wait for a scan task to complete.
 *
 * Polls the SonarQube API to check task completion status.
 * Note: This requires the SonarQube API module to function.
 *
 * @param taskId - Task ID from scanner execution
 * @param sonarHostUrl - SonarQube server URL
 * @param sonarToken - Authentication token
 * @param timeoutSeconds - Maximum time to wait (default: 300)
 * @returns true if task completed successfully
 */
export async function waitForScanCompletion(
    taskId: string,
    sonarHostUrl: string,
    sonarToken: string,
    timeoutSeconds: number = 300
): Promise<boolean> {
    const maxAttempts = timeoutSeconds / 5; // Check every 5 seconds
    const apiUrl = `${sonarHostUrl}/api/ce/task?id=${taskId}`;

    console.log(`Waiting for scan task ${taskId} to complete...`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(apiUrl, {
                headers: {
                    Authorization: `Bearer ${sonarToken}`,
                },
            });

            if (!response.ok) {
                console.warn(`Failed to check task status: ${response.statusText}`);
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue;
            }

            const data = await response.json();
            const task = data.task;

            if (!task) {
                console.warn('Task not found in response');
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue;
            }

            console.log(`Task status: ${task.status}`);

            if (task.status === 'SUCCESS') {
                console.log('Scan task completed successfully');
                return true;
            } else if (task.status === 'FAILED' || task.status === 'CANCELED') {
                console.error(`Scan task ${task.status.toLowerCase()}`);
                return false;
            }

            // Task still in progress, wait and retry
            await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch (error) {
            console.warn(`Error checking task status: ${(error as Error).message}`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    console.error('Timeout waiting for scan completion');
    return false;
}

/**
 * Generate a formatted scan report.
 *
 * Creates a markdown report summarizing the scan results.
 *
 * @param result - Scan result object
 * @returns Markdown-formatted report
 */
export async function generateScanReport(result: ScanResult): Promise<string> {
    const lines: string[] = [];

    lines.push('# SonarQube Scan Report');
    lines.push('');
    lines.push(`**Project:** ${result.projectKey}`);
    lines.push(`**Status:** ${result.success ? '✅ Success' : '❌ Failed'}`);
    lines.push(`**Quality Gate:** ${result.qualityGate}`);
    lines.push(`**Scan Time:** ${(result.scanTime! / 1000).toFixed(2)}s`);
    lines.push('');

    lines.push('## Issues Summary');
    lines.push('');
    lines.push(`- **Bugs:** ${result.bugs}`);
    lines.push(`- **Vulnerabilities:** ${result.vulnerabilities}`);
    lines.push(`- **Code Smells:** ${result.codeSmells}`);
    lines.push(`- **Security Hotspots:** ${result.securityHotspots}`);
    lines.push('');

    if (result.coverage) {
        lines.push(`**Coverage:** ${result.coverage}`);
    }

    if (result.duplications) {
        lines.push(`**Duplications:** ${result.duplications}`);
    }

    lines.push('');
    lines.push(`[View Dashboard](${result.dashboardUrl})`);
    lines.push('');

    if (result.issues && result.issues.length > 0) {
        lines.push('## Top Issues');
        lines.push('');

        // Show up to 10 highest severity issues
        const topIssues = result.issues
            .slice(0, 10)
            .sort((a, b) => {
                const severityOrder = { BLOCKER: 0, CRITICAL: 1, MAJOR: 2, MINOR: 3, INFO: 4 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            });

        for (const issue of topIssues) {
            lines.push(`### ${issue.type}: ${issue.message}`);
            lines.push('');
            lines.push(`- **Severity:** ${issue.severity}`);
            lines.push(`- **Rule:** ${issue.rule}`);
            lines.push(`- **File:** ${issue.component}`);
            if (issue.line) {
                lines.push(`- **Line:** ${issue.line}`);
            }
            lines.push('');
        }
    }

    return lines.join('\n');
}
