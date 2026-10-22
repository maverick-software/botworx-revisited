import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Agent } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

// Add type for Agent Summary
export interface AgentSummary {
  id: string;
  name: string | null;
}

interface AgentTeamDetails {
  team_id: string;
  team_name: string | null;
  team_role: string | null;
  reports_to_user: boolean | null;
  reports_to_agent_id: string | null;
}

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: PostgrestError | null;
  fetchAllAgents: () => Promise<Agent[]>; // Returns the fetched agents
  
  // State and function for Agent Summaries (for invite lists)
  agentSummaries: AgentSummary[];
  agentSummariesLoading: boolean;
  agentSummariesError: PostgrestError | null;
  fetchAgentSummaries: () => Promise<void>; // Function to fetch summaries
  
  // Agent CRUD operations
  fetchAgentById: (agentId: string) => Promise<Agent | null>;
  createAgent: (agentData: Partial<Agent>) => Promise<Agent | null>;
  updateAgent: (agentId: string, agentData: Partial<Agent>) => Promise<Agent | null>;

  // New state and function for specific agent team details
  teamDetails: AgentTeamDetails | null;
  teamDetailsLoading: boolean;
  teamDetailsError: PostgrestError | null;
  fetchAgentTeamDetails: (agentId: string) => Promise<void>;
}

