/**
 * SonarQube Operations Module - API Client
 *
 * This module handles SonarQube REST API interactions including:
 * - Token generation
 * - Project status fetching
 * - Issue retrieval
 * - Quality gate checking
 *
 * Key Functions:
 * - generateToken - Generate authentication token
 * - fetchProjectStatus - Get project status
 * - fetchIssues - Get project issues
 * - getQualityGate - Get quality gate status
 */

import type {
    ProjectStatus,
    QualityGate,
    SonarQubeIssue,
    SecurityHotspot,
    IssueSeverity,
    IssueType,
    QualityGateStatus,
    HotspotProbability,
    HotspotStatus,
} from './data_types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_API_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

// ============================================================================
// API CLIENT
// ============================================================================

/**
 * SonarQube API client configuration.
 */
export interface SonarQubeClientConfig {
    url: string;
    token?: string;
    timeout?: number;
    maxRetries?: number;
}

/**
 * SonarQube API client.
 */
export class SonarQubeClient {
    private url: string;
    private token?: string;
    private timeout: number;
    private maxRetries: number;

    constructor(config: SonarQubeClientConfig) {
        this.url = config.url.replace(/\/$/, ''); // Remove trailing slash
        this.token = config.token;
        this.timeout = config.timeout || DEFAULT_API_TIMEOUT_MS;
        this.maxRetries = config.maxRetries || DEFAULT_MAX_RETRIES;
    }

