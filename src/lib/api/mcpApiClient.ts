// src/lib/api/mcpApiClient.ts
// Production-ready MCP API client for DTMA integration

import config from '../config/environment';
import { MCPServer, MCPServerTemplate, MCPDeploymentConfig, MCPDeploymentStatus, MCPCredentialConfig } from '../mcp/ui-types';

/**
 * API Response wrapper
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Request options for API calls
 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

/**
 * API Error class for handling MCP API errors
 */
export class MCPApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPApiError';
  }
}

/**
 * MCP API Client class
 */
class MCPApiClient {
  private baseUrl: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;

  constructor() {
    this.baseUrl = config.mcp.apiBaseUrl;
    this.timeout = 30000; // 30 seconds default timeout
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Get authentication headers
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    // In a real implementation, this would get the auth token from your auth context
    // For now, return empty object - this should be updated when auth is ready
    return {};
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.timeout,
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const authHeaders = await this.getAuthHeaders();

    const requestHeaders = {
      ...this.defaultHeaders,
      ...authHeaders,
      ...headers,
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new MCPApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData.code,
          errorData
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof MCPApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new MCPApiError('Request timeout', 408, 'TIMEOUT');
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new MCPApiError(
        `Network error: ${errorMessage}`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Get all MCP servers for the current user
   */
  async getServers(): Promise<MCPServer[]> {
    try {
      const response = await this.request<ApiResponse<MCPServer[]>>('/servers');
      
      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to fetch servers');
      }

      return response.data || [];
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Using mock data for servers due to API error:', error);
        return this.getMockServers();
      }
      throw error as MCPApiError;
    }
  }

  /**
   * Get a specific MCP server by ID
   */
  async getServer(id: string): Promise<MCPServer> {
    try {
      const response = await this.request<ApiResponse<MCPServer>>(`/servers/${id}`);
      
      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to fetch server');
      }

      if (!response.data) {
        throw new MCPApiError('Server not found', 404, 'NOT_FOUND');
      }

      return response.data;
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Using mock data for server due to API error:', error);
        return this.getMockServers().find(s => s.id.toString() === id) || this.getMockServers()[0];
      }
      throw error;
    }
  }

  /**
   * Update an MCP server
   */
  async updateServer(id: string, updates: Partial<MCPServer>): Promise<MCPServer> {
    try {
      const response = await this.request<ApiResponse<MCPServer>>(`/servers/${id}`, {
        method: 'PUT',
        body: updates,
      });

      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to update server');
      }

      return response.data!;
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Mock update for server:', id, updates);
        const servers = this.getMockServers();
        const server = servers.find(s => s.id.toString() === id);
        return server ? { ...server, ...updates } : servers[0];
      }
      throw error;
    }
  }

  /**
   * Delete an MCP server
   */
  async deleteServer(id: string): Promise<void> {
    try {
      const response = await this.request<ApiResponse>(`/servers/${id}`, {
        method: 'DELETE',
      });

      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to delete server');
      }
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Mock delete for server:', id);
        return;
      }
      throw error;
    }
  }

  /**
   * Get marketplace templates
   */
  async getMarketplaceTemplates(): Promise<MCPServerTemplate[]> {
    try {
      const response = await this.request<ApiResponse<MCPServerTemplate[]>>('/marketplace/templates');
      
      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to fetch marketplace templates');
      }

      return response.data || [];
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Using mock data for marketplace due to API error:', error);
        return this.getMockTemplates();
      }
      throw error;
    }
  }

  /**
   * Deploy a new MCP server
   */
  async deployServer(deploymentConfig: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
    try {
      const response = await this.request<ApiResponse<MCPDeploymentStatus>>('/deploy', {
        method: 'POST',
        body: deploymentConfig,
      });

      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to deploy server');
      }

      return response.data!;
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Mock deployment for config:', deploymentConfig);
        return this.getMockDeploymentStatus();
      }
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<MCPDeploymentStatus> {
    try {
      const response = await this.request<ApiResponse<MCPDeploymentStatus>>(`/deploy/${deploymentId}/status`);
      
      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to fetch deployment status');
      }

      return response.data!;
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Mock deployment status for:', deploymentId);
        return this.getMockDeploymentStatus();
      }
      throw error;
    }
  }

  /**
   * Get available credentials
   */
  async getCredentials(): Promise<MCPCredentialConfig[]> {
    try {
      const response = await this.request<ApiResponse<MCPCredentialConfig[]>>('/credentials');
      
      if (!response.success) {
        throw new MCPApiError(response.error || 'Failed to fetch credentials');
      }

      return response.data || [];
    } catch (error) {
      if (config.dev.mockApiEnabled) {
        console.warn('Using mock data for credentials due to API error:', error);
        return this.getMockCredentials();
      }
      throw error;
    }
  }

  /**
   * Mock data methods (fallback for development)
   */
  private getMockServers(): MCPServer[] {
    return [
      {
        id: 1,
        config_id: 1,
        name: 'Weather API Server',
        endpoint_url: 'http://localhost:3001/weather',
        vault_api_key_id: null,
        timeout_ms: 30000,
        max_retries: 3,
        retry_backoff_ms: 1000,
        priority: 1,
        is_active: true,
        capabilities: {
          resources: true,
          tools: true,
          prompts: false,
          sampling: false,
        },
        status: {
          state: 'running',
          uptime: 86400,
          lastStarted: new Date(Date.now() - 86400 * 1000),
          lastError: undefined,
        },
        health: {
          overall: 'healthy',
          checks: {
            connectivity: true,
            responseTime: 150,
            errorRate: 0.01,
            memoryUsage: 50,
            cpuUsage: 20,
          },
          lastChecked: new Date(),
        },
        resourceUsage: {
          memory: { used: 128, limit: 256, percentage: 50 },
          cpu: { percentage: 20, cores: 1 },
          network: { bytesIn: 1024000, bytesOut: 512000 },
        },
        tags: ['weather', 'api', 'production'],
        lastSeen: new Date(),
      },
    ];
  }

  private getMockTemplates(): MCPServerTemplate[] {
    return [
      {
        id: 'weather-api',
        name: 'Weather API Server',
        description: 'Provides weather information using OpenWeatherMap API',
        version: '1.2.0',
        author: 'MCP Community',
        category: 'productivity',
        tags: ['weather', 'api', 'productivity'],
        dockerImage: 'mcpservers/weather-api:1.2.0',
        documentation: 'https://docs.mcpservers.com/weather-api',
        sourceCode: 'https://github.com/mcpservers/weather-api',
        rating: { average: 4.5, count: 42 },
        downloads: 1250,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your OpenWeatherMap API key' },
            defaultLocation: { type: 'string', title: 'Default Location', description: 'Default city' }
          },
          required: ['apiKey']
        },
        requiredCapabilities: ['tools'],
        supportedTransports: ['stdio', 'sse'],
        resourceRequirements: { memory: '128Mi', cpu: '0.1' },
        environment: { NODE_ENV: 'production' },
        lastUpdated: new Date('2024-12-15'),
        isActive: true
      },
    ];
  }

  private getMockCredentials(): MCPCredentialConfig[] {
    return [
      {
        providerId: 'github',
        connectionId: 'github-main',
        scopes: ['repo', 'user'],
        required: false,
      },
      {
        providerId: 'openweather',
        connectionId: 'weather-api',
        scopes: ['current', 'forecast'],
        required: false,
      },
    ];
  }

  private getMockDeploymentStatus(): MCPDeploymentStatus {
    return {
      id: 'deploy-123',
      status: 'running',
      progress: 100,
      message: 'Deployment completed successfully',
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(),
      endpoints: [
        { type: 'http', url: 'http://localhost:3001', status: 'active' },
        { type: 'websocket', url: 'ws://localhost:3001/ws', status: 'active' },
      ],
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'Deployment completed successfully',
          source: 'deployment-manager',
        },
      ],
    };
  }
}

/**
 * Export singleton instance
 */
export const mcpApiClient = new MCPApiClient();

/**
 * Export the class for testing
 */
export default MCPApiClient; 