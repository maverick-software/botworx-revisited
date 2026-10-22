import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface TeamWithAgentCount {
  id: string;
  name: string;
  description: string | null;
  agent_count: number;
  created_at: string;
  updated_at: string;
  owner_user_id: string | null;
}

interface UseTeamsWithAgentCountsReturn {
  teams: TeamWithAgentCount[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTeamsWithAgentCounts(): UseTeamsWithAgentCountsReturn {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamWithAgentCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamsWithAgentCounts = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First fetch all teams for the user (either owned or having agents)
      const { data: allTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .or(`owner_user_id.eq.${user.id}`)
        .order('name', { ascending: true });

      if (teamsError) throw teamsError;

      // Then get agent counts for each team
      const teamsWithCounts: TeamWithAgentCount[] = [];
      
      if (allTeams && allTeams.length > 0) {
        for (const team of allTeams) {
          // Get team members and then check which agents belong to the current user
          const { data: teamMembers, error: countError } = await supabase
            .from('team_members')
            .select('agent_id')
            .eq('team_id', team.id);

          if (countError) {
            console.warn(`Error counting agents for team ${team.name}:`, countError);
          }

          let userAgentCount = 0;
          if (teamMembers && teamMembers.length > 0) {
            // Get the agents that belong to the current user
            const agentIds = teamMembers.map(tm => tm.agent_id);
            const { data: userAgents, error: agentError } = await supabase
              .from('agents')
              .select('id')
              .in('id', agentIds)
              .eq('user_id', user.id);

            if (agentError) {
              console.warn(`Error checking user agents for team ${team.name}:`, agentError);
            } else {
              userAgentCount = userAgents?.length || 0;
            }
          }

          teamsWithCounts.push({
            ...team,
            agent_count: userAgentCount
          });
        }
      }

      // Sort by name
      teamsWithCounts.sort((a, b) => a.name.localeCompare(b.name));
      setTeams(teamsWithCounts);
    } catch (err) {
      console.error('Error fetching teams with agent counts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch teams');
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTeamsWithAgentCounts();
  }, [fetchTeamsWithAgentCounts]);

  return {
    teams,
    loading,
    error,
    refetch: fetchTeamsWithAgentCounts,
  };
}
