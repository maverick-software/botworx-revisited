import { MCPService, EnhancedMCPServer, ConnectionTest } from './mcpService';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

// User-focused interfaces for agent-MCP connections
export interface AgentMCPConnection {
  id: string;
  agentId: string;
  mcpServerInstanceId: string;
  connectionConfig: ConnectionConfig;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  usageStats?: ConnectionUsageStats;
  agent?: {
    id: string;
    name: string;
  };
  mcpServer?: {
    id: string;
    name: string;
    capabilities: string[];
    status: string;
  };
}

export interface ConnectionConfig {
  timeout?: number;
  retryAttempts?: number;
  customHeaders?: Record<string, string>;
  enableLogging?: boolean;
  maxConcurrentRequests?: number;
}

export interface ConnectionUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  bytesTransferred: number;
}

export interface ConnectionStatus {
  connectionId: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  serverStatus: string;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  uptime?: number;
  error?: string;
}

export interface UserMCPDashboard {
  connectedAgents: number;
  availableServers: number;
  activeConnections: number;
  totalRequests: number;
  connections: AgentMCPConnection[];
  availableServers: EnhancedMCPServer[];
  lastUpdated: Date;
}

export interface AgentToolbelt {
  agentId: string;
  agentName: string;
  mcpConnections: AgentMCPConnection[];
  availableCapabilities: string[];
  connectionHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  lastUpdated: Date;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

/**
 * UserMCPService - User-focused service for managing agent-MCP connections
 * 
 * This service provides functionality for users to:
 * - Discover available MCP servers deployed by admins
 * - Connect their agents to MCP servers
 * - Monitor connection health and status
 * - Manage agent toolbelts and capabilities
 * 
 * Key features:
 * - Agent ownership validation
 * - Connection testing and health monitoring
 * - User dashboard with analytics
 * - Comprehensive error handling
 */
export class UserMCPService extends MCPService {
  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
  }

  // ============================================================================
  // USER AUTHENTICATION AND AGENT VALIDATION
  // ============================================================================

  /**
   * Validate user access and authentication
   */
  async validateUserAccess(agentId: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    await this.validateAgentOwnership(agentId);
  }

