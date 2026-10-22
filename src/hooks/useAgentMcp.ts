import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MCPServerConfig, MCPServerCapabilities } from '../lib/mcp/types';
import { useAuth } from '../contexts/AuthContext'; // Needed for user ID
import { useSupabaseClient } from './useSupabaseClient';
import type { Database } from '../types/database.types'; // Corrected path
import type { MCPServerConfig as MCPServerConfigType } from '../lib/mcp/types'; // Corrected path

// Types moved from AgentEdit
interface TestConnectionResult {
    success: boolean;
    message: string;
    capabilities?: MCPServerCapabilities | null;
}

// Constants moved from AgentEdit
const DEFAULT_NEW_SERVER_CONFIG: Partial<MCPServerConfig> = {
  name: '',
  endpoint_url: '',
  vault_api_key_id: null,
  timeout_ms: 5000,
  max_retries: 3,
  retry_backoff_ms: 1000,
  priority: 0,
  is_active: true,
};

// Define placeholder types for Create and Update if not in types.ts
// These will be properly defined or imported once the new data model for Toolboxes is in place.
export type PlaceholderMcpConfigCreate = Omit<MCPServerConfig, 'id' | 'config_id' | 'capabilities'>;
export type PlaceholderMcpConfigUpdate = Partial<Omit<MCPServerConfig, 'config_id' | 'capabilities'>> & { id: number };

// This hook will need significant refactoring to manage:
// 1. Toolboxes accessible by the agent (from agent_toolbox_access).
// 2. Deployed Services (Tool Instances) on those Toolboxes.
// 3. The agent's ToolbeltItems, including their credentials and permissions for those Deployed Services.
// The existing `McpConfiguration` type and CRUD operations are based on the old model.

