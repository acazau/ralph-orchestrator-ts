#!/usr/bin/env bun
/**
 * SonarQube Setup CLI - Initial Configuration
 *
 * Usage:
 *   bun run ./.adws/adw_sonar_setup.ts
 *
 * This script:
 * - Starts SonarQube Docker container
 * - Waits for SonarQube to become healthy
 * - Guides user through token generation
 * - Creates configuration file
 * - Validates setup
 *
 * Examples:
 *   bun run ./.adws/adw_sonar_setup.ts
 */

import { mkdir } from 'fs/promises';
import { join } from 'path';
import { promptClaudeSdk } from './adw_modules/agent';
import { generateShortId } from './adw_modules/utils';

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log('Starting SonarQube Setup...\n');

    // Generate ADW ID
    const adwId = generateShortId();
    console.log(`ADW ID: ${adwId}\n`);

    // Prepare output directory
    const outputDir = join(process.cwd(), '.adws', 'agents', adwId, 'sonar-setup');
    await mkdir(outputDir, { recursive: true });

    // Build prompt for setup agent
    const prompt = `Initialize SonarQube for Ralph Orchestrator.

Please follow the /sonar-setup command template to:
1. Check prerequisites (Docker, port availability, system requirements)
2. Start SonarQube Docker container
3. Wait for container to become healthy
4. Guide user through token generation
5. Create configuration directory and file
6. Validate configuration
7. Display setup summary

Use the ADW modules in .adws/adw_modules/ for all Docker and API operations.

Working directory: ${process.cwd()}`;

    try {
        // Execute setup via Claude Agent SDK
        const response = await promptClaudeSdk({
            prompt,
            adwId,
            agentName: 'sonar-setup',
            outputFile: join(outputDir, 'cc_raw_output.jsonl'),
            workingDir: process.cwd(),
            agents: {
                'docker-manager': {
                    description: 'Manages Docker container lifecycle for SonarQube setup',
                    tools: ['Bash(docker:*)'],
                    model: 'haiku',
                },
                'config-manager': {
                    description: 'Creates and validates SonarQube configuration',
                    tools: ['Bash', 'Read', 'Write'],
                    model: 'sonnet',
                },
                'setup-validator': {
                    description: 'Validates setup completion and connectivity',
                    tools: ['Bash', 'Read'],
                    model: 'haiku',
                },
            },
            maxTurns: 30,
        });

        // Display results
        console.log('\n=== Setup Execution Complete ===\n');

        if (response.success) {
            console.log('✓ Setup completed successfully\n');
            console.log('Agent Output:');
            console.log(response.output);
            console.log('\n--- Setup Complete ---\n');
            console.log('You can now run scans with:');
            console.log('  bun run ./.adws/adw_sonar_scan.ts changed');
            console.log('  bun run ./.adws/adw_sonar_scan.ts full');
        } else {
            console.log('✗ Setup failed\n');
            console.log('Agent Output:');
            console.log(response.output);
            console.log('\nPlease review the errors above and try again.');
            process.exit(1);
        }

        console.log(`\nADW ID: ${adwId}`);
        console.log(`Output Directory: ${outputDir}`);
    } catch (error) {
        console.error('\n=== Setup Error ===\n');
        console.error(error instanceof Error ? error.message : String(error));
        console.error('\nSetup failed. Please check the error message above.');
        process.exit(1);
    }
}

// Run main function
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
