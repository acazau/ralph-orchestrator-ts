#!/usr/bin/env bun
/**
 * SonarQube Results Query Tool
 *
 * Live query tool for fetching SonarQube scan results with filtering options.
 * Does NOT cache results to files - always fetches fresh data from the API.
 *
 * Usage:
 *   bun run ./.adws/adw_sonar_results.ts [options]
 *
 * Options:
 *   --status=OPEN,CONFIRMED     Filter by status (OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED)
 *   --severity=CRITICAL,MAJOR   Filter by severity (BLOCKER, CRITICAL, MAJOR, MINOR, INFO)
 *   --type=BUG,VULNERABILITY    Filter by type (BUG, VULNERABILITY, CODE_SMELL)
 *   --rule=typescript:S1234     Filter by rule key
 *   --file=src/foo.ts           Filter by file path
 *   --hotspots                  Query security hotspots instead of issues
 *   --hotspot-status=TO_REVIEW  Filter hotspots by status (TO_REVIEW, ACKNOWLEDGED, FIXED, SAFE)
 *   --duplications              Query code duplications (files with duplicated code blocks)
 *   --limit=10                  Limit number of results (default: 100)
 *   --format=json               Output format: table (default), json, summary
 *   --help                      Show this help message
 *
 * Examples:
 *   # Show all open issues
 *   bun run ./.adws/adw_sonar_results.ts --status=OPEN
 *
 *   # Show critical and major bugs
 *   bun run ./.adws/adw_sonar_results.ts --severity=CRITICAL,MAJOR --type=BUG
 *
 *   # Query security hotspots
 *   bun run ./.adws/adw_sonar_results.ts --hotspots
 *
 *   # Query hotspots needing review
 *   bun run ./.adws/adw_sonar_results.ts --hotspots --hotspot-status=TO_REVIEW
 *
 *   # Get JSON output for scripting
 *   bun run ./.adws/adw_sonar_results.ts --status=OPEN --format=json
 *
 *   # Show summary only
 *   bun run ./.adws/adw_sonar_results.ts --format=summary
 *
 *   # Query code duplications
 *   bun run ./.adws/adw_sonar_results.ts --duplications
 *
 *   # Get duplications as JSON
 *   bun run ./.adws/adw_sonar_results.ts --duplications --format=json
 */

import { SonarQubeClient } from './adw_modules/sonarqube_ops';
import {
    formatSummary,
    parseMeasures,
    extractActionableIssues
} from './adw_modules/result_parser';
import type { ScanResult, IssueSeverity, IssueType, HotspotStatus } from './adw_modules/data_types';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface QueryOptions {
    statuses?: string[];
    severities?: IssueSeverity[];
    types?: IssueType[];
    rules?: string[];
    files?: string[];
    hotspots: boolean;
    hotspotStatuses?: HotspotStatus[];
    duplications: boolean;
    limit: number;
    format: 'table' | 'json' | 'summary';
    help: boolean;
}

function parseArgs(args: string[]): QueryOptions {
    const options: QueryOptions = {
        limit: 100,
        format: 'table',
        help: false,
        hotspots: false,
        duplications: false,
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--hotspots') {
            options.hotspots = true;
        } else if (arg === '--duplications') {
            options.duplications = true;
        } else if (arg.startsWith('--hotspot-status=')) {
            options.hotspotStatuses = arg.replace('--hotspot-status=', '').split(',').map(s => s.trim().toUpperCase()) as HotspotStatus[];
        } else if (arg.startsWith('--status=')) {
            options.statuses = arg.replace('--status=', '').split(',').map(s => s.trim().toUpperCase());
        } else if (arg.startsWith('--severity=')) {
            options.severities = arg.replace('--severity=', '').split(',').map(s => s.trim().toUpperCase()) as IssueSeverity[];
        } else if (arg.startsWith('--type=')) {
            options.types = arg.replace('--type=', '').split(',').map(s => s.trim().toUpperCase()) as IssueType[];
        } else if (arg.startsWith('--rule=')) {
            options.rules = arg.replace('--rule=', '').split(',').map(s => s.trim());
        } else if (arg.startsWith('--file=')) {
            options.files = arg.replace('--file=', '').split(',').map(s => s.trim());
        } else if (arg.startsWith('--limit=')) {
            options.limit = Number.parseInt(arg.replace('--limit=', ''), 10) || 100;
        } else if (arg.startsWith('--format=')) {
            const format = arg.replace('--format=', '').toLowerCase();
            if (format === 'json' || format === 'table' || format === 'summary') {
                options.format = format;
            }
        }
    }

    return options;
}

