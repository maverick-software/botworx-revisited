/**
 * Database service for agent tools queries
 * Handles all database interactions with proper error handling
 */

import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { AgentPermission, ServiceProvider } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Export supabase client for use in other parts of the function
export { supabase };

/**
 * Fetches agent integration permissions with user credentials
 */
export async function getAgentPermissions(agentId: string, userId: string) {
  console.log(`[DatabaseService] Fetching permissions for agent ${agentId}, user ${userId}`);

  const { data: permissions, error } = await supabase
    .from('agent_integration_permissions')
    .select(`
      allowed_scopes,
      is_active,
      permission_level,
      user_integration_credentials!agent_integration_permissions_user_oauth_connection_id_fkey(
        id,
        connection_name,
        oauth_provider_id,
        credential_type,
        connection_status,
        token_expires_at
      )
    `)
    .eq('agent_id', agentId)
    .eq('user_integration_credentials.user_id', userId)
    .eq('is_active', true)
    .in('user_integration_credentials.connection_status', ['active', 'expired'])
    .order('granted_at', { ascending: false });
  
  if (error) {
    console.error('[DatabaseService] Error fetching permissions:', error);
    throw error;
  }

  return permissions as AgentPermission[];
}

/**
 * Fetches service provider details by IDs
 */
export async function getServiceProviders(providerIds: string[]) {
  console.log(`[DatabaseService] Fetching service providers for IDs: ${providerIds.join(', ')}`);

  const { data: providers, error } = await supabase
    .from('service_providers')
    .select('id, name, display_name')
    .in('id', providerIds);
  
  if (error) {
    console.error('[DatabaseService] Error fetching service providers:', error);
    throw error;
  }

  return providers as ServiceProvider[];
}

/**
 * Checks if agent has assigned media for Media Library tools
 */
export async function hasAgentDocuments(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for agent media assignments for agent ${agentId}, user ${userId}`);

  const { data: assignments, error } = await supabase
    .from('agent_media_assignments')
    .select('id')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);
  
  if (error) {
    console.error('[DatabaseService] Error checking agent media assignments:', error);
    return false;
  }

  console.log(`[DatabaseService] Found ${assignments?.length || 0} active media assignments`);
  return assignments && assignments.length > 0;
}

/**
 * Checks if agent has contact permissions
 */
export async function hasAgentContactPermissions(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for agent contact permissions for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: contactPermissions, error } = await supabase
      .from('agent_contact_permissions')
      .select('id, permission_type')
      .eq('agent_id', agentId)
      .limit(1);
    
    if (error) {
      console.error('[DatabaseService] Error checking contact permissions:', error);
      return false;
    }

    // Check if permission exists AND is not 'no_access'
    const hasPermissions = contactPermissions && 
                          contactPermissions.length > 0 && 
                          contactPermissions[0].permission_type !== 'no_access';
    
    console.log(`[DatabaseService] Found ${contactPermissions?.length || 0} contact permission records, permission_type: ${contactPermissions?.[0]?.permission_type}`);
    console.log(`[DatabaseService] Has contact permissions: ${hasPermissions}`);
    return hasPermissions;
  } catch (error) {
    console.error('[DatabaseService] Error checking contact permissions:', error);
    return false;
  }
}

/**
 * Checks if agent has temporary chat links enabled in settings
 */
export async function hasTemporaryChatLinksEnabled(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for temporary chat links setting for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('metadata')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('[DatabaseService] Error fetching agent metadata:', error);
      return false;
    }

    const metadata = agent?.metadata || {};
    const settings = metadata.settings || {};
    const isEnabled = settings.temporary_chat_links_enabled === true;
    
    console.log(`[DatabaseService] Temporary chat links enabled: ${isEnabled}`);
    return isEnabled;
  } catch (error) {
    console.error('[DatabaseService] Error checking temporary chat links setting:', error);
    return false;
  }
}

/**
 * Check if agent has advanced reasoning enabled
 */
export async function hasAdvancedReasoningEnabled(agentId: string, userId: string): Promise<boolean> {
  console.log(`[DatabaseService] Checking for advanced reasoning setting for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('metadata')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (error || !agent) {
      console.log(`[DatabaseService] Agent not found or error:`, error);
      return false;
    }

    // Simply check the UI setting - defaults to false if not set
    const metadata = agent?.metadata || {};
    const settings = metadata.settings || {};
    const reasoningEnabled = settings.reasoning_enabled === true;
    
    console.log(`[DatabaseService] Advanced reasoning enabled: ${reasoningEnabled} (from metadata.settings.reasoning_enabled: ${settings.reasoning_enabled})`);
    return reasoningEnabled;
  } catch (error) {
    console.error(`[DatabaseService] Error checking advanced reasoning:`, error);
    return false;
  }
}

/**
 * Get all tool settings for an agent
 */
export async function getToolSettings(agentId: string, userId: string): Promise<Record<string, boolean>> {
  console.log(`[DatabaseService] Fetching tool settings for agent ${agentId}, user ${userId}`);
  
  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('metadata')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single();

    if (error || !agent) {
      console.log(`[DatabaseService] Agent not found or error:`, error);
      return {};
    }

    const metadata = agent?.metadata || {};
    const settings = metadata.settings || {};
    
    // Return all tool settings, defaulting to false if not set
    const toolSettings = {
      voice_enabled: settings.voice_enabled === true,
      web_search_enabled: settings.web_search_enabled === true,
      document_creation_enabled: settings.document_creation_enabled === true,
      ocr_processing_enabled: settings.ocr_processing_enabled === true,
      temporary_chat_links_enabled: settings.temporary_chat_links_enabled === true,
      reasoning_enabled: settings.reasoning_enabled === true
    };
    
    console.log(`[DatabaseService] Tool settings:`, toolSettings);
    return toolSettings;
  } catch (error) {
    console.error(`[DatabaseService] Error fetching tool settings:`, error);
    return {};
  }
}

