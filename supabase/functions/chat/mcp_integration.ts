import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { MCPManager } from './manager.ts';
import { MCPServerConfig, AgentopiaContextData, AggregatedMCPResults } from './types.ts';
import { ChatMessage } from './context_builder.ts';

// MCP-related interfaces
interface MCPVaultResponse {
  key: string;
  version: number;
  created_at: string;
}

// Enhanced MCP configuration interface aligned with new database schema
interface EnhancedMCPServerConfig {
  account_tool_instance_id: string;
  instance_name_on_toolbox: string;
  docker_image_url: string;
  mcp_server_type: string;
  mcp_endpoint_path: string;
  mcp_transport_type: 'stdio' | 'sse' | 'websocket';
  mcp_server_capabilities: any;
  mcp_discovery_metadata: any;
  is_active: boolean;
  created_at: string;
  agent_permissions?: {
    granted_at: string;
    granted_by: string;
    permission_scope: string;
  };
}

/**
 * Enhanced function to fetch MCP servers accessible to an agent using new database schema
 * @param agentId - The ID of the agent to fetch MCP servers for
 * @param supabaseClient - Supabase client instance
 * @returns Array of MCP server configurations the agent can access
 */
export async function getAgentMCPServers(agentId: string, supabaseClient: SupabaseClient): Promise<MCPServerConfig[]> {
  try {
    console.log(`[MCP Integration] Fetching MCP servers accessible to agent: ${agentId}`);
    
    // Use our new database function to get agent-accessible MCP servers
    const { data: serverConfigs, error } = await supabaseClient.rpc('get_agent_mcp_servers', {
      p_agent_id: agentId
    });

    if (error) {
      console.error('[MCP Integration] Error fetching agent MCP servers:', error);
      return [];
    }

    if (!serverConfigs || serverConfigs.length === 0) {
      console.log(`[MCP Integration] No MCP servers accessible to agent ${agentId}`);
      return [];
    }

    // Transform to MCPServerConfig format
    const mcpConfigs: MCPServerConfig[] = serverConfigs.map((config: EnhancedMCPServerConfig) => ({
      id: config.account_tool_instance_id,
      agentId: agentId,
      name: config.instance_name_on_toolbox,
      endpointUrl: config.mcp_endpoint_path,
      apiKeyVaultId: null, // Will be handled by DTMA credential injection
      timeout: 30000, // Default timeout
      maxRetries: 3,
      retryBackoffMs: 1000,
      priority: 100,
      isActive: config.is_active,
      // Enhanced metadata from new schema
      serverType: config.mcp_server_type,
      transportType: config.mcp_transport_type,
      capabilities: config.mcp_server_capabilities,
      discoveryMetadata: config.mcp_discovery_metadata,
      dockerImageUrl: config.docker_image_url,
      agentPermissions: config.agent_permissions
    }));

    console.log(`[MCP Integration] Found ${mcpConfigs.length} accessible MCP servers for agent ${agentId}`);
    return mcpConfigs;

  } catch (error) {
    console.error(`[MCP Integration] Unexpected error fetching MCP servers for agent ${agentId}:`, error);
    return [];
  }
}

/**
 * Enhanced function to get MCP configurations with permission validation
 * @param agentId - The ID of the agent to fetch MCP configurations for
 * @param supabaseClient - Supabase client instance
 * @returns Array of MCP server configurations with permission validation
 */
export async function getMCPConfigurations(agentId: string, supabaseClient: SupabaseClient): Promise<MCPServerConfig[]> {
  // Use the new enhanced function
  return await getAgentMCPServers(agentId, supabaseClient);
}

/**
 * Validate agent access to specific MCP server
 * @param agentId - The ID of the agent
 * @param serverInstanceId - The account_tool_instance_id of the MCP server
 * @param supabaseClient - Supabase client instance
 * @returns Boolean indicating if agent has access
 */
export async function validateAgentMCPAccess(
  agentId: string, 
  serverInstanceId: string, 
  supabaseClient: SupabaseClient
): Promise<boolean> {
  try {
    console.log(`[MCP Integration] Validating agent ${agentId} access to MCP server ${serverInstanceId}`);
    
    const { data: hasAccess, error } = await supabaseClient.rpc('validate_agent_mcp_access', {
      p_agent_id: agentId,
      p_server_instance_id: serverInstanceId
    });

    if (error) {
      console.error('[MCP Integration] Error validating MCP access:', error);
      return false;
    }

    console.log(`[MCP Integration] Agent ${agentId} access to ${serverInstanceId}: ${hasAccess ? 'GRANTED' : 'DENIED'}`);
    return hasAccess || false;

  } catch (error) {
    console.error(`[MCP Integration] Unexpected error validating MCP access:`, error);
    return false;
  }
}