    /**
     * Make an API request with retry logic.
     *
     * @param endpoint - API endpoint path
     * @param options - Fetch options
     * @returns Response data
     */
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.url}${endpoint}`;
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    ...options,
                    headers,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data as T;
            } catch (error) {
                lastError = error as Error;

                if (attempt < this.maxRetries) {
                    const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt);
                    console.warn(`Request failed, retrying in ${delay}ms... (${error})`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    throw lastError;
                }
            }
        }

        throw lastError || new Error('Request failed');
    }

    /**
     * Fetch project status.
     *
     * @param projectKey - Project key
     * @returns Project status
     */
    async fetchProjectStatus(projectKey: string): Promise<ProjectStatus> {
        const endpoint = `/api/qualitygates/project_status?projectKey=${encodeURIComponent(projectKey)}`;
        const response = await this.request<{ projectStatus: ProjectStatus }>(endpoint);
        return response.projectStatus;
    }

    /**
     * Fetch quality gate status.
     *
     * @param projectKey - Project key
     * @returns Quality gate
     */
    async fetchQualityGate(projectKey: string): Promise<QualityGate> {
        const status = await this.fetchProjectStatus(projectKey);

        return {
            status: status.status as QualityGateStatus,
            conditions: status.conditions?.map((c) => ({
                status: c.status as QualityGateStatus,
                metricKey: c.metricKey,
                comparator: c.comparator,
                errorThreshold: c.errorThreshold,
                actualValue: c.actualValue,
            })) || [],
        };
    }

    /**
     * Fetch project issues with filtering options.
     *
     * @param projectKey - Project key
     * @param options - Fetch options (severities, types, statuses, rules, files, page size)
     * @returns Array of issues
     */
    async fetchIssues(
        projectKey: string,
        options: {
            severities?: IssueSeverity[];
            types?: IssueType[];
            statuses?: string[];
            rules?: string[];
            files?: string[];
            pageSize?: number;
            page?: number;
        } = {}
    ): Promise<SonarQubeIssue[]> {
        const params = new URLSearchParams({
            componentKeys: projectKey,
            ps: String(options.pageSize || 500),
        });

        if (options.page) {
            params.append('p', String(options.page));
        }

        if (options.severities && options.severities.length > 0) {
            params.append('severities', options.severities.join(','));
        }

        if (options.types && options.types.length > 0) {
            params.append('types', options.types.join(','));
        }

        if (options.statuses && options.statuses.length > 0) {
            params.append('statuses', options.statuses.join(','));
        }

        if (options.rules && options.rules.length > 0) {
            params.append('rules', options.rules.join(','));
        }

        if (options.files && options.files.length > 0) {
            // SonarQube uses componentKeys for file filtering
            const fileKeys = options.files.map(f => `${projectKey}:${f}`);
            params.append('componentKeys', fileKeys.join(','));
        }

        const endpoint = `/api/issues/search?${params.toString()}`;
        const response = await this.request<{
            issues: Array<{
                key: string;
                rule: string;
                severity: IssueSeverity;
                component: string;
                project: string;
                line?: number;
                message: string;
                type: IssueType;
                status: string;
                effort?: string;
            }>;
        }>(endpoint);

        return response.issues.map((issue) => ({
            key: issue.key,
            rule: issue.rule,
            severity: issue.severity,
            component: issue.component,
            project: issue.project,
            line: issue.line,
            message: issue.message,
            type: issue.type,
            status: issue.status,
            effort: issue.effort,
        }));
    }

    /**
     * Fetch security hotspots for a project.
     *
     * @param projectKey - Project key
     * @param options - Fetch options (status, resolution)
     * @returns Array of security hotspots
     */
    async fetchHotspots(
        projectKey: string,
        options: {
            status?: HotspotStatus[];
            resolution?: string[];
            pageSize?: number;
        } = {}
    ): Promise<SecurityHotspot[]> {
        const params = new URLSearchParams({
            projectKey: projectKey,
            ps: String(options.pageSize || 100),
        });

        if (options.status && options.status.length > 0) {
            params.append('status', options.status.join(','));
        }

        if (options.resolution && options.resolution.length > 0) {
            params.append('resolution', options.resolution.join(','));
        }

        const endpoint = `/api/hotspots/search?${params.toString()}`;
        const response = await this.request<{
            hotspots: Array<{
                key: string;
                component: string;
                project: string;
                securityCategory: string;
                vulnerabilityProbability: HotspotProbability;
                status: HotspotStatus;
                line?: number;
                message: string;
                ruleKey: string;
            }>;
        }>(endpoint);

        return response.hotspots.map((hotspot) => ({
            key: hotspot.key,
            component: hotspot.component,
            project: hotspot.project,
            securityCategory: hotspot.securityCategory,
            vulnerabilityProbability: hotspot.vulnerabilityProbability,
            status: hotspot.status,
            line: hotspot.line,
            message: hotspot.message,
            rule: hotspot.ruleKey,
            ruleKey: hotspot.ruleKey,
        }));
    }

    /**
     * Fetch project measures (metrics).
     *
     * @param projectKey - Project key
     * @param metricKeys - Metric keys to fetch
     * @returns Measures object
     */
    async fetchMeasures(
        projectKey: string,
        metricKeys: string[]
    ): Promise<Record<string, string | undefined>> {
        const params = new URLSearchParams({
            component: projectKey,
            metricKeys: metricKeys.join(','),
        });

        const endpoint = `/api/measures/component?${params.toString()}`;
        const response = await this.request<{
            component: {
                measures: Array<{
                    metric: string;
                    value?: string;
                }>;
            };
        }>(endpoint);

        const measures: Record<string, string | undefined> = {};
        for (const measure of response.component.measures) {
            measures[measure.metric] = measure.value;
        }

        return measures;
    }

    /**
     * Fetch duplications for a specific file.
     *
     * @param fileKey - Full file key (projectKey:path)
     * @returns Duplication data
     */
    async fetchDuplications(fileKey: string): Promise<{
        duplications: Array<{
            blocks: Array<{
                from: number;
                size: number;
                _ref: string;
            }>;
        }>;
        files: Record<string, { key: string; name: string; projectName: string }>;
    }> {
        const endpoint = `/api/duplications/show?key=${encodeURIComponent(fileKey)}`;
        return this.request(endpoint);
    }

    /**
     * Fetch files with duplications in a project.
     *
     * @param projectKey - Project key
     * @returns Array of files with duplication metrics
     */
    async fetchFilesWithDuplications(projectKey: string): Promise<Array<{
        key: string;
        name: string;
        path: string;
        duplicatedLines: number;
        duplicatedBlocks: number;
    }>> {
        const params = new URLSearchParams({
            component: projectKey,
            metricKeys: 'duplicated_lines,duplicated_blocks',
            ps: '100',
            s: 'metric,name',
            metricSort: 'duplicated_lines',
            metricSortFilter: 'withMeasuresOnly',
            asc: 'false',
        });

        const endpoint = `/api/measures/component_tree?${params.toString()}`;
        const response = await this.request<{
            components: Array<{
                key: string;
                name: string;
                path: string;
                qualifier: string;
                measures?: Array<{
                    metric: string;
                    value: string;
                }>;
            }>;
        }>(endpoint);

        // Filter to only files (not directories)
        return response.components
            .filter(c => c.qualifier === 'FIL')
            .map(c => {
                const dupLines = c.measures?.find(m => m.metric === 'duplicated_lines');
                const dupBlocks = c.measures?.find(m => m.metric === 'duplicated_blocks');
                return {
                    key: c.key,
                    name: c.name,
                    path: c.path,
                    duplicatedLines: dupLines ? parseInt(dupLines.value, 10) : 0,
                    duplicatedBlocks: dupBlocks ? parseInt(dupBlocks.value, 10) : 0,
                };
            })
            .filter(f => f.duplicatedLines > 0);
    }

    /**
     * Generate a user token.
     *
     * @param name - Token name
     * @param username - Username (for basic auth)
     * @param password - Password (for basic auth)
     * @returns Generated token
     */
    async generateToken(name: string, username: string, password: string): Promise<string> {
        const endpoint = `/api/user_tokens/generate?name=${encodeURIComponent(name)}`;

        // Use basic auth for token generation
        const authString = btoa(`${username}:${password}`);

        const response = await fetch(`${this.url}${endpoint}`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${authString}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to generate token: ${response.statusText}`);
        }

        const data = await response.json();
        return data.token;
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Generate a SonarQube user token.
 *
 * @param url - SonarQube server URL
 * @param username - Username
 * @param password - Password
 * @param tokenName - Token name (default: 'ralph-orchestrator')
 * @returns Generated token
 */
