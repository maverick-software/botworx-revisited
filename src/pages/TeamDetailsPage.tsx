import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTeams } from '../hooks/useTeams';
import { ArrowLeft, Edit, Loader2, AlertCircle, Users, MessageSquare } from 'lucide-react';
import type { Team } from '../types';
import { TeamMemberList } from '../components/teams/TeamMemberList';

export const TeamDetailsPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { fetchTeamById, loading, error } = useTeams();
  const [team, setTeam] = useState<Team | null>(null);
  const [parentTeam, setParentTeam] = useState<Team | null>(null);

  useEffect(() => {
    if (teamId) {
      console.log(`[TeamDetailsPage] Fetching team details for ID: ${teamId}`);
      fetchTeamById(teamId).then(fetchedTeam => {
        if (fetchedTeam) {
            console.log('[TeamDetailsPage] Fetched team:', fetchedTeam);
            console.log('[TeamDetailsPage] parent_team_id:', fetchedTeam.parent_team_id);
            setTeam(fetchedTeam);
            // Fetch parent team if it exists
            if (fetchedTeam.parent_team_id) {
              console.log('[TeamDetailsPage] Fetching parent team:', fetchedTeam.parent_team_id);
              fetchTeamById(fetchedTeam.parent_team_id).then(parent => {
                console.log('[TeamDetailsPage] Parent team:', parent);
                setParentTeam(parent);
              });
            } else {
              console.log('[TeamDetailsPage] No parent team for this team');
              setParentTeam(null);
            }
        } else {
            // Handle case where team is not found or error occurred during fetch
            // The useTeams hook should set the error state, which is displayed below
            console.log(`[TeamDetailsPage] Team not found or error fetching team ${teamId}`);
            setTeam(null); // Ensure team state is null if fetch fails
        }
      });
    } else {
        console.error("[TeamDetailsPage] teamId is missing from URL parameters.");
        // Optionally navigate away or show a specific error message
        navigate('/teams'); // Redirect back to teams list if ID is missing
    }
    // Depend on teamId, fetchTeamById
  }, [teamId, fetchTeamById, navigate]);

  if (loading && !team) {
    return (
      <div className="p-8 flex justify-center items-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>Error loading team details: {error.message || 'Unknown error'}.</span>
           <Link to="/teams" className="ml-auto text-sm font-medium text-red-300 hover:text-red-100">Back to Teams</Link>
        </div>
      </div>
    );
  }

  if (!team) {
     // This state might be reached if fetchTeamById returns null without setting an error in the hook
    return (
        <div className="p-6 text-center text-muted-foreground">
            Team not found or could not be loaded.
             <Link to="/teams" className="block mt-4 text-primary hover:text-primary/80">Back to Teams</Link>
        </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link 
            to="/teams"
            className="mr-4 p-2 rounded-full hover:bg-accent transition-colors"
            title="Back to Teams List"
        >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-foreground truncate" title={team.name}>
                {team.name}
            </h1>
        </div>
        <Link
          to={`/teams/${team.id}/edit`}
          className="ml-4 inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md shadow-sm text-foreground bg-card hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
        >
          <Edit className="-ml-1 mr-2 h-4 w-4" aria-hidden="true" />
          Edit Team
        </Link>
      </div>

      {/* Team Overview Section */}
      <div className="mb-8">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Team Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
              <div className="bg-muted/50 rounded-md p-3 min-h-[80px]">
                {team.description ? (
                  <p className="text-foreground whitespace-pre-wrap">{team.description}</p>
                ) : (
                  <p className="text-muted-foreground italic">No description provided for this team.</p>
                )}
              </div>
            </div>

            {/* Team Stats */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Team Information</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span className="text-sm text-muted-foreground">Parent Team</span>
                  {team.parent_team_id ? (
                    parentTeam ? (
                      <Link 
                        to={`/teams/${parentTeam.id}`}
                        className="text-sm text-primary hover:text-primary/80 hover:underline font-medium"
                      >
                        {parentTeam.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground">Loading...</span>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground italic">None (Root Team)</span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span className="text-sm text-muted-foreground">Team ID</span>
                  <span className="text-sm font-mono text-foreground">{team.id}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm text-foreground">
                    {team.created_at ? new Date(team.created_at).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members Section */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <TeamMemberList teamId={team.id} />
      </div>
      
    </div>
  );
}; 