export function useAgents(): UseAgentsReturn {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);
  
  // Add state for agent summaries
  const [agentSummaries, setAgentSummaries] = useState<AgentSummary[]>([]);
  const [agentSummariesLoading, setAgentSummariesLoading] = useState<boolean>(false);
  const [agentSummariesError, setAgentSummariesError] = useState<PostgrestError | null>(null);
  
  // New state for team details
  const [teamDetails, setTeamDetails] = useState<AgentTeamDetails | null>(null);
  const [teamDetailsLoading, setTeamDetailsLoading] = useState<boolean>(false);
  const [teamDetailsError, setTeamDetailsError] = useState<PostgrestError | null>(null);

  // --- CRUD Functions --- 

  const fetchAgentById = useCallback(async (agentId: string): Promise<Agent | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*') // Select all fields
        .eq('id', agentId)
        .maybeSingle(); // Expect 0 or 1 result

      if (fetchError) throw fetchError;
      return data || null;
    } catch (err) {
      console.error(`Error fetching agent by ID ${agentId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []); // No user dependency, RLS should handle auth

  const createAgent = useCallback(async (agentData: Partial<Agent>): Promise<Agent | null> => {
     if (!user) {
      console.error('Cannot create agent: User not logged in.');
      setError(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      // Ensure user_id is set
      const dataToInsert = { ...agentData, user_id: user.id };
      const { data, error: insertError } = await supabase
        .from('agents')
        .insert(dataToInsert as any)
        .select('*')
        .single(); // Return the created record

      if (insertError) throw insertError;

      // Create default LLM preferences for the new agent
      if (data) {
        const { error: llmPrefsError } = await supabase
          .from('agent_llm_preferences')
          .insert({
            agent_id: data.id,
            provider: 'openai',
            model: 'gpt-4o-mini',
            params: {},
            embedding_model: 'text-embedding-3-small'
          });

        if (llmPrefsError) {
          console.error('Error creating LLM preferences for agent:', data.id, llmPrefsError);
          // Don't throw error - agent is already created
        } else {
          console.log('LLM preferences created successfully for agent:', data.id);
        }
      }

      return data || null;
    } catch (err) {
      console.error('Error creating agent:', err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateAgent = useCallback(async (agentId: string, agentData: Partial<Agent>): Promise<Agent | null> => {
    if (!user || !user.id) {
      console.error('No authenticated user for updateAgent');
      setError({ message: 'User not authenticated', code: 'AUTH_ERROR' } as PostgrestError);
      return null;
    }
    
    if (!agentId || typeof agentId !== 'string') {
      console.error('Invalid agent ID provided');
      setError({ message: 'Invalid agent ID', code: 'INVALID_AGENT_ID' } as PostgrestError);
      return null;
    }

    setLoading(true);
    setError(null);
    
    // Exclude id from update payload if it exists on agentData
    const { id, ...rawUpdateData } = agentData; // Only destructure 'id'
    
    // Clean and validate update data
    const updateData: any = {};
    
    // Only include defined values to avoid null/undefined issues
    Object.keys(rawUpdateData).forEach(key => {
      const value = rawUpdateData[key as keyof typeof rawUpdateData];
      if (value !== undefined) {
        // Special handling for boolean fields
        if (key === 'active') {
          updateData[key] = Boolean(value);
        } else if (key === 'metadata') {
          // Ensure metadata is valid JSON
          updateData[key] = value && typeof value === 'object' ? value : {};
        } else if (typeof value === 'string' && value.trim() === '') {
          // Convert empty strings to null for optional text fields
          updateData[key] = null;
        } else {
          updateData[key] = value;
        }
      }
    });
    
    try {
      // Add updated_at timestamp
      updateData.updated_at = new Date().toISOString();
      
      const { data, error: updateError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', agentId)
        .eq('user_id', user.id) // Ensure we only update agents owned by current user
        .select('*')
        .single(); // Return the updated record

      if (updateError) throw updateError;
      
      // Update the local agents state as well
      if (data) {
        setAgents(prevAgents => 
          prevAgents.map(agent => 
            agent.id === agentId ? { ...agent, ...data } : agent
          )
        );
      }
      
      return data || null;
    } catch (err) {
      console.error(`Error updating agent ${agentId}:`, err);
      console.error('Update payload was:', JSON.stringify(updateData, null, 2));
      console.error('User ID:', user?.id);
      console.error('Agent ID:', agentId);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]); // Include user dependency for authentication check

  // --- Existing Functions --- 

  const fetchAllAgents = useCallback(async (): Promise<Agent[]> => {
    if (!user) {
      console.warn('fetchAllAgents called but user is not logged in.');
      setAgents([]);
      return [];
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*') // Select all fields
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      
      const fetchedAgents = data || [];
      setAgents(fetchedAgents); // Update state within the hook
      return fetchedAgents; // Return the fetched data
    } catch (err) {
      console.error('Error fetching all agents:', err);
      setError(err as PostgrestError);
      setAgents([]);
      return []; // Return empty array on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  // New function to fetch team details for a specific agent
  const fetchAgentTeamDetails = useCallback(async (agentId: string): Promise<void> => {
    if (!agentId) {
        console.warn('fetchAgentTeamDetails called without agentId.');
        setTeamDetails(null);
        setTeamDetailsError(null);
        return;
    }
    
    console.log(`Fetching team details for agent: ${agentId}`); // Log start
    setTeamDetailsLoading(true);
    setTeamDetailsError(null);
    setTeamDetails(null); // Clear previous details

    try {
      // Fetch team membership details including team name
      const { data, error: fetchError } = await supabase
        .from('team_members')
        .select(`
          team_id,
          team_role,
          reports_to_user,
          reports_to_agent_id,
          teams ( name ) 
        `)
        .eq('agent_id', agentId)
        .maybeSingle(); // Expect 0 or 1 result

      if (fetchError) throw fetchError;

      if (data) {
          console.log('Fetched team details:', data); // Log successful fetch
          // Transform the data slightly to match AgentTeamDetails interface
          const details: AgentTeamDetails = {
              team_id: data.team_id,
              team_name: (data.teams && typeof data.teams === 'object' && 'name' in data.teams) ? data.teams.name as string : null,
              team_role: data.team_role,
              reports_to_user: data.reports_to_user,
              reports_to_agent_id: data.reports_to_agent_id,
          };
          setTeamDetails(details);
      } else {
          console.log(`No team details found for agent: ${agentId}`); // Log if no details found
          setTeamDetails(null); // Agent might not be on a team
      }

    } catch (err) {
      console.error(`Error fetching team details for agent ${agentId}:`, err);
      setTeamDetailsError(err as PostgrestError);
      setTeamDetails(null);
    } finally {
      setTeamDetailsLoading(false);
      console.log(`Finished fetching team details for agent: ${agentId}`); // Log end
    }
  }, []); // No user dependency needed here, reads public/RLS-protected data

  // --- New Function for Agent Summaries ---
  const fetchAgentSummaries = useCallback(async (): Promise<void> => {
    if (!user) {
      console.warn('fetchAgentSummaries called but user is not logged in.');
      setAgentSummaries([]);
      return;
    }
    setAgentSummariesLoading(true);
    setAgentSummariesError(null);
    try {
      // Fetch only id and name for agents owned by the user
      // TODO: Consider fetching agents from teams the user is in?
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('id, name') 
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      
      setAgentSummaries(data || []); 
    } catch (err) {
      console.error('Error fetching agent summaries:', err);
      setAgentSummariesError(err as PostgrestError);
      setAgentSummaries([]);
    } finally {
      setAgentSummariesLoading(false);
    }
  }, [user]);

  // Optional: Fetch summaries automatically when the hook is mounted?
  // useEffect(() => {
  //   fetchAgentSummaries();
  // }, [fetchAgentSummaries]);

  return {
    agents, // Current state of agents fetched by this hook instance
    loading,
    error,
    fetchAllAgents,
    // Return agent summary state and function
    agentSummaries,
    agentSummariesLoading,
    agentSummariesError,
    fetchAgentSummaries, // Return the new fetch function
    // CRUD functions
    fetchAgentById,
    createAgent,
    updateAgent,
    // Team details
    teamDetails,
    teamDetailsLoading,
    teamDetailsError,
    fetchAgentTeamDetails,
  };
} 