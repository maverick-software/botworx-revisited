import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { WorkspaceDetails as ImportedWorkspaceDetails, ContextSettings, BasicWorkspaceMember } from './context_builder.ts';

type MemberType = 'user' | 'agent' | 'team';

interface BasicRoomMember {
    member_id: string; // uuid
    member_type: MemberType;
    // Add name/details if the worker sends them
}

/**
 * Fetches workspace details including members and context settings
 * @param workspaceId - The ID of the workspace to fetch details for
 * @param supabaseClient - Supabase client instance
 * @returns Workspace details or null if not found/error
 */
export async function getWorkspaceDetails(workspaceId: string, supabaseClient: SupabaseClient): Promise<ImportedWorkspaceDetails | null> {
  try {
    console.log(`[getWorkspaceDetails] Fetching workspace details for: ${workspaceId}`);

    // Fetch workspace data
    const { data: workspaceData, error: workspaceError } = await supabaseClient
      .from('workspaces')
      .select('id, name, description, context_window_size, context_window_token_limit')
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      console.error(`[getWorkspaceDetails] Error fetching workspace ${workspaceId}:`, workspaceError);
      return null;
    }

    if (!workspaceData) {
      console.warn(`[getWorkspaceDetails] No workspace found for ID: ${workspaceId}`);
      return null;
    }

    console.log(`[getWorkspaceDetails] Found workspace: ${workspaceData.name}`);

    // Fetch workspace members
    const { data: membersData, error: membersError } = await supabaseClient
      .from('workspace_members')
      .select(`
        member_id,
        member_type,
        user_profiles:member_id!inner (
          full_name
        ),
        agents:member_id!inner (
          name
        ),
        teams:member_id!inner (
          name
        )
      `)
      .eq('workspace_id', workspaceId);

    if (membersError) {
      console.error(`[getWorkspaceDetails] Error fetching members for workspace ${workspaceId}:`, membersError);
      // Continue with empty members rather than failing completely
    }

    // Process and format members
    const members: BasicWorkspaceMember[] = (membersData || []).map((m: any) => ({
      id: m.member_id,
      type: m.member_type,
      // Extract names from joined tables
      user_name: m.user_profiles?.full_name ?? null,
      agent_name: m.agents?.name ?? null,
      team_name: m.teams?.name ?? null,
    }));

    return {
      ...workspaceData,
      members: members,
    };

  } catch (error) {
    console.error(`Unexpected error in getWorkspaceDetails for ${workspaceId}:`, error);
    return null;
  }
}

/**
 * Creates context settings based on workspace configuration
 * @param workspaceDetails - Workspace details containing context limits
 * @returns Context settings object with message and token limits
 */
export function createContextSettings(workspaceDetails: ImportedWorkspaceDetails | null): ContextSettings {
  return {
    messageLimit: workspaceDetails?.context_window_size ?? 20, 
    tokenLimit: workspaceDetails?.context_window_token_limit ?? 8000, 
  };
}

/**
 * Validates workspace access for a user
 * @param workspaceId - The ID of the workspace to validate access for
 * @param userId - The ID of the user to check access for
 * @param supabaseClient - Supabase client instance
 * @returns Boolean indicating if user has access to the workspace
 */
export async function validateWorkspaceAccess(
  workspaceId: string, 
  userId: string, 
  supabaseClient: SupabaseClient
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .from('workspace_members')
      .select('member_id')
      .eq('workspace_id', workspaceId)
      .eq('member_id', userId)
      .eq('member_type', 'user')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error(`Error validating workspace access for user ${userId} in workspace ${workspaceId}:`, error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error(`Unexpected error validating workspace access:`, error);
    return false;
  }
} 