  /**
   * Validate that the user owns the specified agent
   */
  async validateAgentOwnership(agentId: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: agent, error } = await this.supabase
      .from('agents')
      .select('user_id')
      .eq('id', agentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Agent not found');
      }
      throw new Error(`Failed to validate agent ownership: ${error.message}`);
    }

    if (agent.user_id !== user.id) {
      throw new Error('Agent access denied - not owned by user');
    }
  }

  /**
   * Get all agents owned by the current user
   */
  async getUserAgents(): Promise<Agent[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await this.supabase
      .from('agents')
      .select('id, name, description, created_at')
      .eq('user_id', user.id)
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch user agents: ${error.message}`);
    }

    return data || [];
  }

  // ============================================================================
  // MCP SERVER DISCOVERY
  // ============================================================================

  /**
   * Get available MCP servers deployed by admin (user view)
   */
  async getAvailableMCPServers(): Promise<EnhancedMCPServer[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Get only running MCP servers deployed by admin
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
        .not('mcp_server_type', 'is', null)
        .eq('status_on_toolbox', 'running')
        .order('instance_name_on_toolbox');

      if (error) {
        throw new Error(`Failed to fetch available MCP servers: ${error.message}`);
      }

      return (data || []).map(this.transformToEnhancedMCPServer.bind(this));
    } catch (error) {
      console.error('Error in getAvailableMCPServers:', error);
      throw error instanceof Error ? error : new Error('Unknown error in getAvailableMCPServers');
    }
  }

  /**
   * Get detailed information about a specific MCP server
   */
  async getMCPServerDetails(serverId: string): Promise<EnhancedMCPServer> {
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
      .not('mcp_server_type', 'is', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('MCP server not found');
      }
      throw new Error(`Failed to fetch MCP server details: ${error.message}`);
    }

    return this.transformToEnhancedMCPServer(data);
  }

  /**
   * Get capabilities of a specific MCP server
   */
  async getMCPServerCapabilities(serverId: string): Promise<string[]> {
    const server = await this.getMCPServerDetails(serverId);
    
    // Try to get live capabilities if server is running
    if (server.status.state === 'running') {
      try {
        const capabilities = await this.testMCPCapabilities(server.endpoint);
        return capabilities.length > 0 ? capabilities : server.capabilities;
      } catch (error) {
        console.warn('Could not fetch live capabilities, using stored ones:', error);
      }
    }

    return server.capabilities;
  }

  // ============================================================================
  // AGENT CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Connect an agent to an MCP server
   */
  async connectAgentToMCPServer(
    agentId: string, 
    mcpServerId: string, 
    config?: ConnectionConfig
  ): Promise<AgentMCPConnection> {
    await this.validateUserAccess(agentId);
    
    // Get MCP server details
    const mcpServer = await this.getMCPServerDetails(mcpServerId);
    if (!mcpServer || mcpServer.status.state !== 'running') {
      throw new Error('MCP server not available for connections');
    }
    
    // Build connection configuration
    const connectionConfig = this.buildConnectionConfig(mcpServer, config);
    
    // Test connection before creating record
    const testResult = await this.testMCPConnection(agentId, mcpServerId);
    if (!testResult.success) {
      throw new Error(`Connection test failed: ${testResult.error}`);
    }
    
    // Create connection record
    const { data, error } = await this.supabase
      .from('agent_mcp_connections')
      .insert({
        agent_id: agentId,
        mcp_server_instance_id: mcpServerId,
        connection_config: connectionConfig,
        is_active: true,
        connection_test_result: testResult
      })
      .select(`
        *,
        agent:agents(id, name),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          mcp_server_capabilities,
          account_tool_environment:account_tool_environments(
            public_ip_address,
            name
          )
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Agent is already connected to this MCP server');
      }
      throw new Error(`Failed to create connection: ${error.message}`);
    }

    // Log connection event
    await this.logConnectionEvent(data.id, 'connected', 'User initiated connection');

    return this.transformToAgentMCPConnection(data);
  }

  /**
   * Disconnect an agent from an MCP server
   */
  async disconnectAgentFromMCPServer(agentId: string, mcpServerId: string): Promise<void> {
    await this.validateUserAccess(agentId);

    // Find the connection
    const { data: connection, error: findError } = await this.supabase
      .from('agent_mcp_connections')
      .select('id, agent:agents(name), mcp_server:account_tool_instances(instance_name_on_toolbox)')
      .eq('agent_id', agentId)
      .eq('mcp_server_instance_id', mcpServerId)
      .eq('is_active', true)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        throw new Error('Connection not found');
      }
      throw new Error(`Failed to find connection: ${findError.message}`);
    }

    // Deactivate the connection
    const { error: updateError } = await this.supabase
      .from('agent_mcp_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    if (updateError) {
      throw new Error(`Failed to disconnect: ${updateError.message}`);
    }

    // Log disconnection event
    await this.logConnectionEvent(
      connection.id, 
      'disconnected', 
      'User initiated disconnection'
    );
  }

  /**
   * Get all MCP connections for an agent
   */
  async getAgentMCPConnections(agentId: string): Promise<AgentMCPConnection[]> {
    await this.validateUserAccess(agentId);

    const { data, error } = await this.supabase
      .from('agent_mcp_connections')
      .select(`
        *,
        agent:agents(id, name),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          mcp_server_capabilities,
          account_tool_environment:account_tool_environments(
            public_ip_address,
            name
          )
        )
      `)
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch agent connections: ${error.message}`);
    }

    return (data || []).map(this.transformToAgentMCPConnection.bind(this));
  }

  /**
   * Update an agent MCP connection
   */
  async updateAgentMCPConnection(
    connectionId: string, 
    updates: Partial<AgentMCPConnection>
  ): Promise<AgentMCPConnection> {
    // Validate user access to the connection
    const { data: connection, error: findError } = await this.supabase
      .from('agent_mcp_connections')
      .select('agent_id')
      .eq('id', connectionId)
      .single();

    if (findError) {
      throw new Error('Connection not found');
    }

    await this.validateUserAccess(connection.agent_id);

    // Update the connection
    const { data, error } = await this.supabase
      .from('agent_mcp_connections')
      .update({
        connection_config: updates.connectionConfig,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select(`
        *,
        agent:agents(id, name),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          mcp_server_capabilities
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to update connection: ${error.message}`);
    }

    return this.transformToAgentMCPConnection(data);
  }

  // ============================================================================
  // CONNECTION STATUS AND HEALTH MONITORING
  // ============================================================================

  /**
   * Get connection status with health information
   */
  async getConnectionStatus(connectionId: string): Promise<ConnectionStatus> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get connection details
    const { data: connection, error } = await this.supabase
      .from('agent_mcp_connections')
      .select(`
        *,
        agent:agents!inner(id, name, user_id),
        mcp_server:account_tool_instances(
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          account_tool_environment:account_tool_environments(
            public_ip_address
          )
        )
      `)
      .eq('id', connectionId)
      .eq('agent.user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Connection not found');
      }
      throw new Error(`Failed to fetch connection status: ${error.message}`);
    }

    const mcpServer = connection.mcp_server;
    const serverStatus = this.mapStatusToMCPStatus(
      mcpServer.status_on_toolbox, 
      mcpServer.last_heartbeat_from_dtma
    );

    return {
      connectionId,
      status: connection.is_active && serverStatus.state === 'running' ? 'connected' : 'disconnected',
      serverStatus: serverStatus.state,
      health: serverStatus.health,
      lastChecked: new Date(),
      uptime: serverStatus.uptime,
      error: serverStatus.lastError
    };
  }

  /**
   * Test MCP connection for a specific agent and server
   */
  async testMCPConnection(agentId: string, mcpServerId: string): Promise<ConnectionTest> {
    await this.validateUserAccess(agentId);
    
    const mcpServer = await this.getMCPServerDetails(mcpServerId);
    
    try {
      // Build connection URL
      const connectionUrl = mcpServer.endpoint;
      
      // Test basic connectivity
      const response = await fetch(`${connectionUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date()
        };
      }
      
      // Test MCP protocol handshake
      const capabilities = await this.testMCPCapabilities(connectionUrl);
      
      return {
        success: true,
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
   * Get connection logs for debugging
   */
  async getConnectionLogs(connectionId: string, lines: number = 100): Promise<string[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get connection details with user validation
    const { data: connection, error } = await this.supabase
      .from('agent_mcp_connections')
      .select(`
        *,
        agent:agents!inner(user_id),
        mcp_server:account_tool_instances(
          account_tool_environment:account_tool_environments(
            name,
            public_ip_address
          )
        )
      `)
      .eq('id', connectionId)
      .eq('agent.user_id', user.id)
      .single();

    if (error) {
      throw new Error('Connection not found or access denied');
    }

    try {
      // Get logs from DTMA
      const environment = connection.mcp_server.account_tool_environment;
      const logs = await this.getMCPServerLogs(environment.name, lines);
      return logs;
    } catch (error) {
      console.error('Error fetching connection logs:', error);
      return [`Error fetching logs: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }

  // ============================================================================
  // USER DASHBOARD AND ANALYTICS
  // ============================================================================

  /**
   * Get user MCP dashboard with comprehensive overview
   */
  async getUserMCPDashboard(): Promise<UserMCPDashboard> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Get user's agents and their MCP connections
      const { data: agentConnections, error } = await this.supabase
        .from('agent_mcp_connections')
        .select(`
          *,
          agent:agents!inner(
            id,
            name,
            user_id
          ),
          mcp_server:account_tool_instances(
            id,
            instance_name_on_toolbox,
            status_on_toolbox,
            mcp_server_capabilities
          )
        `)
        .eq('agent.user_id', user.id)
        .eq('is_active', true);

      if (error) throw new Error(`Failed to fetch connections: ${error.message}`);

      // Get available MCP servers
      const availableServers = await this.getAvailableMCPServers();
      
      // Calculate statistics
      const connections = (agentConnections || []).map(this.transformToAgentMCPConnection.bind(this));
      const connectedAgents = new Set(connections.map(c => c.agentId)).size;
      const activeConnections = connections.filter(c => 
        c.mcpServer?.status === 'running'
      ).length;

      return {
        connectedAgents,
        availableServers: availableServers.length,
        activeConnections,
        totalRequests: 0, // Would need usage tracking
        connections,
        availableServers,
        lastUpdated: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get user dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent toolbelt with MCP connections and capabilities
   */
  async getAgentToolbelt(agentId: string): Promise<AgentToolbelt> {
    await this.validateUserAccess(agentId);

    const { data: agent, error: agentError } = await this.supabase
      .from('agents')
      .select('id, name')
      .eq('id', agentId)
      .single();

    if (agentError) {
      throw new Error(`Failed to fetch agent: ${agentError.message}`);
    }

    const connections = await this.getAgentMCPConnections(agentId);
    
    // Aggregate capabilities from all connections
    const availableCapabilities = Array.from(new Set(
      connections.flatMap(conn => conn.mcpServer?.capabilities || [])
    ));

    // Check connection health
    const connectionHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
    for (const connection of connections) {
      try {
        const status = await this.getConnectionStatus(connection.id);
        connectionHealth[connection.id] = status.health;
      } catch (error) {
        connectionHealth[connection.id] = 'unhealthy';
      }
    }

    return {
      agentId,
      agentName: agent.name,
      mcpConnections: connections,
      availableCapabilities,
      connectionHealth,
      lastUpdated: new Date()
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Build connection configuration with defaults
   */
  private buildConnectionConfig(mcpServer: EnhancedMCPServer, customConfig?: ConnectionConfig): ConnectionConfig {
    return {
      timeout: customConfig?.timeout || 30000,
      retryAttempts: customConfig?.retryAttempts || 3,
      customHeaders: customConfig?.customHeaders || {},
      enableLogging: customConfig?.enableLogging || false,
      maxConcurrentRequests: customConfig?.maxConcurrentRequests || 10
    };
  }

  /**
   * Log connection events for audit trail
   */
  private async logConnectionEvent(connectionId: string, event: string, details?: string): Promise<void> {
    try {
      await this.supabase
        .from('agent_mcp_connection_logs')
        .insert({
          connection_id: connectionId,
          event_type: event,
          event_details: details,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log connection event:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Transform database record to AgentMCPConnection interface
   */
  private transformToAgentMCPConnection(data: any): AgentMCPConnection {
    return {
      id: data.id,
      agentId: data.agent_id,
      mcpServerInstanceId: data.mcp_server_instance_id,
      connectionConfig: data.connection_config || {},
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastUsed: data.last_used ? new Date(data.last_used) : undefined,
      usageStats: data.usage_stats,
      agent: data.agent ? {
        id: data.agent.id,
        name: data.agent.name
      } : undefined,
      mcpServer: data.mcp_server ? {
        id: data.mcp_server.id,
        name: data.mcp_server.instance_name_on_toolbox,
        capabilities: data.mcp_server.mcp_server_capabilities || [],
        status: data.mcp_server.status_on_toolbox
      } : undefined
    };
  }
} 