import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Team } from '../types'; // Import the Team type
import { PostgrestError } from '@supabase/supabase-js';

interface UseTeamsReturn {
  teams: Team[];
  loading: boolean;
  error: PostgrestError | null;
  fetchTeams: () => Promise<void>;
  fetchTeamById: (teamId: string) => Promise<Team | null>;
  createTeam: (name: string, description?: string, parentTeamId?: string) => Promise<Team | null>;
  updateTeam: (teamId: string, updates: Partial<Omit<Team, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>) => Promise<Team | null>;
  deleteTeam: (teamId: string) => Promise<boolean>;
}

export function useTeams(): UseTeamsReturn {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  // Fetch all teams the user has access to (based on RLS)
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError(err as PostgrestError);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch a single team by ID
  const fetchTeamById = useCallback(async (teamId: string): Promise<Team | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (fetchError) {
        // Handle case where team is not found vs other errors
        if (fetchError.code === 'PGRST116') { // Not found code
            console.log(`Team with ID ${teamId} not found.`);
            return null; 
        } else {
            throw fetchError;
        }
      }
      return data;
    } catch (err) {
      console.error(`Error fetching team by ID ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new team
  const createTeam = useCallback(async (name: string, description?: string, parentTeamId?: string): Promise<Team | null> => {
    setLoading(true);
    setError(null);
    try {
      // RLS/Trigger handles setting owner_user_id
      const { data, error: insertError } = await supabase
        .from('teams')
        .insert([{ name, description, parent_team_id: parentTeamId || null }])
        .select()
        .single();

      if (insertError) throw insertError;
      // Optionally update local state immediately
      // setTeams(currentTeams => [...currentTeams, data]);
      return data;
    } catch (err) {
      console.error('Error creating team:', err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update an existing team
  const updateTeam = useCallback(async (teamId: string, updates: Partial<Omit<Team, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>): Promise<Team | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single();

      if (updateError) throw updateError;
      // Optionally update local state
      // setTeams(currentTeams => currentTeams.map(t => t.id === teamId ? data : t));
      return data;
    } catch (err) {
      console.error(`Error updating team ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a team
  const deleteTeam = useCallback(async (teamId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) throw deleteError;
      // Optionally update local state
      // setTeams(currentTeams => currentTeams.filter(t => t.id !== teamId));
      return true;
    } catch (err) {
      console.error(`Error deleting team ${teamId}:`, err);
      setError(err as PostgrestError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    teams,
    loading,
    error,
    fetchTeams,
    fetchTeamById,
    createTeam,
    updateTeam,
    deleteTeam,
  };
} 