/**
 * Enhanced MCP context preparation with access control validation
 * @param messages - Chat message history
 * @param agentId - The ID of the agent
 * @param agentName - The name of the agent
 * @param agentPersonality - The personality of the agent
 * @param systemInstructions - System instructions for the agent
 * @param assistantInstructions - Assistant instructions for the agent
 * @param requestedServers - Optional list of specific servers to access
 * @returns Array of context data for MCP processing
 */
export async function prepareMCPContextWithAccessControl(
  messages: ChatMessage[],
  agentId: string,
  agentName: string,
  agentPersonality: string,
  systemInstructions?: string,
  assistantInstructions?: string,
  requestedServers?: string[]
): Promise<AgentopiaContextData[]> {
  const contextData: AgentopiaContextData[] = [];

  // Add agent identity context with enhanced metadata
  contextData.push({
    type: 'agent_identity',
    content: {
      id: agentId,
      name: agentName,
      personality: agentPersonality,
      systemInstructions: systemInstructions || '',
      assistantInstructions: assistantInstructions || '',
      mcpAccessControl: {
        hasMultiMCPAccess: true,
        requestedServers: requestedServers || [],
        timestamp: new Date().toISOString()
      }
    },
    timestamp: new Date().toISOString(),
    priority: 100
  });

  // Add enhanced chat history with MCP context markers
  if (messages && messages.length > 0) {
    const recentMessages = messages.slice(-10); // Increased for better multi-MCP context
    contextData.push({
      type: 'chat_history',
      content: {
        messages: recentMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          agentName: msg.agentName,
          mcpContext: {
            hadMCPAccess: true,
            activeServers: [], // Will be populated by MCP manager
            capabilities: []
          }
        }))
      },
      timestamp: new Date().toISOString(),
      priority: 90
    });
  }

  return contextData;
}

// Legacy function for backward compatibility
export async function prepareMCPContext(
  messages: ChatMessage[],
  agentId: string,
  agentName: string,
  agentPersonality: string,
  systemInstructions?: string,
  assistantInstructions?: string
): Promise<AgentopiaContextData[]> {
  return await prepareMCPContextWithAccessControl(
    messages,
    agentId,
    agentName,
    agentPersonality,
    systemInstructions,
    assistantInstructions
  );
}

/**
 * Retrieves an API key from Supabase Vault
 * @param vaultKeyId - The ID of the key in Supabase Vault
 * @param supabaseClient - Supabase client instance
 * @returns The decrypted API key or null if retrieval fails
 */
export async function getVaultAPIKey(vaultKeyId: string, supabaseClient: SupabaseClient): Promise<string | null> {
  try {
    console.log(`[MCP Integration] Attempting to retrieve vault key: ${vaultKeyId}`);
    
    const { data, error } = await supabaseClient.rpc('get_secret', {
      secret_name: vaultKeyId
    });

    if (error) {
      console.error(`[MCP Integration] Vault RPC error for key ${vaultKeyId}:`, error);
      return null;
    }

    if (!data) {
      console.warn(`[MCP Integration] No data returned from vault for key ${vaultKeyId}`);
      return null;
    }

    console.log(`[MCP Integration] Successfully retrieved vault key: ${vaultKeyId}`);
    return data;

  } catch (error) {
    console.error(`[MCP Integration] Unexpected error retrieving vault key ${vaultKeyId}:`, error);
    return null;
  }
}

/**
 * Enhanced MCP context processing with multi-server access control
 * @param agentId - The ID of the agent
 * @param mcpContext - Prepared context data for MCP processing
 * @param supabaseClient - Supabase client instance
 * @param requestedServers - Optional list of specific servers to query
 * @returns Formatted MCP resource context string or null
 */
