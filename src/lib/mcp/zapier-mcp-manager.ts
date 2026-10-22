/**
 * Zapier MCP Manager
 * 
 * Manages Zapier MCP server connections for agents, including:
 * - Connection CRUD operations
 * - Tool discovery and caching
 * - Schema conversion and validation
 * - Connection health monitoring
 */

import { MCPClient, MCPTool, convertMCPToolToOpenAI, MCPClientError } from './mcp-client';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AgentMCPConnection {
  id: string;
  agent_id: string;
  connection_name: string;
  server_url: string; // DEPRECATED: Use vault_server_url_id for new connections
  vault_server_url_id?: string; // Vault UUID for encrypted URL storage
  server_url_deprecated?: string; // Migration field
  connection_type: string;
  is_active: boolean;
  auth_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MCPToolCache {
  id: string;
  connection_id: string;
  tool_name: string;
  tool_schema: MCPTool;
  openai_schema: {
    name: string;
    description: string;
    parameters: any;
  };
  last_updated: string;
}

export interface ZapierMCPConnectionTest {
  success: boolean;
  error?: string;
  toolCount?: number;
  tools?: MCPTool[];
}

export class ZapierMCPManager {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  /**
   * Securely get the server URL for an MCP connection
   * This method handles both vault-encrypted URLs and legacy plain text URLs
   */
  private async getConnectionServerUrl(connectionId: string): Promise<string> {
    const { data: serverUrl, error } = await this.supabase.rpc('get_mcp_server_url', {
      connection_id: connectionId
    });

    if (error) {
      throw new Error(`Failed to retrieve server URL: ${error.message}`);
    }

    if (!serverUrl) {
      throw new Error('Server URL not found for connection');
    }

    return serverUrl;
  }

  /**
   * Get all MCP connections for an agent
   */
  async getAgentConnections(agentId: string): Promise<AgentMCPConnection[]> {
    const { data, error } = await this.supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('agent_id', agentId)
      .order('connection_name');

    if (error) {
      throw new Error(`Failed to fetch MCP connections: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new MCP connection for an agent
   */
  async createConnection(
    agentId: string,
    connectionName: string,
    serverUrl: string,
    authConfig: Record<string, any> = {}
  ): Promise<AgentMCPConnection> {
    try {
      const { data, error } = await this.supabase.functions.invoke('create-mcp-connection', {
        body: {
          agentId,
          connectionName,
          serverUrl,
          authConfig
        }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Connection creation failed');
      }

      console.log(`[ZapierMCPManager] Successfully created MCP connection: ${connectionName}`);
      return data.connection;
      
    } catch (error: any) {
      console.error(`[ZapierMCPManager] Failed to create connection:`, error);
      throw new Error(`Connection creation failed: ${error.message}`);
    }
  }

  /**
   * Update an existing MCP connection
   */
  async updateConnection(
    connectionId: string,
    updates: Partial<Pick<AgentMCPConnection, 'connection_name' | 'server_url' | 'is_active' | 'auth_config'>>
  ): Promise<AgentMCPConnection> {
    // If URL is being updated, test the new connection
    if (updates.server_url) {
      if (!this.isValidUrl(updates.server_url)) {
        throw new Error('Invalid server URL format');
      }

      const testResult = await this.testConnection(updates.server_url);
      if (!testResult.success) {
        throw new Error(`Connection test failed: ${testResult.error}`);
      }
    }

    const { data, error } = await this.supabase
      .from('agent_mcp_connections')
      .update(updates)
      .eq('id', connectionId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update MCP connection: ${error.message}`);
    }

    // If URL changed, refresh tools
    if (updates.server_url) {
      await this.refreshConnectionTools(connectionId);
    }

    return data;
  }

  /**
   * Delete an MCP connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('agent_mcp_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      throw new Error(`Failed to delete MCP connection: ${error.message}`);
    }
  }

  /**
   * Test connection to an MCP server
   */
  async testConnection(serverUrl: string): Promise<ZapierMCPConnectionTest> {
    try {
      console.log(`[ZapierMCPManager] Testing connection to: ${serverUrl}`);
      
      const client = new MCPClient(serverUrl, { timeout: 15000 }); // Increased timeout
      
      // Use the simpler test connection method
      const isConnected = await client.testConnection();
      
      if (!isConnected) {
        throw new Error('Connection test failed');
      }
      
      // If basic connection works, try to get tools
      await client.initialize();
      const { tools } = await client.listTools();
      await client.disconnect();

      console.log(`[ZapierMCPManager] Connection successful, found ${tools.length} tools`);

      return {
        success: true,
        toolCount: tools.length,
        tools: tools.slice(0, 5) // Return first 5 tools for preview
      };
    } catch (error) {
      console.error('MCP connection test failed:', error);
      
      let errorMessage = 'Connection failed';
      if (error instanceof MCPClientError) {
        errorMessage = `MCP Error: ${error.message}`;
        if (error.code) {
          errorMessage += ` (Code: ${error.code})`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide more specific error messages based on common issues
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error: Unable to reach the MCP server. Please check the URL and your internet connection.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout: The MCP server took too long to respond.';
        } else if (error.message.includes('400')) {
          errorMessage = 'Bad Request: The MCP server rejected the request. Please verify the server URL is correct.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Not Found: The MCP server endpoint was not found. Please check the URL path.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server Error: The MCP server encountered an internal error.';
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Refresh tools for a specific connection
   */
  async refreshConnectionTools(connectionId: string): Promise<void> {
    // Get connection details
    const { data: connection, error: connectionError } = await this.supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      throw new Error(`Connection not found: ${connectionError?.message}`);
    }

    if (!connection.is_active) {
      return; // Skip inactive connections
    }

    try {
      // Use secure edge function to refresh tools (handles vault decryption server-side)
      const { data, error } = await this.supabase.functions.invoke('refresh-mcp-tools', {
        body: { connectionId }
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Tool refresh failed');
      }

      console.log(`[ZapierMCPManager] Successfully refreshed ${data.toolCount || 0} tools for connection ${connectionId}`);
    } catch (error) {
      console.error(`Failed to refresh tools for connection ${connectionId}:`, error);
      
      // Mark connection as inactive if it's failing
      await this.supabase
        .from('agent_mcp_connections')
        .update({ is_active: false })
        .eq('id', connectionId);

      throw error;
    }
  }

  /**
   * Get cached tools for an agent
   */
  async getAgentTools(agentId: string): Promise<{
    name: string;
    description: string;
    parameters: any;
    _mcpConnectionId: string;
    _mcpToolName: string;
  }[]> {
    const { data, error } = await this.supabase
      .rpc('get_agent_mcp_tools', { p_agent_id: agentId });

    if (error) {
      throw new Error(`Failed to fetch agent MCP tools: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      ...row.openai_schema,
      _mcpConnectionId: row.connection_id,
      _mcpToolName: row.tool_name
    }));
  }

  /**
   * Get cached tools for a specific connection
   */
  async getConnectionTools(connectionId: string): Promise<MCPToolCache[]> {
    const { data, error } = await this.supabase
      .from('mcp_tools_cache')
      .select('*')
      .eq('connection_id', connectionId)
      .order('tool_name');

    if (error) {
      throw new Error(`Failed to fetch connection tools: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Execute a tool through MCP
   */
  async executeTool(
    connectionId: string,
    toolName: string,
    arguments_: Record<string, any>
  ): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    content?: string;
  }> {
    // Get connection details
    const { data: connection, error: connectionError } = await this.supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      return {
        success: false,
        error: `Connection not found: ${connectionError?.message}`
      };
    }

    if (!connection.is_active) {
      return {
        success: false,
        error: 'Connection is inactive'
      };
    }

    try {
      const client = new MCPClient(connection.server_url);
      await client.initialize();
      
      const result = await client.callTool(toolName, arguments_);
      
      await client.disconnect();

      if (result.isError) {
        const errorContent = result.content.find(c => c.type === 'text')?.text || 'Tool execution failed';
        return {
          success: false,
          error: errorContent
        };
      }

      // Extract text content for display
      const textContent = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      return {
        success: true,
        result: result.structuredContent || result.content,
        content: textContent
      };
    } catch (error) {
      console.error(`MCP tool execution failed:`, error);
      
      let errorMessage = 'Tool execution failed';
      if (error instanceof MCPClientError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Refresh tools for all active connections of an agent
   */
  async refreshAllAgentTools(agentId: string): Promise<void> {
    const connections = await this.getAgentConnections(agentId);
    const activeConnections = connections.filter(c => c.is_active);

    const refreshPromises = activeConnections.map(connection =>
      this.refreshConnectionTools(connection.id).catch(error => {
        console.error(`Failed to refresh tools for connection ${connection.id}:`, error);
        // Continue with other connections even if one fails
      })
    );

    await Promise.all(refreshPromises);
  }

  /**
   * Get connection health status
   */
  async getConnectionHealth(connectionId: string): Promise<{
    isHealthy: boolean;
    lastChecked: string;
    error?: string;
    toolCount: number;
  }> {
    const { data: connection, error: connectionError } = await this.supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (connectionError || !connection) {
      return {
        isHealthy: false,
        lastChecked: new Date().toISOString(),
        error: 'Connection not found',
        toolCount: 0
      };
    }

    // Get tool count
    const { count } = await this.supabase
      .from('mcp_tools_cache')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId);

    if (!connection.is_active) {
      return {
        isHealthy: false,
        lastChecked: connection.updated_at,
        error: 'Connection is inactive',
        toolCount: count || 0
      };
    }

    // Test connection using secure URL retrieval
    const serverUrl = await this.getConnectionServerUrl(connectionId);
    const testResult = await this.testConnection(serverUrl);

    return {
      isHealthy: testResult.success,
      lastChecked: new Date().toISOString(),
      error: testResult.error,
      toolCount: count || 0
    };
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
