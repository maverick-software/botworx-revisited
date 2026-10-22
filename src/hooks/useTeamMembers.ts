import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TeamMember, Agent } from '../types'; // Import necessary types
import { PostgrestError } from '@supabase/supabase-js';

// Type for the data returned by the fetch query
interface TeamMemberData extends Omit<TeamMember, 'agent'> {
  agents: Agent | null; // Supabase join returns related table in a nested object
}

// Type for updates, omitting keys managed by DB or joins
type TeamMemberUpdatePayload = Partial<Omit<TeamMember, 'team_id' | 'agent_id' | 'joined_at' | 'agent'>>;

// Define the shape of the raw data fetched from Supabase
// The join `agents!...(...)` still results in an `agents` property
type FetchedTeamMember = {
  team_id: string;
  agent_id: string;
  team_role: string;
  team_role_description: string | null;
  reports_to_agent_id: string | null;
  reports_to_user: boolean | null;
  joined_at: string;
  // Supabase returns the joined data under the simple 'agents' key
  // even when using the explicit join syntax agents!...
  agents: Agent[] | null | Agent; // Can be array, single object, or null
};

interface UseTeamMembersReturn {
  members: TeamMember[];
  loading: boolean;
  error: PostgrestError | null;
  fetchTeamMembers: (teamId: string) => Promise<void>;
  addTeamMember: (teamId: string, agentId: string, team_role: string, team_role_description?: string) => Promise<TeamMember | null>;
  removeTeamMember: (teamId: string, agentId: string) => Promise<boolean>;
  updateTeamMember: (teamId: string, agentId: string, updates: TeamMemberUpdatePayload) => Promise<TeamMember | null>;
}

export function useTeamMembers(): UseTeamMembersReturn {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  // Helper to transform fetched data
  const transformMemberData = (data: FetchedTeamMember[] | null): TeamMember[] => {
    if (!data) return [];
    // console.log('[transformMemberData] Input data:', data); // Keep logs off for now
    const transformed = data.map((item, index) => {
      // console.log(`[transformMemberData] Processing item ${index}:`, item);
      
      // Extract agent data correctly using the 'agents' key
      let agent: Agent | null = null;
      if (item.agents) {
        if (Array.isArray(item.agents) && item.agents.length > 0) {
          agent = item.agents[0];
        } else if (!Array.isArray(item.agents)) {
          // Handle case where Supabase returns a single object directly
          agent = item.agents;
        } 
      }
      // console.log(`[transformMemberData] Extracted agent for item ${index} using key 'agents':`, agent);
      
      const memberObject = {
        team_id: item.team_id,
        agent_id: item.agent_id,
        team_role: item.team_role,
        team_role_description: item.team_role_description,
        reports_to_agent_id: item.reports_to_agent_id,
        reports_to_user: item.reports_to_user,
        joined_at: item.joined_at,
        // If agent is null/undefined after extraction, provide empty object
        // Otherwise, use the extracted agent.
        agent: agent ?? {} as Agent, 
      };
      // console.log(`[transformMemberData] Constructed memberObject for item ${index}:`, memberObject);
      return memberObject;
    });
    // Filter out members where the agent object is empty OR missing an ID
    const filtered = transformed.filter(item => item.agent && typeof item.agent === 'object' && item.agent.id);
    // console.log('[transformMemberData] Filtered result:', filtered);
    return filtered;
  };

  // Fetch members for a specific team
  const fetchTeamMembers = useCallback(async (teamId: string) => {
    if (!teamId) {
        console.warn('fetchTeamMembers called without teamId');
        setMembers([]);
        return;
    }
    setLoading(true);
    setError(null);
    try {
      // Keep simplified join syntax (agents!...) 
      const { data, error: fetchError } = await supabase
        .from('team_members')
        .select(
          `
          team_id,
          agent_id,
          team_role,
          team_role_description,
          reports_to_agent_id,
          reports_to_user,
          joined_at,
          agents!team_members_agent_id_fkey ( id, name, description, personality, active, created_at, updated_at )`
        )
        .eq('team_id', teamId);

      if (fetchError) throw fetchError;

      // Restore proper type assertion
      const fetchedData = data as FetchedTeamMember[] | null;
      // console.log('[useTeamMembers] Raw fetched data (Simplified JOIN):', fetchedData); 

      const transformedMembers = transformMemberData(fetchedData);
      // console.log('[useTeamMembers] Transformed members before setting state (Simplified JOIN):', transformedMembers); 

      setMembers(transformedMembers);
    } catch (err) {
      console.error(`Error fetching members for team ${teamId}:`, err);
      if (err instanceof Error) {
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
      }
      // Ensure setError receives the correct type or null
      const pgError = (err instanceof Error && 'code' in err) ? err as PostgrestError : null;
      setError(pgError);
      if (!pgError && err instanceof Error) {
        console.error('Caught a non-Postgrest error:', err.message);
      } else if (!pgError) {
         console.error('Caught an unknown error structure:', JSON.stringify(err, null, 2));
      }
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add a new member to a team
  const addTeamMember = useCallback(async (teamId: string, agentId: string, team_role: string, team_role_description?: string): Promise<TeamMember | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('team_members')
        .insert([{ team_id: teamId, agent_id: agentId, team_role, team_role_description }])
        .select(`
          team_id, agent_id, team_role, team_role_description, reports_to_agent_id, reports_to_user, joined_at, 
          agents:agents!team_members_agent_id_fkey (id, name, description, personality, active, created_at, updated_at)
        `)
        .single();

      if (insertError) throw insertError;
      const newMemberData = data as FetchedTeamMember | null;

      const newMember = transformMemberData(newMemberData ? [newMemberData] : [])[0];
      return newMember;
    } catch (err) {
      console.error(`Error adding agent ${agentId} to team ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Remove a member from a team
  const removeTeamMember = useCallback(async (teamId: string, agentId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('team_members')
        .delete()
        .match({ team_id: teamId, agent_id: agentId });

      if (deleteError) throw deleteError;
      // Update local state
      setMembers(currentMembers => currentMembers.filter(m => !(m.team_id === teamId && m.agent_id === agentId)));
      return true;
    } catch (err) {
      console.error(`Error removing agent ${agentId} from team ${teamId}:`, err);
      setError(err as PostgrestError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a team member's details
  const updateTeamMember = useCallback(async (teamId: string, agentId: string, updates: TeamMemberUpdatePayload): Promise<TeamMember | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('team_members')
        .update(updates)
        .match({ team_id: teamId, agent_id: agentId })
        .select(`
          team_id, agent_id, team_role, team_role_description, reports_to_agent_id, reports_to_user, joined_at, 
          agents:agents!team_members_agent_id_fkey (id, name, description, personality, active, created_at, updated_at)
        `)
        .single();

      if (updateError) throw updateError;
      // Use the specific FetchedTeamMember type for the single result
      const updatedMemberData = data as FetchedTeamMember | null;

      const updatedMember = transformMemberData(updatedMemberData ? [updatedMemberData] : [])[0];
      setMembers(currentMembers => currentMembers.map(m => 
        (m.team_id === teamId && m.agent_id === agentId) ? updatedMember : m
      ));
      return updatedMember;
    } catch (err) {
      console.error(`Error updating agent ${agentId} in team ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    members,
    loading,
    error,
    fetchTeamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
  };
} 