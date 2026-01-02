/**
 * Result Parser Module - SonarQube Result Parsing and Formatting
 *
 * This module handles parsing and formatting of SonarQube scan results including:
 * - API response parsing
 * - Console formatting
 * - Markdown report generation
 * - Issue extraction and filtering
 *
 * Key Functions:
 * - parseScanResult - Parse API JSON responses
 * - formatSummary - Format for console display
 * - generateMarkdownReport - Generate markdown reports
 * - extractActionableIssues - Extract high-priority issues
 */

import type {
    ScanResult,
    SonarQubeIssue,
    QualityGateStatus,
} from './data_types';

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse SonarQube API response to ScanResult.
 *
 * @param apiResponse - Raw API response
 * @returns Parsed scan result
 */
export function parseScanResult(apiResponse: unknown): ScanResult {
    if (typeof apiResponse !== 'object' || apiResponse === null) {
        throw new Error('Invalid API response: expected object');
    }

    const response = apiResponse as any;

    return {
        success: response.success ?? true,
        projectKey: response.projectKey || 'unknown',
        bugs: response.bugs || 0,
        vulnerabilities: response.vulnerabilities || 0,
        codeSmells: response.codeSmells || response.code_smells || 0,
        securityHotspots: response.securityHotspots || response.security_hotspots || 0,
        coverage: response.coverage,
        duplications: response.duplications,
        qualityGate: (response.qualityGate || response.quality_gate || 'NONE') as QualityGateStatus,
        dashboardUrl: response.dashboardUrl || response.dashboard_url || '',
        issues: response.issues || [],
        scanTime: response.scanTime || response.scan_time,
        taskId: response.taskId || response.task_id,
    };
}

/**
 * Parse measures from SonarQube API to update scan result.
 *
 * @param result - Scan result to update
 * @param measures - Measures from API
 * @returns Updated scan result
 */
export function parseMeasures(
    result: ScanResult,
    measures: Record<string, string | undefined>
): ScanResult {
    return {
        ...result,
        bugs: parseInt(measures['bugs'] || '0', 10),
        vulnerabilities: parseInt(measures['vulnerabilities'] || '0', 10),
        codeSmells: parseInt(measures['code_smells'] || '0', 10),
        securityHotspots: parseInt(measures['security_hotspots'] || '0', 10),
        coverage: measures['coverage'],
        duplications: measures['duplicated_lines_density'],
    };
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format scan result summary for console display.
 *
 * @param result - Scan result
 * @returns Formatted summary string
 */
export function formatSummary(result: ScanResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('SonarQube Scan Summary');
    lines.push('='.repeat(60));
    lines.push('');

    // Status
    const statusIcon = result.success ? '✓' : '✗';
    const statusText = result.success ? 'SUCCESS' : 'FAILED';
    lines.push(`Status: ${statusIcon} ${statusText}`);
    lines.push(`Project: ${result.projectKey}`);
    lines.push(`Quality Gate: ${formatQualityGateStatus(result.qualityGate)}`);

    if (result.scanTime) {
        lines.push(`Scan Time: ${(result.scanTime / 1000).toFixed(2)}s`);
    }

    lines.push('');

    // Issues
    lines.push('Issues:');
    lines.push(`  Bugs: ${formatCount(result.bugs)}`);
    lines.push(`  Vulnerabilities: ${formatCount(result.vulnerabilities)}`);
    lines.push(`  Code Smells: ${formatCount(result.codeSmells)}`);
    lines.push(`  Security Hotspots: ${formatCount(result.securityHotspots)}`);
    lines.push('');

    // Metrics
    if (result.coverage || result.duplications) {
        lines.push('Metrics:');
        if (result.coverage) {
            lines.push(`  Coverage: ${result.coverage}%`);
        }
        if (result.duplications) {
            lines.push(`  Duplications: ${result.duplications}%`);
        }
        lines.push('');
    }

    // Dashboard link
    lines.push(`Dashboard: ${result.dashboardUrl}`);
    lines.push('='.repeat(60));

    return lines.join('\n');
}

/**
 * Format quality gate status with color indicators.
 *
 * @param status - Quality gate status
 * @returns Formatted status string
 */
function formatQualityGateStatus(status: QualityGateStatus): string {
    switch (status) {
        case 'OK':
            return '✓ PASSED';
        case 'WARN':
            return '⚠ WARNING';
        case 'ERROR':
            return '✗ FAILED';
        case 'NONE':
        default:
            return '- NOT AVAILABLE';
    }
}

/**
 * Format issue count with highlighting.
 *
 * @param count - Issue count
 * @returns Formatted count string
 */
function formatCount(count: number): string {
    if (count === 0) {
        return '0';
    } else if (count < 10) {
        return `${count} (low)`;
    } else if (count < 50) {
        return `${count} (moderate)`;
    } else {
        return `${count} (high)`;
    }
}

/**
 * Format issue for console display.
 *
 * @param issue - SonarQube issue
 * @returns Formatted issue string
 */
export function formatIssue(issue: SonarQubeIssue): string {
    const lines: string[] = [];

    lines.push(`[${issue.severity}] ${issue.type}: ${issue.message}`);
    lines.push(`  Rule: ${issue.rule}`);
    lines.push(`  File: ${issue.component}`);

    if (issue.line) {
        lines.push(`  Line: ${issue.line}`);
    }

    if (issue.effort) {
        lines.push(`  Effort: ${issue.effort}`);
    }

    return lines.join('\n');
}

// ============================================================================
// MARKDOWN GENERATION
// ============================================================================

/**
 * Generate a markdown report from scan result.
 *
 * @param result - Scan result
 * @returns Markdown-formatted report
 */
export function generateMarkdownReport(result: ScanResult): string {
    const lines: string[] = [];

    lines.push('# SonarQube Scan Report');
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Project:** ${result.projectKey}`);
    lines.push(`- **Status:** ${result.success ? '✅ Success' : '❌ Failed'}`);
    lines.push(`- **Quality Gate:** ${formatQualityGateStatus(result.qualityGate)}`);

    if (result.scanTime) {
        lines.push(`- **Scan Time:** ${(result.scanTime / 1000).toFixed(2)}s`);
    }

    lines.push('');
    lines.push(`[View Full Dashboard →](${result.dashboardUrl})`);
    lines.push('');

    // Issues
    lines.push('## Issues');
    lines.push('');
    lines.push('| Type | Count |');
    lines.push('|------|-------|');
    lines.push(`| Bugs | ${result.bugs} |`);
    lines.push(`| Vulnerabilities | ${result.vulnerabilities} |`);
    lines.push(`| Code Smells | ${result.codeSmells} |`);
    lines.push(`| Security Hotspots | ${result.securityHotspots} |`);
    lines.push('');

    // Metrics
    if (result.coverage || result.duplications) {
        lines.push('## Metrics');
        lines.push('');
        lines.push('| Metric | Value |');
        lines.push('|--------|-------|');

        if (result.coverage) {
            lines.push(`| Coverage | ${result.coverage}% |`);
        }

        if (result.duplications) {
            lines.push(`| Duplications | ${result.duplications}% |`);
        }

        lines.push('');
    }

    // Top issues
    if (result.issues && result.issues.length > 0) {
        const actionableIssues = extractActionableIssues(result);

        if (actionableIssues.length > 0) {
            lines.push('## Top Priority Issues');
            lines.push('');

            for (const issue of actionableIssues.slice(0, 10)) {
                lines.push(`### ${issue.severity}: ${issue.message}`);
                lines.push('');
                lines.push(`- **Type:** ${issue.type}`);
                lines.push(`- **Rule:** ${issue.rule}`);
                lines.push(`- **File:** ${issue.component}`);

                if (issue.line) {
                    lines.push(`- **Line:** ${issue.line}`);
                }

                if (issue.effort) {
                    lines.push(`- **Effort:** ${issue.effort}`);
                }

                lines.push('');
            }
        }
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Generated by Ralph Orchestrator SonarQube Scanner*');

    return lines.join('\n');
}