function showHelp(): void {
    console.log(`
SonarQube Results Query Tool

Usage:
  bun run ./.adws/adw_sonar_results.ts [options]

Options:
  --status=OPEN,CONFIRMED     Filter issues by status (OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED)
  --severity=CRITICAL,MAJOR   Filter by severity (BLOCKER, CRITICAL, MAJOR, MINOR, INFO)
  --type=BUG,VULNERABILITY    Filter by type (BUG, VULNERABILITY, CODE_SMELL)
  --rule=typescript:S1234     Filter by rule key
  --file=src/foo.ts           Filter by file path
  --hotspots                  Query security hotspots instead of issues
  --hotspot-status=TO_REVIEW  Filter hotspots by status (TO_REVIEW, ACKNOWLEDGED, FIXED, SAFE)
  --duplications              Query code duplications (files with duplicated code blocks)
  --limit=10                  Limit number of results (default: 100)
  --format=json               Output format: table (default), json, summary
  --help                      Show this help message

Examples:
  # Show all open issues
  bun run ./.adws/adw_sonar_results.ts --status=OPEN

  # Show critical and major bugs
  bun run ./.adws/adw_sonar_results.ts --severity=CRITICAL,MAJOR --type=BUG

  # Query all security hotspots
  bun run ./.adws/adw_sonar_results.ts --hotspots

  # Query hotspots needing review
  bun run ./.adws/adw_sonar_results.ts --hotspots --hotspot-status=TO_REVIEW

  # Get hotspots as JSON
  bun run ./.adws/adw_sonar_results.ts --hotspots --format=json

  # Query code duplications
  bun run ./.adws/adw_sonar_results.ts --duplications

  # Get duplications as JSON
  bun run ./.adws/adw_sonar_results.ts --duplications --format=json

  # Show only summary metrics
  bun run ./.adws/adw_sonar_results.ts --format=summary
`);
}

// ============================================================================
// MAIN
// ============================================================================

// Configuration
const SONAR_URL = process.env.SONAR_URL || 'http://localhost:9000';
const SONAR_TOKEN = process.env.SONAR_TOKEN || 'squ_b4ca2596433cf7e139c3cea5a3da6280ad4a12b5';
const PROJECT_KEY = process.env.SONAR_PROJECT_KEY || 'ralph-orchestrator-ts';

// Parse arguments
const options = parseArgs(process.argv.slice(2));

if (options.help) {
    showHelp();
    process.exit(0);
}

// Initialize client
const client = new SonarQubeClient({
    url: SONAR_URL,
    token: SONAR_TOKEN,
});

