import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, RefreshCw, Search, ArrowUpRight, Building2, ChevronDown, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConnected } from '../lib/supabase';
import type { Agent } from '../types';
import { CreateAgentWizard } from '../components/CreateAgentWizard';
import { useTeamsWithAgentCounts } from '../hooks/useTeamsWithAgentCounts';
import { CreateTeamModal } from '../components/modals/CreateTeamModal';
import { useMediaLibraryUrl } from '../hooks/useMediaLibraryUrl';
import { MobileHeader } from '../components/mobile/MobileHeader';
import { useIsMobile } from '../hooks/useMediaQuery';

export function AgentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const totalFetchAttempts = useRef(0);
  const MAX_TOTAL_FETCH_ATTEMPTS = 5;
  const isMobile = useIsMobile();

  // Fetch teams with agent counts
  const { teams, loading: teamsLoading, refetch: refetchTeams } = useTeamsWithAgentCounts();

  // Build hierarchical team structure
  const hierarchicalTeams = useMemo(() => {
    const teamMap = new Map();
    const rootTeams: any[] = [];

    // First pass: create map of all teams
    teams.forEach(team => {
      teamMap.set(team.id, { ...team, children: [] });
    });

    // Second pass: build parent-child relationships
    teams.forEach(team => {
      const teamWithHierarchy = teamMap.get(team.id);
      if (team.parent_team_id) {
        const parent = teamMap.get(team.parent_team_id);
        if (parent) {
          parent.children.push(teamWithHierarchy);
        } else {
          rootTeams.push(teamWithHierarchy);
        }
      } else {
        rootTeams.push(teamWithHierarchy);
      }
    });

    // Flatten for dropdown display with level information
    const flattenTeams = (teams: any[], level = 0): any[] => {
      return teams.reduce((acc, team) => {
        acc.push({ ...team, level });
        if (team.children && team.children.length > 0) {
          acc.push(...flattenTeams(team.children, level + 1));
        }
        return acc;
      }, []);
    };

    return flattenTeams(rootTeams);
  }, [teams]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showTeamDropdown) {
        setShowTeamDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTeamDropdown]);

  const fetchAgents = useCallback(async (isInitialCall = true) => {
    if (!user) return;

    let currentAttempt = totalFetchAttempts.current + 1;
    if (isInitialCall) {
      currentAttempt = 1;
      totalFetchAttempts.current = 0;
    }
    totalFetchAttempts.current = currentAttempt;

    if (currentAttempt > MAX_TOTAL_FETCH_ATTEMPTS) {
      console.warn(`Max fetch attempts (${MAX_TOTAL_FETCH_ATTEMPTS}) reached for agents. Aborting.`);
      setError(`Failed to load agents after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts.`);
      setLoading(false);
      setIsRetrying(false);
      return;
    }
    console.log(`Fetching agents... Attempt ${currentAttempt}`);
    console.log(`DEBUG: User ID: ${user.id}`);

    try {
      setError(null);
      setLoading(true);
      setIsRetrying(true);

      const isConnected = await isSupabaseConnected();
      if (!isConnected) throw new Error('Unable to connect to the database.');
      console.log('DEBUG: Supabase connection successful');

      // First, fetch all agents for the user
      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Then, fetch team memberships for these agents
      if (data && data.length > 0) {
        const agentIds = data.map(agent => agent.id);
        const { data: teamMemberships, error: membershipError } = await supabase
          .from('team_members')
          .select(`
            agent_id,
            team_id,
            teams(
              id,
              name
            )
          `)
          .in('agent_id', agentIds);

        if (membershipError) {
          console.warn('Error fetching team memberships:', membershipError);
        }

        // Attach team membership data to agents
        const agentsWithTeams = data.map(agent => ({
          ...agent,
          team_members: teamMemberships?.filter(tm => tm.agent_id === agent.id) || []
        }));

        console.log('DEBUG: Setting agents with team data');
        setAgents(agentsWithTeams);
      } else {
        setAgents(data || []);
      }

      console.log('DEBUG: Supabase query result:', { data, error: fetchError });
      console.log('DEBUG: Number of agents found:', data?.length || 0);

      setLoading(false);
      setIsRetrying(false);
      if (isInitialCall) totalFetchAttempts.current = 0;
      console.log('DEBUG: Loading state set to false');

    } catch (err: any) {
      console.error('Error fetching agents:', err);
      if (currentAttempt < MAX_TOTAL_FETCH_ATTEMPTS) {
        const delay = 2000;
        console.log(`Agent fetch failed, retrying in ${delay}ms (Attempt ${currentAttempt + 1})`);
        setTimeout(() => fetchAgents(false), delay);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agents. Retrying... (${currentAttempt}/${MAX_TOTAL_FETCH_ATTEMPTS}): ${message}`);
      } else {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load agents after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts: ${message}`);
        console.error('Max fetch attempts reached for agents after error.');
        setLoading(false);
        setIsRetrying(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      totalFetchAttempts.current = 0;
      fetchAgents(true);
    } else {
      setAgents([]);
      setLoading(false);
      setError(null);
      setIsRetrying(false);
    }
  }, [user, fetchAgents]);

  // Debug effect to monitor loading state
  useEffect(() => {
    console.log('DEBUG: Loading state changed to:', loading);
  }, [loading]);

  // Force loading to false if we have agents but loading is still true
  useEffect(() => {
    if (agents.length > 0 && loading) {
      console.log('DEBUG: Forcing loading to false - we have agents but loading is still true');
      setLoading(false);
    }
  }, [agents.length, loading]);

  // Debug useEffect to monitor loading state changes
  useEffect(() => {
    console.log('DEBUG: Loading state changed to:', loading);
  }, [loading]);

  const toggleAgentStatus = useCallback(async (id: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('agents')
        .update({ active: !currentStatus })
        .eq('id', id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      setAgents(prev => prev.map(agent =>
        agent.id === id ? { ...agent, active: !currentStatus } : agent
      ));
      setError(null);
    } catch (err) {
      console.error('Error updating agent status:', err);
      setError('Failed to update agent status. Please try again.');
    }
  }, [user?.id]);

  const handleDeleteAgent = useCallback(async (id: string) => {
    if (!id || isDeleting) return;
    
    try {
      setIsDeleting(true);
      
      const { error: deleteError } = await supabase
        .from('agents')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (deleteError) throw deleteError;

      setAgents(prev => prev.filter(agent => agent.id !== id));
      setShowDeleteConfirm(null);
      setError(null);
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError('Failed to delete agent. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [user?.id, isDeleting]);

  // Filtering logic
  const filteredAgents = useMemo(() => {
    // First, exclude system agents (like Gofr)
    let filtered = agents.filter(agent => !agent.metadata?.is_system_agent);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(agent => 
        agent.name.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query)
      );
    }

    // Apply team filter
    if (selectedTeam !== 'all') {
      filtered = filtered.filter(agent => {
        // Check if agent is a member of the selected team
        const agentTeams = (agent as any).team_members || [];
        return agentTeams.some((membership: any) => membership.team_id === selectedTeam);
      });
    }

    return filtered;
  }, [agents, searchQuery, selectedTeam]);

  // Agent avatar component that resolves media library URLs
  const AgentAvatar = ({ agent }: { agent: Agent }) => {
    const resolvedAvatarUrl = useMediaLibraryUrl(agent.avatar_url);
    
    return (
      <>
        {resolvedAvatarUrl ? (
          <img 
            src={resolvedAvatarUrl} 
            alt={`${agent.name} avatar`}
            className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300">
            <span className="text-primary text-lg font-semibold">
              {agent.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </>
    );
  };

  // Agent card component - sized for 5 across
  const AgentCard = ({ agent }: { agent: Agent }) => (
    <div 
      onClick={() => navigate(`/agents/${agent.id}/chat`)}
      className="group bg-card/50 rounded-xl border border-border/50 hover:bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 cursor-pointer relative p-4"
    >
      {/* Link indicator */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
      </div>
      
      <div className="flex flex-col items-center text-center space-y-3">
        {/* Avatar */}
        <AgentAvatar agent={agent} />
        
        {/* Name */}
        <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
          {agent.name}
        </h3>
      </div>
    </div>
  );

  const renderedAgents = useMemo(() => {
    if (!filteredAgents.length) {
      return null;
    }

    return filteredAgents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} />
    ));
  }, [filteredAgents, navigate]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please sign in to view your agents.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          agentName="My Agents"
          agentCount={filteredAgents.length}
          showMenu={true}
          onAgentClick={() => {
            // Could open agent selector modal here
            console.log('Agent selector clicked');
          }}
          actions={
            <button
              onClick={() => setShowCreateModal(true)}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Create agent"
            >
              <Plus className="w-5 h-5" />
            </button>
          }
        />
      )}

      {/* Desktop Header Section */}
      {!isMobile && (
        <div className="border-b border-border/50 bg-background/95 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {/* Title and Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-8">
                <h1 className="text-2xl font-bold text-foreground mb-2">Meet Your AI Team</h1>
                <p className="text-muted-foreground">Manage and organize your AI agents by teams</p>
              </div>
              
              <div className="flex items-center space-x-3 flex-shrink-0">
                {/* Team Filter Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTeamDropdown(!showTeamDropdown);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-primary/50 rounded-lg text-sm font-medium text-foreground transition-all duration-200 min-w-[180px]"
                  >
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 text-left truncate">
                      {selectedTeam === 'all' ? 'All Teams' : teams.find(t => t.id === selectedTeam)?.name || 'Select Team'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showTeamDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showTeamDropdown && (
                    <div 
                      className="absolute top-full mt-2 right-0 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[280px] max-h-[400px] overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* All Teams Option */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedTeam('all');
                          setShowTeamDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                          selectedTeam === 'all'
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        <span>All Teams</span>
                        {selectedTeam === 'all' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                      
                      <div className="border-t border-border my-1" />
                      
                      {/* Hierarchical Team Options */}
                      {hierarchicalTeams.map((team, index) => {
                        const hasChildren = team.children && team.children.length > 0;
                        const isLast = index === hierarchicalTeams.length - 1 || 
                                      (hierarchicalTeams[index + 1]?.level || 0) <= team.level;
                        
                        return (
                          <button
                            key={team.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedTeam(team.id);
                              setShowTeamDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                              selectedTeam === team.id
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-foreground hover:bg-accent'
                            }`}
                            style={{ 
                              paddingLeft: `${1 + team.level * 1.5}rem`
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0 relative">
                              {/* Tree line indicators */}
                              {team.level > 0 && (
                                <div className="absolute left-0 top-0 h-full flex items-center" style={{ left: `${-0.75 * team.level}rem` }}>
                                  {/* Horizontal line */}
                                  <div className="w-3 h-px bg-border/50" />
                                </div>
                              )}
                              
                              <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${
                                team.level === 0 ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                              <span className="truncate">{team.name}</span>
                              {team.level > 0 && (
                                <span className="text-xs text-muted-foreground">└</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              <span className="text-xs text-muted-foreground">
                                {team.agent_count}
                              </span>
                              {selectedTeam === team.id && (
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-4 py-4' : 'px-6 py-6'}`}>
        
        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-4 rounded-xl mb-8 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchAgents(true)}
              disabled={isRetrying || loading}
              className="flex items-center px-4 py-2 bg-destructive/20 hover:bg-destructive/30 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </button>
          </div>
        )}


        {/* All Agents Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="bg-card border border-border rounded-xl p-4 animate-pulse"
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 bg-muted rounded-xl"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* Search Bar - responsive */}
            <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} mb-6`}>
              <h2 className={`${isMobile ? 'text-xl mb-3' : 'text-2xl'} font-semibold text-foreground`}>
                {selectedTeam === 'all' ? 'All Agents' : teams.find(t => t.id === selectedTeam)?.name || 'Team Agents'}
                <span className="text-muted-foreground font-normal ml-3 text-lg">({filteredAgents.length})</span>
              </h2>
              
              {/* Smaller search bar */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all duration-200"
                />
              </div>
            </div>
            
            {filteredAgents.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {searchQuery.trim() ? 'No agents found' : 'No agents yet'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery.trim() 
                    ? `No agents match "${searchQuery}". Try a different search term.`
                    : 'Create your first agent to get started with AI assistance.'
                  }
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors duration-200 font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {renderedAgents}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Delete Agent</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete this agent? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAgent(showDeleteConfirm)}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Wizard */}
      <CreateAgentWizard 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />

      {/* Create Team Modal */}
      <CreateTeamModal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        onTeamCreated={async (teamId) => {
          // Refresh teams list and close modal
          setShowCreateTeamModal(false);
          await refetchTeams();
        }}
      />
    </div>
  );
}