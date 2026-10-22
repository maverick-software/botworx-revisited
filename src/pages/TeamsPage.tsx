import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, AlertCircle, Building2, UserCheck, Target, Workflow, ChevronRight, ChevronDown } from 'lucide-react';
import { useTeams } from '../hooks/useTeams';
import { useAuth } from '../contexts/AuthContext';
import TeamCard from '../components/teams/TeamCard'; // Import the actual component
import { CreateTeamModal } from '../components/modals/CreateTeamModal';
import { MobileHeader } from '../components/mobile/MobileHeader';
import { ResponsiveGrid } from '../components/mobile/ResponsiveGrid';
import { useIsMobile } from '../hooks/useMediaQuery';
import { getPagePadding } from '../lib/pwaTheme';
import type { Team, TeamWithHierarchy } from '../types';

// Note: Canvas view removed - December 31, 2025
// Placeholder for TeamCard until it's created
const TeamCardPlaceholder: React.FC<{ team: Team }> = ({ team }) => (
  <div className="bg-card border border-border p-4 rounded-lg shadow animate-pulse">
    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
    <div className="h-4 bg-muted rounded w-full"></div>
  </div>
);

// Hierarchical Team Display Component
const HierarchicalTeamDisplay: React.FC<{
  team: TeamWithHierarchy;
  level: number;
  isExpanded: boolean;
  onToggle: (teamId: string) => void;
  expandedTeams: Set<string>;
  isLast?: boolean;
}> = ({ team, level, isExpanded, onToggle, expandedTeams, isLast = false }) => {
  const hasChildren = team.child_teams && team.child_teams.length > 0;
  const navigate = useNavigate();

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 ${level > 0 ? 'ml-6' : ''}`}>
        {/* Tree lines for hierarchy visualization */}
        {level > 0 && (
          <div className="absolute left-0 top-0 h-full w-6">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute top-0 bottom-0 left-3 w-px bg-border/50" />
            )}
            {/* Horizontal line */}
            <div className="absolute top-1/2 left-3 w-3 h-px bg-border/50" />
          </div>
        )}

        {/* Expand/Collapse button */}
        {hasChildren ? (
          <button
            onClick={() => onToggle(team.id)}
            className="flex-shrink-0 w-5 h-5 rounded hover:bg-accent flex items-center justify-center transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0" />
        )}
        
        {/* Compact Team Row */}
        <div 
          onClick={() => navigate(`/teams/${team.id}`)}
          className={`flex-1 flex items-center gap-3 py-2.5 px-4 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors group ${
            level > 0 ? 'border-l-2 border-l-primary/30' : ''
          }`}
        >
          <Building2 className={`w-4 h-4 flex-shrink-0 ${level === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">{team.name}</h3>
            {team.description && (
              <p className="text-xs text-muted-foreground truncate">{team.description}</p>
            )}
          </div>
          
          {hasChildren && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {team.child_teams!.length} sub-team{team.child_teams!.length !== 1 ? 's' : ''}
            </span>
          )}
          
          {level > 0 && (
            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              Level {level}
            </span>
          )}
        </div>
      </div>

      {/* Child teams */}
      {hasChildren && isExpanded && (
        <div className="mt-1">
          {team.child_teams!.map((childTeam, index) => (
            <HierarchicalTeamDisplay
              key={childTeam.id}
              team={childTeam}
              level={level + 1}
              isExpanded={expandedTeams.has(childTeam.id)}
              onToggle={onToggle}
              expandedTeams={expandedTeams}
              isLast={index === team.child_teams!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Assuming named export based on other pages
export const TeamsPage: React.FC = () => {
  const { teams, loading, error, fetchTeams } = useTeams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Build hierarchical team structure
  const hierarchicalTeams = useMemo(() => {
    const teamMap = new Map<string, TeamWithHierarchy>();
    const rootTeams: TeamWithHierarchy[] = [];

    // First pass: create map of all teams
    teams.forEach(team => {
      teamMap.set(team.id, { ...team, child_teams: [] });
    });

    // Second pass: build parent-child relationships
    teams.forEach(team => {
      const teamWithHierarchy = teamMap.get(team.id)!;
      if (team.parent_team_id) {
        const parent = teamMap.get(team.parent_team_id);
        if (parent) {
          parent.child_teams = parent.child_teams || [];
          parent.child_teams.push(teamWithHierarchy);
          teamWithHierarchy.parent_team = teams.find(t => t.id === team.parent_team_id);
        } else {
          // Parent not found, treat as root
          rootTeams.push(teamWithHierarchy);
        }
      } else {
        // Root team
        rootTeams.push(teamWithHierarchy);
      }
    });

    return rootTeams;
  }, [teams]);

  const toggleTeamExpansion = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  const handleTeamCreated = (teamId: string) => {
    // Refresh teams list
    fetchTeams();
    // Navigate to the new team's detail page
    navigate(`/teams/${teamId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          title="Teams"
          showMenu={true}
          actions={
            <button
              onClick={() => setShowCreateModal(true)}
              className="touch-target p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label="Create team"
            >
              <Plus className="w-5 h-5" />
            </button>
          }
        />
      )}

      <div className={getPagePadding(isMobile)}>
        {/* Desktop Header */}
        {!isMobile && (
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Create New Team
            </button>
          </div>
        )}

      {/* Teams Information Section - Hidden on Mobile */}
      {!isMobile && (
        <div className="bg-card/50 border border-border/50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Organize your agents into teams that mirror your company structure
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md mb-6 flex items-center">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <span>Error loading teams: {error.message || 'Unknown error'}</span>
        </div>
      )}

      {loading && !error && (
        <ResponsiveGrid type="teams" gap="md">
          {[...Array(3)].map((_, i) => (
             <div key={i} className="bg-card border border-border p-4 rounded-lg shadow animate-pulse">
                <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
             </div>
          ))}
        </ResponsiveGrid>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="text-center py-12 px-4 border-2 border-dashed border-border rounded-lg">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-lg font-medium text-foreground">Ready to organize your agents?</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Create your first team to mirror your company's structure. Whether it's HR, Marketing, Engineering, 
              or project-based groups, teams help organize agents just like your organization.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Create Your First Team
              </button>
            </div>
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="space-y-1">
          {hierarchicalTeams.map((team) => (
            <HierarchicalTeamDisplay
              key={team.id}
              team={team}
              level={0}
              isExpanded={expandedTeams.has(team.id)}
              onToggle={toggleTeamExpansion}
              expandedTeams={expandedTeams}
            />
          ))}
        </div>
      )}
      </div>

      <CreateTeamModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTeamCreated={handleTeamCreated}
      />
    </div>
  );
}; 