try {
    // Fetch measures for summary
    const measures = await client.fetchMeasures(PROJECT_KEY, [
        'bugs',
        'vulnerabilities',
        'code_smells',
        'security_hotspots',
        'coverage',
        'duplicated_lines_density',
        'ncloc',
    ]);

    // Fetch quality gate
    const qualityGate = await client.fetchQualityGate(PROJECT_KEY);

    // Handle hotspots query
    if (options.hotspots) {
        const hotspots = await client.fetchHotspots(PROJECT_KEY, {
            status: options.hotspotStatuses,
            pageSize: options.limit,
        });

        if (options.format === 'json') {
            const output = {
                projectKey: PROJECT_KEY,
                qualityGate: qualityGate.status,
                metrics: {
                    securityHotspots: measures.security_hotspots,
                },
                filters: {
                    hotspotStatuses: options.hotspotStatuses,
                },
                totalHotspots: hotspots.length,
                hotspots: hotspots.map(h => ({
                    key: h.key,
                    status: h.status,
                    vulnerabilityProbability: h.vulnerabilityProbability,
                    securityCategory: h.securityCategory,
                    rule: h.rule,
                    message: h.message,
                    file: h.component.replace(`${PROJECT_KEY}:`, ''),
                    line: h.line,
                })),
            };
            console.log(JSON.stringify(output, null, 2));
        } else {
            console.log('\n🔒 Security Hotspots Query\n');

            // Show active filters
            if (options.hotspotStatuses) {
                console.log(`Filters: hotspot-status=${options.hotspotStatuses.join(',')}`);
                console.log('');
            }

            console.log(`Total Security Hotspots: ${measures.security_hotspots || 0}`);
            console.log(`Dashboard: ${SONAR_URL}/security_hotspots?id=${PROJECT_KEY}`);

            if (hotspots.length > 0) {
                console.log(`\n🔍 Hotspots (${hotspots.length} results):`);
                console.log('='.repeat(80));

                for (const hotspot of hotspots) {
                    const file = hotspot.component.replace(`${PROJECT_KEY}:`, '');
                    const location = hotspot.line ? `${file}:${hotspot.line}` : file;
                    const statusIcon = hotspot.status === 'TO_REVIEW' ? '🔴' :
                                       hotspot.status === 'FIXED' ? '✅' :
                                       hotspot.status === 'SAFE' ? '✅' : '🟡';
                    const probIcon = hotspot.vulnerabilityProbability === 'HIGH' ? '🔴' :
                                     hotspot.vulnerabilityProbability === 'MEDIUM' ? '🟠' : '🟡';

                    console.log(`\n${statusIcon} [${hotspot.status}] ${probIcon} ${hotspot.vulnerabilityProbability} probability`);
                    console.log(`   📁 ${location}`);
                    console.log(`   📝 ${hotspot.message}`);
                    console.log(`   🏷️  Category: ${hotspot.securityCategory}`);
                    console.log(`   📋 Rule: ${hotspot.rule}`);
                }
            } else {
                console.log('\n✅ No security hotspots found matching the specified filters.');
            }
        }
    } else if (options.duplications) {
        // Handle duplications query
        const filesWithDups = await client.fetchFilesWithDuplications(PROJECT_KEY);

        if (options.format === 'json') {
            // Fetch detailed duplication info for each file
            const duplicationsDetails = [];
            for (const file of filesWithDups.slice(0, options.limit)) {
                try {
                    const dupData = await client.fetchDuplications(file.key);
                    duplicationsDetails.push({
                        file: file.path,
                        duplicatedLines: file.duplicatedLines,
                        duplicatedBlocks: file.duplicatedBlocks,
                        blocks: dupData.duplications.map(d => ({
                            blocks: d.blocks.map(b => {
                                const fileInfo = dupData.files[b._ref];
                                return {
                                    from: b.from,
                                    size: b.size,
                                    file: fileInfo ? fileInfo.name : b._ref,
                                };
                            }),
                        })),
                    });
                } catch {
                    duplicationsDetails.push({
                        file: file.path,
                        duplicatedLines: file.duplicatedLines,
                        duplicatedBlocks: file.duplicatedBlocks,
                        blocks: [],
                    });
                }
            }

            const output = {
                projectKey: PROJECT_KEY,
                qualityGate: qualityGate.status,
                metrics: {
                    duplicatedLinesDensity: measures.duplicated_lines_density,
                    linesOfCode: measures.ncloc,
                },
                totalFilesWithDuplications: filesWithDups.length,
                duplications: duplicationsDetails,
            };
            console.log(JSON.stringify(output, null, 2));
        } else {
            console.log('\n📋 Code Duplications Query\n');
            console.log(`Duplicated Lines Density: ${measures.duplicated_lines_density || 0}%`);
            console.log(`Dashboard: ${SONAR_URL}/component_measures?id=${PROJECT_KEY}&metric=duplicated_lines_density`);

            if (filesWithDups.length > 0) {
                console.log(`\n📁 Files with duplications (${filesWithDups.length} files):`);
                console.log('='.repeat(80));

                for (const file of filesWithDups.slice(0, options.limit)) {
                    console.log(`\n📄 ${file.path}`);
                    console.log(`   Duplicated lines: ${file.duplicatedLines}`);
                    console.log(`   Duplicated blocks: ${file.duplicatedBlocks}`);

                    // Fetch and show block details
                    try {
                        const dupData = await client.fetchDuplications(file.key);
                        if (dupData.duplications && dupData.duplications.length > 0) {
                            for (const dup of dupData.duplications) {
                                console.log('\n   🔄 Duplicated block:');
                                for (const block of dup.blocks) {
                                    const fileInfo = dupData.files[block._ref];
                                    const fileName = fileInfo ? fileInfo.name : block._ref;
                                    console.log(`      - ${fileName} lines ${block.from}-${block.from + block.size - 1} (${block.size} lines)`);
                                }
                            }
                        }
                    } catch {
                        console.log('   (Could not fetch block details)');
                    }
                }
            } else {
                console.log('\n✅ No code duplications found in this project.');
            }
        }
    } else {
        // Standard issues query
        const issues = await client.fetchIssues(PROJECT_KEY, {
            statuses: options.statuses,
            severities: options.severities,
            types: options.types,
            rules: options.rules,
            files: options.files,
            pageSize: options.limit,
        });

        // Build scan result
        let result: ScanResult = {
            success: true,
            projectKey: PROJECT_KEY,
            bugs: 0,
            vulnerabilities: 0,
            codeSmells: 0,
            securityHotspots: 0,
            qualityGate: qualityGate.status,
            dashboardUrl: `${SONAR_URL}/dashboard?id=${PROJECT_KEY}`,
            issues,
        };

        // Parse measures
        result = parseMeasures(result, measures);

        // Output based on format
        if (options.format === 'json') {
            // JSON output for scripting
            const output = {
                projectKey: PROJECT_KEY,
                qualityGate: result.qualityGate,
                metrics: {
                    bugs: result.bugs,
                    vulnerabilities: result.vulnerabilities,
                    codeSmells: result.codeSmells,
                    securityHotspots: result.securityHotspots,
                    coverage: result.coverage,
                    duplications: result.duplications,
                    linesOfCode: measures.ncloc,
                },
                filters: {
                    statuses: options.statuses,
                    severities: options.severities,
                    types: options.types,
                    rules: options.rules,
                    files: options.files,
                },
                totalIssues: issues.length,
                issues: issues.map(issue => ({
                    key: issue.key,
                    severity: issue.severity,
                    type: issue.type,
                    status: issue.status,
                    rule: issue.rule,
                    message: issue.message,
                    file: issue.component.replace(`${PROJECT_KEY}:`, ''),
                    line: issue.line,
                })),
            };
            console.log(JSON.stringify(output, null, 2));
        } else if (options.format === 'summary') {
            // Summary only
            console.log(formatSummary(result));
            console.log('\n📊 Code Statistics:');
            console.log(`  Lines of Code: ${measures.ncloc || 'N/A'}`);
            console.log(`  Duplications: ${result.duplications || 'N/A'}%`);
            console.log(`  Coverage: ${result.coverage || 'N/A'}%`);
        } else {
            // Table format (default)
            console.log('\n🔍 SonarQube Results Query\n');

            // Show active filters
            const activeFilters: string[] = [];
            if (options.statuses) activeFilters.push(`status=${options.statuses.join(',')}`);
            if (options.severities) activeFilters.push(`severity=${options.severities.join(',')}`);
            if (options.types) activeFilters.push(`type=${options.types.join(',')}`);
            if (options.rules) activeFilters.push(`rule=${options.rules.join(',')}`);
            if (options.files) activeFilters.push(`file=${options.files.join(',')}`);

            if (activeFilters.length > 0) {
                console.log(`Filters: ${activeFilters.join(', ')}`);
                console.log('');
            }

            // Show summary
            console.log(formatSummary(result));

            // Show issues
            if (issues.length > 0) {
                console.log(`\n📋 Issues (${issues.length} results):`);
                console.log('='.repeat(80));

                for (const issue of issues) {
                    const file = issue.component.replace(`${PROJECT_KEY}:`, '');
                    const location = issue.line ? `${file}:${issue.line}` : file;
                    const statusIcon = issue.status === 'OPEN' ? '🔴' : issue.status === 'CLOSED' ? '✅' : '🟡';

                    console.log(`\n${statusIcon} [${issue.severity}] ${issue.status}`);
                    console.log(`   ${location}`);
                    console.log(`   ${issue.message}`);
                    console.log(`   Rule: ${issue.rule}`);
                }
            } else {
                console.log('\n✅ No issues found matching the specified filters.');
            }
        }
    }

} catch (error) {
    console.error('❌ Failed to fetch results:', error);
    process.exit(1);
}
