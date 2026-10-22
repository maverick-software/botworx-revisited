import { useState, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Team, TeamMember } from '@/types';
import type { UseTeamOperationsOptions } from '../types/canvas';
import { PostgrestError } from '@supabase/supabase-js';

// Define the team creation request interface
interface CreateTeamRequest {
  name: string;
  description?: string;
  workspaceId?: string;
}

// Database operations
async function fetchTeams(supabase: any, workspaceId: string): Promise<Team[]> {
  const { user } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchTeamMembers(supabase: any, workspaceId: string): Promise<Map<string, TeamMember[]>> {
  const { user } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('team_members')
    .select(`
      *,
      teams!inner (
        owner_user_id
      )
    `)
    .eq('teams.owner_user_id', user.id);

  if (error) throw error;

  // Group members by team_id
  const membersMap = new Map<string, TeamMember[]>();
  data?.forEach((member: any) => {
    if (!membersMap.has(member.team_id)) {
      membersMap.set(member.team_id, []);
    }
    membersMap.get(member.team_id)!.push({
      id: member.id,
      team_id: member.team_id,
      agent_id: member.agent_id,
      team_role: member.team_role,
      reports_to_user: member.reports_to_user,
      created_at: member.created_at
    });
  });

  return membersMap;
}

async function createTeam(supabase: any, teamData: CreateTeamRequest): Promise<Team> {
  const { user } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('teams')
    .insert({
      name: teamData.name,
      description: teamData.description || null,
      owner_user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateTeam(supabase: any, teamId: string, updates: Partial<Team>): Promise<Team> {
  const { user } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('teams')
    .update({
      name: updates.name,
      description: updates.description,
      updated_at: new Date().toISOString()
    })
    .eq('id', teamId)
    .eq('owner_user_id', user.id) // Ensure user owns the team
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteTeam(supabase: any, teamId: string): Promise<void> {
  const { user } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('owner_user_id', user.id); // Ensure user owns the team

  if (error) throw error;
}

export function useTeamOperations(
  workspaceId: string,
  options: UseTeamOperationsOptions = {}
) {
  const {
    onTeamCreated,
    onTeamUpdated,
    onTeamDeleted,
    onError
  } = options;

  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // State management following existing patterns
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<Map<string, TeamMember[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch teams function
  const fetchTeamsData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchTeams(supabase, workspaceId);
      setTeams(result);
    } catch (err) {
      const error = err as Error;
      setError(err as PostgrestError);
      if (onError) onError(error, 'fetch');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, workspaceId, onError]);

  // Fetch team members function
  const fetchMembers = useCallback(async () => {
    if (!user) return;
    
    try {
      const result = await fetchTeamMembers(supabase, workspaceId);
      setTeamMembers(result);
    } catch (err) {
      const error = err as Error;
      console.error('Error fetching team members:', error);
      if (onError) onError(error, 'fetch_members');
    }
  }, [supabase, workspaceId, user, onError]);

  // Create team function
  const createTeamFn = useCallback(async (teamData: CreateTeamRequest): Promise<Team | null> => {
    setIsCreating(true);
    try {
      const newTeam = await createTeam(supabase, teamData);
      
      // Update local state
      setTeams(prev => [newTeam, ...prev]);
      
      if (onTeamCreated) onTeamCreated(newTeam);
      return newTeam;
    } catch (err) {
      const error = err as Error;
      if (onError) onError(error, 'create');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [supabase, onTeamCreated, onError]);

  // Update team function
  const updateTeamFn = useCallback(async (teamId: string, updates: Partial<Team>): Promise<Team | null> => {
    setIsUpdating(true);
    try {
      const updatedTeam = await updateTeam(supabase, teamId, updates);
      
      // Update local state
      setTeams(prev => prev.map(team => 
        team.id === teamId ? updatedTeam : team
      ));
      
      if (onTeamUpdated) onTeamUpdated(updatedTeam);
      return updatedTeam;
    } catch (err) {
      const error = err as Error;
      if (onError) onError(error, 'update');
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [supabase, onTeamUpdated, onError]);

  // Delete team function
  const deleteTeamFn = useCallback(async (teamId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      await deleteTeam(supabase, teamId);
      
      // Update local state
      setTeams(prev => prev.filter(team => team.id !== teamId));
      
      if (onTeamDeleted) onTeamDeleted(teamId);
      return true;
    } catch (err) {
      const error = err as Error;
      if (onError) onError(error, 'delete');
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [supabase, onTeamDeleted, onError]);

  // Refresh function
  const refreshTeams = useCallback(async () => {
    await Promise.all([fetchTeamsData(), fetchMembers()]);
  }, [fetchTeamsData, fetchMembers]);

  return {
    // Data
    teams,
    teamMembers,
    isLoading,
    error,
    
    // Operations
    createTeam: createTeamFn,
    updateTeam: updateTeamFn,
    deleteTeam: deleteTeamFn,
    fetchTeams: fetchTeamsData,
    fetchMembers,
    refreshTeams,
    
    // Loading states
    isCreating,
    isUpdating,
    isDeleting,
    
    // Utilities
    getTeamMembers: useCallback((teamId: string) => teamMembers.get(teamId) || [], [teamMembers]),
    findTeamById: useCallback((teamId: string) => teams.find(t => t.id === teamId), [teams])
  };
}
