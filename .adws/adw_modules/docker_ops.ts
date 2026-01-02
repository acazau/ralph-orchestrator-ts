/**
 * Docker Operations Module - SonarQube Container Management
 *
 * This module handles Docker container lifecycle management for SonarQube.
 * It provides functions to start, stop, check health, and manage the SonarQube container.
 *
 * Key Functions:
 * - startSonarQubeContainer - Start the SonarQube container
 * - stopSonarQubeContainer - Stop the container
 * - checkContainerHealth - Check if container is healthy
 * - ensureContainerRunning - Ensure container is running
 * - getContainerLogs - Get container logs
 */

import { spawn } from 'bun';
import type { DockerResult, HealthStatus } from './data_types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SONARQUBE_CONTAINER_NAME = 'ralph-sonarqube';
const SONARQUBE_IMAGE = 'sonarqube:10.8.0-community';
const SONARQUBE_PORT = 9000;
const HEALTH_CHECK_URL = 'http://localhost:9000/api/system/status';
const MAX_HEALTH_CHECK_ATTEMPTS = 60; // 60 attempts * 5s = 5 minutes
const HEALTH_CHECK_INTERVAL_MS = 5000; // 5 seconds

// ============================================================================
// DOCKER UTILITIES
// ============================================================================

/**
 * Execute a Docker command and return the result.
 *
 * @param args - Docker command arguments
 * @returns Object with stdout, stderr, and exitCode
 */