export async function processMCPContextWithAccessControl(
  agentId: string,
  mcpContext: AgentopiaContextData[],
  supabaseClient: SupabaseClient,
  requestedServers?: string[]
): Promise<string | null> {
  try {
    console.log(`[MCP Integration] Processing MCP context for agent ${agentId}`);
    
    // Get accessible MCP servers using enhanced function
    const mcpConfigs = await getAgentMCPServers(agentId, supabaseClient);
    
    if (mcpConfigs.length === 0) {
      console.log(`[MCP Integration] No accessible MCP servers for agent ${agentId}`);
      return null;
    }

    // Filter servers if specific ones were requested
    let serversToQuery = mcpConfigs;
    if (requestedServers && requestedServers.length > 0) {
      serversToQuery = mcpConfigs.filter(config => 
        requestedServers.includes(config.id) || 
        requestedServers.includes(config.name)
      );
      
      console.log(`[MCP Integration] Filtered to ${serversToQuery.length} requested servers`);
    }

    if (serversToQuery.length === 0) {
      console.log(`[MCP Integration] No accessible servers match requested servers`);
      return null;
    }

    // Create enhanced MCP manager with DTMA integration
    const mcpManager = new MCPManager({
      enableDTMAIntegration: true,
      dtmaEndpoint: Deno.env.get('DTMA_ENDPOINT') || 'http://localhost:30000',
      dtmaAuthToken: Deno.env.get('DTMA_AUTH_TOKEN'),
      maxConcurrentConnections: 5,
      timeoutMs: 30000,
      enableCredentialInjection: true
    });

    // Process context with enhanced access control
    const results = await mcpManager.processContextWithAccessControl(
      mcpContext,
      serversToQuery,
      {
        agentId,
        validateAccess: true,
        auditLog: true,
        permissionScope: 'chat_context'
      }
    );

    if (!results) {
      console.log(`[MCP Integration] No results from MCP context processing`);
      return null;
    }

    // Format enhanced results
    const formattedResults = formatMCPResults(results, {
      includeServerInfo: true,
      includeCapabilities: true,
      includeAccessControl: true
    });

    console.log(`[MCP Integration] Successfully processed MCP context for ${serversToQuery.length} servers`);
    return formattedResults;

  } catch (error) {
    console.error(`[MCP Integration] Error processing MCP context:`, error);
    return null;
  }
}

// Legacy function for backward compatibility
export async function processMCPContext(
  agentId: string,
  mcpContext: AgentopiaContextData[],
  supabaseClient: SupabaseClient
): Promise<string | null> {
  return await processMCPContextWithAccessControl(agentId, mcpContext, supabaseClient);
}

/**
 * Enhanced MCP results formatting with access control metadata
 * @param results - Aggregated MCP results
 * @param options - Formatting options
 * @returns Formatted string for chat context
 */
function formatMCPResults(results: AggregatedMCPResults, options: {
  includeServerInfo?: boolean;
  includeCapabilities?: boolean;
  includeAccessControl?: boolean;
} = {}): string {
  if (!results || !results.resources || results.resources.length === 0) {
    return '';
  }

  const sections: string[] = [];

  // Add server information if requested
  if (options.includeServerInfo && results.serverInfo) {
    sections.push('=== MCP Server Information ===');
    results.serverInfo.forEach(server => {
      sections.push(`Server: ${server.name} (${server.type})`);
      sections.push(`Transport: ${server.transportType}`);
      sections.push(`Capabilities: ${server.capabilities?.join(', ') || 'None'}`);
      
      if (options.includeAccessControl && server.accessControl) {
        sections.push(`Access: ${server.accessControl.granted ? 'GRANTED' : 'DENIED'}`);
        sections.push(`Scope: ${server.accessControl.scope || 'chat_context'}`);
      }
      sections.push('');
    });
  }

  // Add resources
  sections.push('=== Available MCP Resources ===');
  results.resources.forEach(resource => {
    sections.push(`Resource: ${resource.name}`);
    sections.push(`Type: ${resource.type}`);
    sections.push(`Description: ${resource.description || 'No description'}`);
    sections.push(`Server: ${resource.serverName || 'Unknown'}`);
    sections.push('');
  });

  // Add capabilities if requested
  if (options.includeCapabilities && results.capabilities) {
    sections.push('=== MCP Capabilities ===');
    results.capabilities.forEach(capability => {
      sections.push(`- ${capability.name}: ${capability.description || 'No description'}`);
    });
    sections.push('');
  }

  return sections.join('\n');
} 