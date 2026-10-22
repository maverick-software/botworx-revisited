// src/lib/services/mcpService.ts
// Enhanced MCP Server management service with comprehensive DTMA integration

import { supabase } from '../supabase';
import { MCPServer, MCPServerTemplate, MCPDeploymentConfig, MCPDeploymentStatus } from '../mcp/ui-types';
import { ToolInstanceService } from '../../integrations/_shared/services/ToolInstanceService';
import type { SupabaseClient } from '@supabase/supabase-js';

// Enhanced type definitions for better DTMA integration
export interface MCPServerStatus {
  state: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'unknown';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime?: number;
  lastStarted?: Date;
  lastError?: string;
}

export interface ConnectionTest {
  success: boolean;
  error?: string;
  latency?: number;
  capabilities?: string[];
  timestamp: Date;
}

export interface EnhancedMCPServer extends MCPServer {
  environment: {
    id: string;
    name: string;
    publicIP: string;
    privateIP: string;
    region: string;
    size: string;
  };
  endpoint: string;
  lastHeartbeat: Date | null;
  serverType: string;
  transport: 'http' | 'stdio' | 'websocket';
  discoveryMetadata: Record<string, any>;
}

export class MCPService {
  protected supabase: SupabaseClient;
  protected toolInstanceService: ToolInstanceService;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || supabase;
    this.toolInstanceService = new ToolInstanceService(this.supabase);
  }

  /**
   * Get admin toolbox environment for MCP server deployment
   */
  protected async getAdminToolboxEnvironment() {
    // For now, get the first available admin environment
    // In production, this should be a dedicated admin environment
    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, public_ip_address, status')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('No active admin toolbox environment found for MCP server deployment');
    }

    return data;
  }

  /**
   * Enhanced server querying with comprehensive DTMA integration
   */
  async getServers(): Promise<EnhancedMCPServer[]> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Enhanced query with full DTMA integration
      const { data, error } = await this.supabase
        .from('account_tool_instances')
        .select(`
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          created_at,
          updated_at,
          mcp_server_type,
          mcp_transport_type,
          mcp_endpoint_path,
          mcp_server_capabilities,
          mcp_discovery_metadata,
          account_tool_environment:account_tool_environments!inner(
            id,
            name,
            public_ip_address,
            region_slug,
            size_slug,
            user_id
          )
        `)
        .eq('account_tool_environment.user_id', user.id)
        .not('mcp_server_type', 'is', null)
        .order('instance_name_on_toolbox');

      if (error) {
        console.error('Error fetching MCP servers:', error);
        throw new Error(`Failed to fetch MCP servers: ${error.message}`);
      }

      return (data || []).map(this.transformToEnhancedMCPServer.bind(this));
         } catch (error) {
       console.error('Error in getServers:', error);
       throw error instanceof Error ? error : new Error('Unknown error in getServers');
     }
  }

  /**
   * Transform database record to enhanced MCP server object
   */
  protected transformToEnhancedMCPServer(record: any): EnhancedMCPServer {
    const environment = record.account_tool_environment;
    const status = this.mapStatusToMCPStatus(record.status_on_toolbox, record.last_heartbeat_from_dtma);
    
    return {
      // Original MCPServer fields for backward compatibility
      id: record.id, // Keep UUID as string instead of parsing to integer
      config_id: 0,
      name: record.instance_name_on_toolbox || `MCP Server ${record.id}`,
      endpoint_url: this.buildServerEndpoint(environment.public_ip_address, record.mcp_endpoint_path),
      vault_api_key_id: null,
      timeout_ms: 30000,
      max_retries: 3,
      retry_backoff_ms: 1000,
      priority: 1,
      is_active: status.state === 'running',
      capabilities: record.mcp_server_capabilities || null,
      status: {
        state: status.state === 'running' ? 'running' : 'stopped',
        uptime: status.uptime || 0,
        lastStarted: status.lastStarted || new Date(record.created_at)
      },
      health: {
        overall: status.health === 'healthy' ? 'healthy' : 'unhealthy',
        checks: {
          connectivity: status.state === 'running',
          responseTime: 0,
          errorRate: 0,
          memoryUsage: 0,
          cpuUsage: 0
        },
        lastChecked: new Date()
      },

      // Enhanced fields for DTMA integration
      serverType: record.mcp_server_type || 'generic',
      transport: record.mcp_transport_type || 'http',
      discoveryMetadata: record.mcp_discovery_metadata || {},
      environment: {
        id: environment.id,
        name: environment.name,
        publicIP: environment.public_ip_address,
        privateIP: '',
        region: environment.region_slug,
        size: environment.size_slug
      },
      endpoint: this.buildServerEndpoint(environment.public_ip_address, record.mcp_endpoint_path),
      lastHeartbeat: record.last_heartbeat_from_dtma ? new Date(record.last_heartbeat_from_dtma) : null
    };
  }

  /**
   * Build server endpoint from DTMA infrastructure (replaces localhost)
   */
  protected buildServerEndpoint(publicIP: string, endpointPath: string = ''): string {
    if (!publicIP) {
      // Return placeholder for servers without IP addresses (provisioning/stopped)
      return 'http://pending-provisioning:30000';
    }
    
    // Use port 30000 for DTMA deployed containers (not localhost:8000)
    const baseUrl = `http://${publicIP}:30000`;
    return endpointPath ? `${baseUrl}${endpointPath}` : baseUrl;
  }

  /**
   * Map DTMA status to MCP status with health determination
   */
  protected mapStatusToMCPStatus(dtmaStatus: string, lastHeartbeat: string | null): MCPServerStatus {
    const now = new Date();
    const heartbeatAge = lastHeartbeat ? 
      (now.getTime() - new Date(lastHeartbeat).getTime()) / (1000 * 60) : null;

    let state: MCPServerStatus['state'];
    let health: MCPServerStatus['health'] = 'unknown';

    // Map DTMA status to MCP state
    switch (dtmaStatus) {
      case 'running':
        state = 'running';
        health = heartbeatAge && heartbeatAge < 5 ? 'healthy' : 
                heartbeatAge && heartbeatAge < 15 ? 'degraded' : 'unhealthy';
        break;
      case 'stopped':
      case 'exited':
        state = 'stopped';
        health = 'unknown';
        break;
      case 'starting_on_toolbox':
        state = 'starting';
        health = 'unknown';
        break;
      case 'stopping_on_toolbox':
        state = 'stopping';
        health = 'unknown';
        break;
      case 'error_starting':
      case 'error_stopping':
        state = 'error';
        health = 'unhealthy';
        break;
      default:
        state = 'unknown';
        health = 'unknown';
    }

    return {
      state,
      health,
      uptime: state === 'running' && lastHeartbeat ? 
        Math.floor((now.getTime() - new Date(lastHeartbeat).getTime()) / 1000) : undefined,
      lastStarted: lastHeartbeat ? new Date(lastHeartbeat) : undefined,
      lastError: state === 'error' ? 'Container error - check DTMA logs' : undefined
    };
  }

  /**
   * Get single server by ID with enhanced error handling
   */
  async getServerById(serverId: string): Promise<EnhancedMCPServer | null> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await this.supabase
        .from('account_tool_instances')
        .select(`
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          created_at,
          updated_at,
          mcp_server_type,
          mcp_transport_type,
          mcp_endpoint_path,
          mcp_server_capabilities,
          mcp_discovery_metadata,
          account_tool_environment:account_tool_environments!inner(
            id,
            name,
            public_ip_address,
            region_slug,
            size_slug,
            user_id
          )
        `)
        .eq('id', serverId)
        .eq('account_tool_environment.user_id', user.id)
        .not('mcp_server_type', 'is', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to fetch MCP server: ${error.message}`);
      }

      return this.transformToEnhancedMCPServer(data);
         } catch (error) {
       console.error(`Error fetching server ${serverId}:`, error);
       throw error instanceof Error ? error : new Error(`Unknown error fetching server ${serverId}`);
     }
  }

  /**
   * Backward compatibility: Get server using original interface
   */
  async getServer(id: string): Promise<MCPServer> {
    const enhancedServer = await this.getServerById(id);
    if (!enhancedServer) {
      throw new Error(`MCP server with ID ${id} not found`);
    }
    
    // Return only the original MCPServer fields
    const { environment, endpoint, lastHeartbeat, serverType, transport, discoveryMetadata, ...originalServer } = enhancedServer;
    return originalServer;
  }

  /**
   * Test server connectivity with comprehensive error handling
   */
  async testServerConnection(serverId: string): Promise<ConnectionTest> {
    const server = await this.getServerById(serverId);
    if (!server) {
      return {
        success: false,
        error: 'Server not found',
        timestamp: new Date()
      };
    }

    const status = this.mapStatusToMCPStatus(server.status.state, server.lastHeartbeat?.toISOString() || null);
    if (status.state !== 'running') {
      return {
        success: false,
        error: `Server is not running (status: ${status.state})`,
        timestamp: new Date()
      };
    }

    try {
      const startTime = Date.now();
      
      // Test basic connectivity to DTMA endpoint (not localhost)
      const response = await fetch(`${server.endpoint}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          latency,
          timestamp: new Date()
        };
      }

      // Test MCP protocol if health check passes
      const capabilities = await this.testMCPCapabilities(server.endpoint);

      return {
        success: true,
        latency,
        capabilities,
        timestamp: new Date()
      };

         } catch (error) {
       return {
         success: false,
         error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
         timestamp: new Date()
       };
     }
  }

  /**
   * Test MCP protocol capabilities
   */
  protected async testMCPCapabilities(endpoint: string): Promise<string[]> {
    try {
      const response = await fetch(`${endpoint}/mcp/capabilities`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        return data.capabilities || [];
      }
         } catch (error) {
       console.warn('Could not fetch MCP capabilities:', error instanceof Error ? error.message : 'Unknown error');
     }
    
    return []; // Return empty array if capabilities cannot be determined
  }

  /**
   * Refresh server status from DTMA
   */
  async refreshServerStatus(serverId: string): Promise<EnhancedMCPServer> {
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    try {
      // Refresh status via ToolInstanceService
      await this.toolInstanceService.refreshInstanceStatusFromDtma({
        userId: 'system',
        accountToolInstanceId: serverId,
        accountToolEnvironmentId: server.environment.id
      });

      // Return updated server data
      const updatedServer = await this.getServerById(serverId);
      if (!updatedServer) {
        throw new Error('Server not found after refresh');
      }

      return updatedServer;
         } catch (error) {
       console.error(`Failed to refresh server status for ${serverId}:`, error);
       throw new Error(`Status refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
     }
  }

  /**
   * Create/Deploy a new MCP server
   * Now integrates with DTMA infrastructure for actual deployment
   */
  async deployServer(config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get admin toolbox environment for MCP server deployment
      const adminToolbox = await this.getAdminToolboxEnvironment();

             // Deploy via ToolInstanceService (routes to DTMA)
       const deployment = await this.toolInstanceService.deployToolToToolbox({
         userId: user.id, // Current user (admin in this case)
         accountToolEnvironmentId: adminToolbox.id,
         toolCatalogId: '00000000-0000-0000-0000-000000000001', // Generic MCP Server
         instanceNameOnToolbox: config.name,
         baseConfigOverrideJson: {
           dockerImage: 'default-mcp-server:latest', // Will be configurable later
           mcpTransport: 'stdio', // Default transport
           mcpCapabilities: ['tools'], // Default capabilities
           mcpEndpoint: '/mcp', // Default endpoint
           mcpPort: 8080, // Default port
           templateId: config.templateId,
           environment: config.environment,
           resourceLimits: config.resourceLimits,
           configuration: config.configuration
         }
       });

      // Update MCP-specific fields
      await this.supabase
        .from('account_tool_instances')
        .update({
          mcp_server_type: 'mcp_server',
          mcp_endpoint_path: config.configuration?.endpoint || '/mcp',
          mcp_transport_type: config.configuration?.transport || 'stdio',
          mcp_server_capabilities: config.configuration?.capabilities || [],
          mcp_discovery_metadata: {
            deployedAt: new Date().toISOString(),
            deploymentConfig: config,
            templateId: config.templateId,
            dtmaDeployment: true
          }
        })
        .eq('id', deployment.id);

      return {
        id: deployment.id.toString(),
        status: 'deploying',
        progress: 0,
        message: 'MCP server deployment initiated via DTMA',
        startedAt: new Date(),
        logs: [],
                 endpoints: [{
           type: 'http' as const,
           url: `http://${adminToolbox.public_ip_address}:8080/mcp`,
           status: 'active' as const
         }]
      };
    } catch (error) {
      console.error('Error deploying MCP server:', error);
      throw error;
    }
  }

  /**
   * Update an MCP server
   */
  async updateServer(id: string, updates: Partial<MCPServer>): Promise<MCPServer> {
    try {
      const { data, error } = await this.supabase
        .from('account_tool_instances')
        .update({
          instance_name_on_toolbox: updates.name,
          status_on_toolbox: updates.status?.state === 'running' ? 'active' : 'pending_install',
          mcp_endpoint_path: updates.endpoint_url,
          mcp_server_capabilities: updates.capabilities,
          updated_at: new Date().toISOString()
        })
        .eq('id', parseInt(id))
        .select()
        .single();

      if (error) throw error;

      return await this.getServer(id);
    } catch (error) {
      console.error(`Error updating MCP server ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an MCP server
   */
  async deleteServer(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('account_tool_instances')
        .delete()
        .eq('id', parseInt(id));

      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting MCP server ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get available MCP server templates from registry
   */
  async getMarketplaceTemplates(): Promise<MCPServerTemplate[]> {
    try {
      const { data, error } = await this.supabase
        .from('mcp_server_catalog')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform database records to MCPServerTemplate format
      return (data || []).map(record => ({
        id: record.id,
        name: record.display_name || record.name,
        description: record.description || '',
        version: record.version,
        author: record.provider || 'Unknown',
        category: record.category || 'other',
        tags: Array.isArray(record.tags) ? record.tags : [],
        dockerImage: record.docker_image,
        documentation: record.documentation_url || '',
        sourceCode: record.repository_url || '',
        rating: {
          average: parseFloat(record.rating_average) || 0,
          count: record.rating_count || 0
        },
        downloads: record.download_count || 0,
        verified: record.is_verified || false,
        configSchema: record.configuration_schema || {
          type: 'object',
          properties: {},
          required: []
        },
        requiredCapabilities: Array.isArray(record.capabilities) ? record.capabilities : ['tools'],
        supportedTransports: ['stdio'], // Default, could be enhanced
        resourceRequirements: {
          memory: '256Mi',
          cpu: '0.25'
        },
        environment: {},
        lastUpdated: new Date(record.updated_at),
        isActive: true
      }));
    } catch (error) {
      console.error('Error fetching marketplace templates:', error);
      // Fallback to hardcoded templates if database fails
      return this.getFallbackTemplates();
    }
  }

  /**
   * Create a new MCP server template
   */
  async createTemplate(templateData: Partial<MCPServerTemplate>): Promise<MCPServerTemplate> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Map author to valid provider values
      let provider = 'community'; // default
      if (templateData.author) {
        const authorLower = templateData.author.toLowerCase();
        if (authorLower.includes('official') || authorLower.includes('agentopia')) {
          provider = 'official';
        } else if (authorLower.includes('custom') || authorLower.includes('private')) {
          provider = 'custom';
        }
        // Everything else remains 'community'
      }

      const { data, error } = await this.supabase
        .from('mcp_server_catalog')
        .insert({
          name: templateData.name,
          display_name: templateData.name,
          description: templateData.description,
          version: templateData.version || '1.0.0',
          docker_image: templateData.dockerImage,
          category: templateData.category,
          provider: provider,
          capabilities: templateData.requiredCapabilities || ['tools'],
          configuration_schema: templateData.configSchema || {
            type: 'object',
            properties: {},
            required: []
          },
          documentation_url: templateData.documentation,
          repository_url: templateData.sourceCode,
          tags: templateData.tags || [],
          is_verified: false,
          is_published: true,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Transform back to MCPServerTemplate format
      return {
        id: data.id,
        name: data.display_name || data.name,
        description: data.description || '',
        version: data.version,
        author: data.provider || 'Unknown',
        category: data.category || 'other',
        tags: Array.isArray(data.tags) ? data.tags : [],
        dockerImage: data.docker_image,
        documentation: data.documentation_url || '',
        sourceCode: data.repository_url || '',
        rating: {
          average: 0,
          count: 0
        },
        downloads: 0,
        verified: data.is_verified || false,
        configSchema: data.configuration_schema || {
          type: 'object',
          properties: {},
          required: []
        },
        requiredCapabilities: Array.isArray(data.capabilities) ? data.capabilities : ['tools'],
        supportedTransports: ['stdio'],
        resourceRequirements: {
          memory: '256Mi',
          cpu: '0.25'
        },
        environment: {},
        lastUpdated: new Date(data.created_at),
        isActive: true
      };
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update template verification status (admin only)
   */
  async updateTemplateVerification(templateId: string, isVerified: boolean): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('mcp_server_catalog')
        .update({ is_verified: isVerified })
        .eq('id', templateId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating template verification:', error);
      throw error;
    }
  }

  /**
   * Delete a template (admin only)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('mcp_server_catalog')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Fallback templates when database is unavailable
   */
  private getFallbackTemplates(): MCPServerTemplate[] {
    return [
      {
        id: 'aws-tools',
        name: 'AWS Tools',
        description: 'MCP server providing AWS cloud service tools',
        version: '1.0.0',
        author: 'AWS',
        category: 'integrations',
        tags: ['aws', 'cloud', 'infrastructure'],
        dockerImage: 'mcp-servers/aws-tools:latest',
        documentation: 'https://docs.mcp-servers.com/aws-tools',
        sourceCode: 'https://github.com/mcp-servers/aws-tools',
        rating: {
          average: 4.8,
          count: 127
        },
        downloads: 1250,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              title: 'AWS Region',
              description: 'AWS region to operate in',
              default: 'us-east-1'
            }
          },
          required: ['region']
        },
        requiredCapabilities: ['list_resources', 'call_tool'],
        supportedTransports: ['stdio', 'sse'],
        resourceRequirements: {
          memory: '512Mi',
          cpu: '0.5',
          storage: '1Gi'
        },
        environment: {
          AWS_REGION: 'us-east-1'
        },
        previewImages: ['https://docs.mcp-servers.com/aws-tools/preview1.png'],
        lastUpdated: new Date('2024-01-15'),
        isActive: true
      },
      {
        id: 'github-tools',
        name: 'GitHub Tools',
        description: 'MCP server for GitHub API interactions',
        version: '1.2.0',
        author: 'GitHub',
        category: 'development',
        tags: ['github', 'git', 'development'],
        dockerImage: 'mcp-servers/github-tools:latest',
        documentation: 'https://docs.mcp-servers.com/github-tools',
        sourceCode: 'https://github.com/mcp-servers/github-tools',
        rating: {
          average: 4.6,
          count: 89
        },
        downloads: 890,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              title: 'GitHub Token',
              description: 'GitHub personal access token'
            }
          },
          required: ['token']
        },
        requiredCapabilities: ['list_resources', 'call_tool'],
        supportedTransports: ['stdio', 'websocket'],
        resourceRequirements: {
          memory: '256Mi',
          cpu: '0.25'
        },
        environment: {},
        lastUpdated: new Date('2024-01-10'),
        isActive: true
      },
      {
        id: 'slack-tools',
        name: 'Slack Tools',
        description: 'MCP server for Slack workspace management',
        version: '1.1.0',
        author: 'Slack',
        category: 'productivity',
        tags: ['slack', 'communication', 'team'],
        dockerImage: 'mcp-servers/slack-tools:latest',
        documentation: 'https://docs.mcp-servers.com/slack-tools',
        rating: {
          average: 4.2,
          count: 65
        },
        downloads: 650,
        verified: true,
        configSchema: {
          type: 'object',
          properties: {
            webhook_url: {
              type: 'string',
              title: 'Webhook URL',
              description: 'Slack webhook URL for sending messages'
            }
          },
          required: ['webhook_url']
        },
        requiredCapabilities: ['call_tool'],
        supportedTransports: ['sse', 'websocket'],
        resourceRequirements: {
          memory: '128Mi',
          cpu: '0.1'
        },
        environment: {},
        lastUpdated: new Date('2024-01-05'),
        isActive: true
      }
    ];
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<MCPDeploymentStatus> {
    try {
      const server = await this.getServer(deploymentId);
      
      return {
        id: deploymentId,
        status: server.status.state === 'running' ? 'running' : 'failed',
        progress: server.status.state === 'running' ? 100 : 0,
        message: server.status.state === 'running' ? 'Deployment completed successfully' : 'Deployment failed',
        startedAt: server.status.lastStarted || new Date(),
        completedAt: server.status.state === 'running' ? new Date() : undefined,
        logs: [],
        endpoints: [{
          type: 'http',
          url: server.endpoint_url,
          status: server.status.state === 'running' ? 'active' : 'inactive'
        }]
      };
    } catch (error) {
      console.error(`Error getting deployment status for ${deploymentId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService(); 