export async function generateToken(
    url: string,
    username: string,
    password: string,
    tokenName: string = 'ralph-orchestrator'
): Promise<string> {
    const client = new SonarQubeClient({ url });
    return client.generateToken(tokenName, username, password);
}

/**
 * Fetch project status.
 *
 * @param url - SonarQube server URL
 * @param token - Authentication token
 * @param projectKey - Project key
 * @returns Project status
 */
export async function fetchProjectStatus(
    url: string,
    token: string,
    projectKey: string
): Promise<ProjectStatus> {
    const client = new SonarQubeClient({ url, token });
    return client.fetchProjectStatus(projectKey);
}

/**
 * Fetch project issues.
 *
 * @param url - SonarQube server URL
 * @param token - Authentication token
 * @param projectKey - Project key
 * @returns Array of issues
 */
export async function fetchIssues(
    url: string,
    token: string,
    projectKey: string
): Promise<SonarQubeIssue[]> {
    const client = new SonarQubeClient({ url, token });
    return client.fetchIssues(projectKey);
}

/**
 * Get quality gate status.
 *
 * @param url - SonarQube server URL
 * @param token - Authentication token
 * @param projectKey - Project key
 * @returns Quality gate
 */
export async function getQualityGate(
    url: string,
    token: string,
    projectKey: string
): Promise<QualityGate> {
    const client = new SonarQubeClient({ url, token });
    return client.fetchQualityGate(projectKey);
}