async function executeDockerCommand(args: string[]): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
}> {
    try {
        const proc = spawn({
            cmd: ['docker', ...args],
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

/**
 * Check if Docker is installed and running.
 *
 * @returns true if Docker is available
 */
async function isDockerAvailable(): Promise<boolean> {
    const result = await executeDockerCommand(['--version']);
    return result.exitCode === 0;
}

/**
 * Check if a container exists.
 *
 * @param containerName - Name of the container
 * @returns true if container exists
 */
async function containerExists(containerName: string): Promise<boolean> {
    const result = await executeDockerCommand([
        'ps',
        '-a',
        '--filter',
        `name=^${containerName}$`,
        '--format',
        '{{.Names}}',
    ]);

    return result.stdout.trim() === containerName;
}

/**
 * Check if a container is running.
 *
 * @param containerName - Name of the container
 * @returns true if container is running
 */
async function isContainerRunning(containerName: string): Promise<boolean> {
    const result = await executeDockerCommand([
        'ps',
        '--filter',
        `name=^${containerName}$`,
        '--format',
        '{{.Names}}',
    ]);

    return result.stdout.trim() === containerName;
}

// ============================================================================
// CONTAINER LIFECYCLE
// ============================================================================

/**
 * Start the SonarQube Docker container.
 *
 * Creates and starts a SonarQube container if it doesn't exist,
 * or starts an existing stopped container.
 *
 * @returns Docker operation result
 */
export async function startSonarQubeContainer(): Promise<DockerResult> {
    // Check if Docker is available
    if (!(await isDockerAvailable())) {
        return {
            success: false,
            error: 'Docker is not installed or not running. Please install Docker and try again.',
        };
    }

    // Check if container already exists
    const exists = await containerExists(SONARQUBE_CONTAINER_NAME);

    if (exists) {
        // Check if it's already running
        const running = await isContainerRunning(SONARQUBE_CONTAINER_NAME);
        if (running) {
            return {
                success: true,
                containerId: SONARQUBE_CONTAINER_NAME,
                message: 'SonarQube container is already running',
            };
        }

        // Start existing container
        const startResult = await executeDockerCommand(['start', SONARQUBE_CONTAINER_NAME]);
        if (startResult.exitCode !== 0) {
            return {
                success: false,
                error: `Failed to start container: ${startResult.stderr}`,
            };
        }

        return {
            success: true,
            containerId: SONARQUBE_CONTAINER_NAME,
            message: 'Started existing SonarQube container',
        };
    }

    // Create and start new container
    const createResult = await executeDockerCommand([
        'run',
        '-d',
        '--name',
        SONARQUBE_CONTAINER_NAME,
        '-p',
        `${SONARQUBE_PORT}:9000`,
        '--stop-timeout',
        '3600',
        '-v',
        'sonarqube_data:/opt/sonarqube/data',
        '-v',
        'sonarqube_logs:/opt/sonarqube/logs',
        '-v',
        'sonarqube_extensions:/opt/sonarqube/extensions',
        SONARQUBE_IMAGE,
    ]);

    if (createResult.exitCode !== 0) {
        // Check for common errors
        if (createResult.stderr.includes('port is already allocated')) {
            return {
                success: false,
                error: `Port ${SONARQUBE_PORT} is already in use. Please stop the conflicting service.`,
            };
        }

        return {
            success: false,
            error: `Failed to create container: ${createResult.stderr}`,
        };
    }

    const containerId = createResult.stdout.trim();

    return {
        success: true,
        containerId,
        message: 'Created and started new SonarQube container',
    };
}

/**
 * Stop the SonarQube Docker container.
 *
 * @returns Docker operation result
 */
export async function stopSonarQubeContainer(): Promise<DockerResult> {
    // Check if Docker is available
    if (!(await isDockerAvailable())) {
        return {
            success: false,
            error: 'Docker is not installed or not running',
        };
    }

    // Check if container exists
    const exists = await containerExists(SONARQUBE_CONTAINER_NAME);
    if (!exists) {
        return {
            success: true,
            message: 'SonarQube container does not exist',
        };
    }

    // Check if container is running
    const running = await isContainerRunning(SONARQUBE_CONTAINER_NAME);
    if (!running) {
        return {
            success: true,
            message: 'SonarQube container is already stopped',
        };
    }

    // Stop the container
    const stopResult = await executeDockerCommand(['stop', SONARQUBE_CONTAINER_NAME]);
    if (stopResult.exitCode !== 0) {
        return {
            success: false,
            error: `Failed to stop container: ${stopResult.stderr}`,
        };
    }

    return {
        success: true,
        containerId: SONARQUBE_CONTAINER_NAME,
        message: 'Stopped SonarQube container',
    };
}

// ============================================================================
// HEALTH CHECKS
// ============================================================================

/**
 * Check the health status of the SonarQube container.
 *
 * Polls the SonarQube health endpoint to determine if the service is ready.
 *
 * @returns Health status
 */
export async function checkContainerHealth(): Promise<HealthStatus> {
    // Check if container is running
    const running = await isContainerRunning(SONARQUBE_CONTAINER_NAME);
    if (!running) {
        return {
            healthy: false,
            status: 'not_running',
            message: 'SonarQube container is not running',
        };
    }

    // Check HTTP endpoint
    try {
        const response = await fetch(HEALTH_CHECK_URL);
        const data = await response.json();

        if (response.ok && data.status === 'UP') {
            return {
                healthy: true,
                status: 'UP',
                message: 'SonarQube is healthy and ready',
            };
        } else {
            return {
                healthy: false,
                status: data.status || 'UNKNOWN',
                message: `SonarQube status: ${data.status || 'UNKNOWN'}`,
            };
        }
    } catch (error) {
        return {
            healthy: false,
            status: 'unreachable',
            message: `Cannot reach SonarQube health endpoint: ${(error as Error).message}`,
        };
    }
}

/**
 * Wait for the SonarQube container to become healthy.
 *
 * Polls the health endpoint until it returns healthy or timeout is reached.
 *
 * @param timeoutSeconds - Maximum time to wait (default: 300 seconds)
 * @returns Health status
 */
export async function waitForHealthy(timeoutSeconds: number = 300): Promise<HealthStatus> {
    const maxAttempts = Math.floor((timeoutSeconds * 1000) / HEALTH_CHECK_INTERVAL_MS);
    console.log(`Waiting for SonarQube to become healthy (max ${timeoutSeconds}s)...`);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const health = await checkContainerHealth();

        if (health.healthy) {
            console.log('SonarQube is healthy!');
            return health;
        }

        if (attempt % 6 === 0) {
            // Log every 30 seconds (6 * 5s)
            console.log(`Still waiting... (attempt ${attempt + 1}/${maxAttempts})`);
        }

        await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
    }

    return {
        healthy: false,
        status: 'timeout',
        message: `Health check timed out after ${timeoutSeconds} seconds`,
    };
}

/**
 * Ensure the SonarQube container is running and healthy.
 *
 * Starts the container if it's not running and waits for it to become healthy.
 *
 * @returns Health status
 * @throws Error if container cannot be started or does not become healthy
 */
export async function ensureContainerRunning(): Promise<HealthStatus> {
    // Check current health
    const currentHealth = await checkContainerHealth();
    if (currentHealth.healthy) {
        return currentHealth;
    }

    // Try to start container if not running
    if (currentHealth.status === 'not_running') {
        console.log('Starting SonarQube container...');
        const startResult = await startSonarQubeContainer();

        if (!startResult.success) {
            throw new Error(`Failed to start container: ${startResult.error}`);
        }

        console.log(startResult.message);
    }

    // Wait for healthy
    const healthStatus = await waitForHealthy();
    if (!healthStatus.healthy) {
        throw new Error(`SonarQube did not become healthy: ${healthStatus.message}`);
    }

    return healthStatus;
}

// ============================================================================
// LOGS
// ============================================================================

/**
 * Get logs from the SonarQube container.
 *
 * @param tail - Number of lines to retrieve (default: 100)
 * @returns Container logs
 */
export async function getContainerLogs(tail: number = 100): Promise<string> {
    const result = await executeDockerCommand([
        'logs',
        '--tail',
        String(tail),
        SONARQUBE_CONTAINER_NAME,
    ]);

    if (result.exitCode !== 0) {
        return `Error getting logs: ${result.stderr}`;
    }

    return result.stdout || result.stderr;
}