export const useAgentMcp = (agentId: string | null) => {
  const { user } = useAuth(); // Get user for filtering/permissions
  const supabase = useSupabaseClient();
  const [mcpConfigurations, setMcpConfigurations] = useState<MCPServerConfig[]>([]); // Will become list of Toolboxes or ToolbeltItems
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMcpConfigurations = useCallback(async () => {
    if (!agentId) {
      setMcpConfigurations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    console.log(`[useAgentMcp:${agentId}] Fetching configurations (to be Toolbox/Toolbelt data)...`);
    // This fetch logic will change completely.
    // It will need to fetch data related to agent_toolbox_access, account_tool_environments,
    // account_tool_instances, agent_toolbelt_items, etc.
    try {
      const { data, error: dbError } = await supabase
        .from('mcp_configurations') // This table will be deprecated or repurposed
        .select('*, mcp_servers(*)') // This structure will change
        .eq('agent_id', agentId);

      if (dbError) throw dbError;
      // For now, simulate the old structure if data exists, or empty array.
      // This mapping will be removed once new data structures are fetched.
      const mappedData = data?.map(item => ({
        ...item,
        id: item.mcp_servers?.id || item.id, // Just for placeholder compatibility
        name: item.mcp_servers?.name || 'Unknown Toolbox',
        driver_type: item.mcp_servers?.driver_type,
        endpoint_url: item.mcp_servers?.endpoint_url,
        is_active: item.mcp_servers?.is_active,
        // ... other fields from mcp_servers that were flattened previously
      })) || [];
      setMcpConfigurations(mappedData as MCPServerConfig[]); 
      console.log(`[useAgentMcp:${agentId}] Fetched configurations successfully.`);
    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error fetching configurations:`, err);
      setError('Failed to load Toolbox configurations.'); // Updated error message
    } finally {
      setIsLoading(false);
    }
  }, [agentId, supabase]);

  useEffect(() => {
    fetchMcpConfigurations();
  }, [fetchMcpConfigurations]);

  const addMcpConfiguration = useCallback(async (configData: PlaceholderMcpConfigCreate) => {
    if (!agentId) throw new Error('Agent ID is required to add a configuration.');
    console.log(`[useAgentMcp:${agentId}] Attempting to add Toolbox/Service:`, configData.name);
    // This will map to creating a Toolbox, or deploying a Service, or adding to Toolbelt.
    // For now, it's a placeholder.
    setError(null);
    try {
      // Placeholder: Simulate adding to the old mcp_servers table concept for now
      // This will be replaced by calls to /toolboxes-user or /toolbox-tools or /agent-toolbelt
      const { data: newServer, error: serverError } = await supabase
          .from('mcp_servers') // Old table
          .insert({ 
              name: configData.name, 
              endpoint_url: configData.endpoint_url,
              vault_api_key_id: configData.vault_api_key_id,
              is_active: configData.is_active,
              priority: configData.priority,
              timeout_ms: configData.timeout_ms,
              max_retries: configData.max_retries,
              retry_backoff_ms: configData.retry_backoff_ms,
              // user_id needs to be set if table requires it, or handled by RLS/policy
          })
          .select()
          .single();
      if (serverError) throw serverError;
      if (!newServer) throw new Error('Failed to create server record.');

      // Then link via mcp_configurations (old model)
      const { error: configError } = await supabase
          .from('mcp_configurations')
          .insert({ agent_id: agentId, mcp_server_id: newServer.id, config_type: 'DIRECT' }); // Example config_type
      if (configError) throw configError;
      
      console.log(`[useAgentMcp:${agentId}] Added Toolbox/Service successfully:`, newServer.id);
      fetchMcpConfigurations(); // Refresh list
      return newServer as MCPServerConfig; // This return type will change
    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error adding Toolbox/Service:`, err);
      setError(`Failed to add Toolbox/Service: ${err.message}`);
      throw err;
    }
  }, [agentId, supabase, fetchMcpConfigurations]);

  const updateMcpConfiguration = useCallback(async (serverId: number, configData: PlaceholderMcpConfigUpdate) => {
    if (!agentId) throw new Error('Agent ID is required to update a configuration.');
    console.log(`[useAgentMcp:${agentId}] Attempting to update Toolbox/Service ID:`, serverId);
    // This will map to updating a Toolbox, or a Service, or a Toolbelt Item.
    setError(null);
    try {
      const { data: updatedServer, error: serverError } = await supabase
        .from('mcp_servers') // Old table
        .update(configData)
        .eq('id', serverId)
        .select()
        .single();

      if (serverError) throw serverError;
      if (!updatedServer) throw new Error('Toolbox/Service not found or failed to update.');
      
      console.log(`[useAgentMcp:${agentId}] Updated Toolbox/Service successfully:`, updatedServer.id);
      fetchMcpConfigurations(); // Refresh list
      return updatedServer as MCPServerConfig;
    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error updating Toolbox/Service:`, err);
      setError(`Failed to update Toolbox/Service: ${err.message}`);
      throw err;
    }
  }, [agentId, supabase, fetchMcpConfigurations]);

  const deleteMcpConfiguration = useCallback(async (serverId: number) => {
    if (!agentId) throw new Error('Agent ID is required to delete a configuration.');
    console.log(`[useAgentMcp:${agentId}] Attempting to delete Toolbox/Service ID:`, serverId);
    // This will map to deprovisioning/deleting a Toolbox, or a Service, or a Toolbelt Item.
    setError(null);
    try {
      // First, delete from mcp_configurations (link table in old model)
      const { error: configError } = await supabase
        .from('mcp_configurations')
        .delete()
        .eq('agent_id', agentId)
        .eq('mcp_server_id', serverId);
      if (configError) console.warn(`[useAgentMcp:${agentId}] Non-critical: Could not delete from mcp_configurations, proceeding to delete server. Error: ${configError.message}`);
      
      // Then delete the server itself (old model)
      const { error: serverError } = await supabase
        .from('mcp_servers')
        .delete()
        .eq('id', serverId);
      if (serverError) throw serverError;

      console.log(`[useAgentMcp:${agentId}] Deleted Toolbox/Service successfully:`, serverId);
      fetchMcpConfigurations(); // Refresh list
    } catch (err: any) {
      console.error(`[useAgentMcp:${agentId}] Error deleting Toolbox/Service:`, err);
      setError(`Failed to delete Toolbox/Service: ${err.message}`);
      throw err;
    }
  }, [agentId, supabase, fetchMcpConfigurations]);

  const testMcpConnection = useCallback(async (config: Partial<MCPServerConfig>) => {
    if (!agentId) return null;
    console.log(`[useAgentMcp:${agentId}] Testing connection for Toolbox/Service: ${config.name}`);
    // This function will likely be removed or completely re-thought.
    // Testing might occur at the DTMA level or via a specific backend health check for a Deployed Service.
    try {
      // This is a placeholder and would not work directly with the new model without significant changes.
      const response = await supabase.functions.invoke('mcp-test-connection', {
        body: { agent_id: agentId, mcp_server_config: config },
      });
      if (response.error) throw response.error;
      console.log(`[useAgentMcp:${agentId}] Connection test result for ${config.name}:`, response.data);
      return response.data; // Adjust based on actual return type of the (old) test function
    } catch (error: any) {
      console.error(`[useAgentMcp:${agentId}] Error testing connection for ${config.name}:`, error);
      return { success: false, message: `Connection test failed: ${error.message || 'Unknown error'}`, capabilities: null };
    }
  }, [agentId, supabase]);

  return {
    mcpConfigurations,
    isLoading,
    error,
    addMcpConfiguration,
    updateMcpConfiguration,
    deleteMcpConfiguration,
    testMcpConnection, // This function is likely to be deprecated/changed significantly
    fetchMcpConfigurations, // Expose refetch if needed by UI
  };
}; 