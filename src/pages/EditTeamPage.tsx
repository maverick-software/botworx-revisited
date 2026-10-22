import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Save } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import { Team } from '../types';

export const EditTeamPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { fetchTeamById, updateTeam, fetchTeams, teams, loading, error } = useTeams();

  const [team, setTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [parentTeamId, setParentTeamId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId) {
        setFetchError('No team ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setFetchError(null);
        const fetchedTeam = await fetchTeamById(teamId);
        
        if (fetchedTeam) {
          setTeam(fetchedTeam);
          setTeamName(fetchedTeam.name || '');
          setDescription(fetchedTeam.description || '');
          setParentTeamId(fetchedTeam.parent_team_id || '');
        } else {
          setFetchError('Team not found');
        }
      } catch (err) {
        console.error('Error loading team:', err);
        setFetchError('Failed to load team');
      } finally {
        setIsLoading(false);
      }
    };

    loadTeam();
    fetchTeams(); // Load all teams for parent selector
  }, [teamId, fetchTeamById, fetchTeams]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamId || !teamName.trim()) return;

    try {
      setIsSaving(true);
      const updatedTeam = await updateTeam(teamId, {
        name: teamName.trim(),
        description: description.trim() || null,
        parent_team_id: parentTeamId || null,
      });

      if (updatedTeam) {
        navigate(`/teams/${teamId}`);
      }
    } catch (err) {
      console.error('Error saving team:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out current team and its descendants to prevent circular references
  const availableParentTeams = teams.filter(t => 
    t.id !== teamId && // Can't be parent of itself
    t.parent_team_id !== teamId // Can't select a child as parent
  );

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-md flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>{fetchError}</span>
          <Link to="/teams" className="ml-auto text-sm font-medium hover:underline">
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Team not found.
        <Link to="/teams" className="block mt-4 text-primary hover:text-primary/80">
          Back to Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center mb-8">
        <Link
          to={`/teams/${teamId}`}
          className="mr-4 p-2 rounded-full hover:bg-accent transition-colors"
          title="Back to Team Details"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">Edit Team</h1>
          <p className="text-muted-foreground mt-1">Update your team's information</p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-destructive/10 border border-destructive text-destructive p-4 rounded-md flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>Error updating team: {error.message || 'Unknown error'}</span>
        </div>
      )}

      {/* Form */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="teamName" className="text-sm font-medium text-foreground">
              Team Name *
            </label>
            <input
              type="text"
              name="teamName"
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter team name"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describe the team's purpose and goals"
            />
            <p className="text-sm text-muted-foreground">
              Provide a brief description to help team members understand the team's purpose.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="parentTeam" className="text-sm font-medium text-foreground">
              Parent Team (Optional)
            </label>
            <select
              id="parentTeam"
              name="parentTeam"
              value={parentTeamId}
              onChange={(e) => setParentTeamId(e.target.value)}
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">None (Root Team)</option>
              {availableParentTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">
              Place this team under another team in your organizational hierarchy.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Link
              to={`/teams/${teamId}`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving || !teamName.trim()}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 