// ============================================================================
// ISSUE FILTERING
// ============================================================================

/**
 * Extract actionable issues (high severity) from scan result.
 *
 * Filters and sorts issues by severity to highlight the most important ones.
 *
 * @param result - Scan result
 * @returns Array of high-priority issues
 */
export function extractActionableIssues(result: ScanResult): SonarQubeIssue[] {
    if (!result.issues || result.issues.length === 0) {
        return [];
    }

    // Define severity order (lower is more severe)
    const severityOrder = {
        BLOCKER: 0,
        CRITICAL: 1,
        MAJOR: 2,
        MINOR: 3,
        INFO: 4,
    };

    // Filter for high-severity issues (BLOCKER, CRITICAL, MAJOR)
    const highSeverityIssues = result.issues.filter((issue) => {
        const severity = issue.severity;
        return severityOrder[severity] <= 2; // BLOCKER, CRITICAL, MAJOR
    });

    // Sort by severity
    return highSeverityIssues.sort((a, b) => {
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
}

/**
 * Group issues by type.
 *
 * @param issues - Array of issues
 * @returns Issues grouped by type
 */
export function groupIssuesByType(
    issues: SonarQubeIssue[]
): Record<string, SonarQubeIssue[]> {
    const grouped: Record<string, SonarQubeIssue[]> = {
        BUG: [],
        VULNERABILITY: [],
        CODE_SMELL: [],
        SECURITY_HOTSPOT: [],
    };

    for (const issue of issues) {
        if (grouped[issue.type]) {
            grouped[issue.type].push(issue);
        }
    }

    return grouped;
}

/**
 * Group issues by severity.
 *
 * @param issues - Array of issues
 * @returns Issues grouped by severity
 */
export function groupIssuesBySeverity(
    issues: SonarQubeIssue[]
): Record<string, SonarQubeIssue[]> {
    const grouped: Record<string, SonarQubeIssue[]> = {
        BLOCKER: [],
        CRITICAL: [],
        MAJOR: [],
        MINOR: [],
        INFO: [],
    };

    for (const issue of issues) {
        if (grouped[issue.severity]) {
            grouped[issue.severity].push(issue);
        }
    }

    return grouped;
}
