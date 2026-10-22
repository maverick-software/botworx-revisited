import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  Users, 
  Loader2, 
  ExternalLink,
  UserPlus,
  UserMinus,
  Calendar
} from 'lucide-react';

interface TeamTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

interface Team {
  id: string;
  name: string;
  description: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  team_id: string;
  agent_id: string;
  team_role: string;
  team_role_description: string;
  reports_to_agent_id: string | null;
  reports_to_user: boolean;
  joined_at: string;
  team?: Team;
}

interface TeamAssignment {
  team: Team;
  membership: TeamMember | null;
  canJoin: boolean;
  canLeave: boolean;
}

export function TeamTab({ agentId, agentData, onAgentUpdated }: TeamTabProps) {
  const [teams, setTeams] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = useSupabaseClient();
  const { user } = useAuth();

  useEffect(() => {
    loadTeamsAndAssignments();
  }, [agentId, user]);

  const loadTeamsAndAssignments = async () => {
    if (!user || !agentId) return;

    setLoading(true);
    try {
      // Load all teams owned by the user
      const { data: userTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('name');

      if (teamsError) throw teamsError;

      // Load current team memberships for this agent
      const { data: memberships, error: membershipsError } = await supabase
        .from('team_members')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('agent_id', agentId);

      if (membershipsError) throw membershipsError;

      // Create team assignments with membership status
      const teamAssignments: TeamAssignment[] = (userTeams || []).map(team => {
        const membership = memberships?.find(m => m.team_id === team.id) || null;
        return {
          team,
          membership,
          canJoin: !membership,
          canLeave: !!membership
        };
      });

      setTeams(teamAssignments);
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!user || !agentId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          agent_id: agentId,
          team_role: 'Member',
          reports_to_user: true,
          joined_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Agent successfully added to team');
      
      // Reload teams
      await loadTeamsAndAssignments();
    } catch (error) {
      console.error('Error joining team:', error);
      toast.error('Failed to add agent to team');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveTeam = async (teamId: string) => {
    if (!user || !agentId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('agent_id', agentId);

      if (error) throw error;

      toast.success('Agent removed from team');
      await loadTeamsAndAssignments();
    } catch (error) {
      console.error('Error leaving team:', error);
      toast.error('Failed to remove agent from team');
    } finally {
      setSaving(false);
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Team Assignments</h3>
          <p className="text-sm text-muted-foreground">
            Manage which teams this agent belongs to.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open('/teams', '_blank')}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Manage Teams
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="font-medium mb-2">No Teams Available</h4>
            <p className="text-sm text-muted-foreground mb-4">
              You haven't created any teams yet. Create teams to organize your agents.
            </p>
            <Button variant="outline" onClick={() => window.open('/teams', '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Create Teams
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {teams.map(({ team, membership, canJoin, canLeave }) => (
            <Card key={team.id} className={membership ? 'border-primary/20 bg-primary/5' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {team.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {team.description || 'No description provided'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {membership ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {formatDate(membership.joined_at)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/teams/${team.id}`, '_blank')}
                          className="h-7 px-2 text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLeaveTeam(team.id)}
                          disabled={saving}
                          className="text-destructive hover:text-destructive h-7 px-2"
                        >
                          {saving ? (
                            <Loader2 className="w-3 h-3" />
                          ) : (
                            <UserMinus className="w-3 h-3" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleJoinTeam(team.id)}
                        disabled={saving}
                        size="sm"
                        className="h-7 px-3"
                      >
                        {saving ? (
                          <Loader2 className="w-3 h-3 mr-1" />
                        ) : (
                          <UserPlus className="w-3 h-3 mr-1" />
                        )}
                        Add
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
