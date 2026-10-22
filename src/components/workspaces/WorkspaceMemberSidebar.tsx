import React, { useState, useEffect } from 'react';
import { User, Bot, Users, ArrowRight, Loader2 } from 'lucide-react'; // Added ArrowRight, Loader2
import type { PostgrestError } from '@supabase/supabase-js'; // Import PostgrestError

// Import the detailed type from the hook
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
// Import the hook to get agent summaries
import { useAgents, type AgentSummary } from '@/hooks/useAgents';
import { Button } from '@/components/ui/button'; // Import Button

// Define the shape of a member prop (using the imported type)
// interface Member { ... } // Remove the simplified interface

interface WorkspaceMemberSidebarProps {
  workspaceId: string;
  // Use the detailed type for members prop
  members: WorkspaceMemberDetail[]; 
  // Add the mutation function prop
  onAddAgent: (agentId: string, role?: string) => Promise<boolean>;
  // TODO: Add props for mutation loading/error state if needed for UI feedback
  // mutationLoading?: boolean;
  // mutationError?: string | null;
  loading: boolean; // Add loading state for members fetch
  error: PostgrestError | null; // Update error type
  // Add props for mobile sidebar state
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>; 
  currentUserRole: string; // Add role for permission checks (e.g., show invite)
  // TODO: Add other mutation functions if needed (remove, update role)
}

const WorkspaceMemberSidebar: React.FC<WorkspaceMemberSidebarProps> = ({ 
  workspaceId, 
  members, 
  onAddAgent, // Destructure the passed-in function
  // mutationLoading, // Destructure if passed
  // mutationError, // Destructure if passed
  loading: membersLoading, // Rename for clarity
  error: membersError, // Error is now PostgrestError | null
  isOpen, 
  setIsOpen, 
  currentUserRole 
}) => {
  // State for the invite input and agent selection
  const [inviteInput, setInviteInput] = useState('');
  const [suggestions, setSuggestions] = useState<AgentSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  // Local state for loading/error specific to *this component's* actions?
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Fetch available agents for suggestions
  // Correctly destructure agentSummaries and fetchAgentSummaries
  const { 
    agentSummaries, 
    fetchAgentSummaries, 
    loading: agentSummariesLoading, // Optional: Use loading state
    error: agentSummariesError // Optional: Use error state
  } = useAgents();

  // Fetch agents when the component mounts
  useEffect(() => {
    console.log("[WorkspaceMemberSidebar] Fetching agent summaries...");
    fetchAgentSummaries().then(() => {
        console.log("[WorkspaceMemberSidebar] Agent summaries fetched.");
        // Optionally log fetched data: console.log(agentSummaries);
    });
  }, [fetchAgentSummaries]);

  // Handle input changes for autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInviteInput(value);
    setSelectedAgent(null); // Clear selection when input changes
    setInviteError(null); // Clear error on new input

    if (value.startsWith('@') && value.length > 1) {
      const searchTerm = value.substring(1).toLowerCase();
      // Filter using the correct agentSummaries array
      const filtered = agentSummaries.filter(agent => 
        agent.name?.toLowerCase().includes(searchTerm)
      );
      console.log(`[WorkspaceMemberSidebar] Filtering with term "${searchTerm}", Found:`, filtered);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0); // Only show if there are suggestions
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handle selecting an agent from suggestions
  const handleSelectAgent = (agent: AgentSummary) => {
    setSelectedAgent(agent);
    setInviteInput(`@${agent.name || agent.id}`); // Display selected name
    setShowSuggestions(false);
    setSuggestions([]);
    setInviteError(null); // Clear error on selection
  };

  const handleInvite = async () => {
    if (!selectedAgent) {
      setInviteError("Please select an agent from the suggestions.");
      return; 
    }

    setIsInviting(true);
    setInviteError(null);
    console.log(`Attempting to add agent: ${selectedAgent.name} (ID: ${selectedAgent.id})`);
    // Call the passed-in function
    const success = await onAddAgent(selectedAgent.id);

    if (success) {
      console.log(`Invite successful for ${selectedAgent.name}`);
      setInviteInput(''); 
      setSelectedAgent(null); 
    } else {
      console.error(`Invite failed for ${selectedAgent.name}.`);
      // Use local error state, assuming parent might handle/log the actual error
      setInviteError("Failed to add agent. They might already be a member."); 
    }
    setIsInviting(false);
  };

  return (
    <div className={`
      fixed md:relative top-0 right-0 h-full z-40 
      w-64 
      bg-card text-card-foreground border-l 
      transition-transform duration-200 ease-in-out transform 
      ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
      md:translate-x-0 md:shadow-none shadow-lg 
      flex flex-col p-4 
    `}>
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h3 className="text-lg font-semibold">Members</h3>
        {/* Close button for mobile */} 
         <Button 
           variant="ghost" 
           size="icon" 
           className="md:hidden" 
           onClick={() => setIsOpen(false)}
         >
           <ArrowRight className="h-5 w-5" /> {/* Changed icon */} 
         </Button>
      </div>
      
      {/* Member List Area - Add Loading/Error states */}
      <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-card">
        {membersLoading ? (
           <div className="flex justify-center items-center h-full">
             <Loader2 className="animate-spin text-muted-foreground" />
           </div>
        ) : membersError ? (
          <p className="text-destructive text-sm px-2">Error: {membersError.message || 'Failed to load members'}</p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              // Use member.id (workspace_member UUID) as key
              <li key={member.id} className="flex items-center text-sm p-1 rounded hover:bg-muted">
                {/* Display Avatar/Icon based on member type */}
                {member.user_id && (
                  member.user_profile?.avatar_url ? (
                    <img src={member.user_profile.avatar_url} alt="User avatar" className="w-5 h-5 rounded-full mr-2" />
                  ) : (
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                  )
                )}
                {member.agent_id && <Bot className="w-4 h-4 mr-2 text-blue-400" />}
                {member.team_id && <Users className="w-4 h-4 mr-2 text-green-400" />}
                
                {/* Display Name based on member type */}
                <span className="flex-1 truncate">
                  {member.user_id && (member.user_profile?.full_name || `User ${member.user_id.substring(0,6)}...`)}
                  {member.agent_id && 
                    <>{member.agent?.name || `Agent ${member.agent_id.substring(0,6)}...`}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(agent)</span>
                    </>}
                  {member.team_id && (member.team?.name || `Team ${member.team_id.substring(0,6)}...`)}
                </span>
                
                {/* Display Role only if not an agent */}
                {!member.agent_id && <span className="text-xs text-muted-foreground ml-2">({member.role || 'member'})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite Section - Conditionally render based on role? */}
      {/* Example: Only show invite for owners/admins */} 
      {(currentUserRole === 'owner' || currentUserRole === 'admin') && (
        <div className="mt-auto border-t pt-3">
          {inviteError && <p className="text-xs text-destructive mb-1">Error: {inviteError}</p>}
          {agentSummariesError && (
            <p className="text-xs text-destructive mb-1">
              Error loading agents: {typeof agentSummariesError === 'string' ? agentSummariesError : (agentSummariesError?.message || 'Unknown error')}
            </p>
          )} 
          
          <p className="text-xs text-muted-foreground mb-1">Invite Agents (use @)</p> 
          <div className="relative"> 
            <div className="flex space-x-2">
              <input 
                type="text"
                value={inviteInput}
                onChange={handleInputChange} 
                placeholder="@agent name..." 
                className="flex-1 text-sm" 
                disabled={isInviting || agentSummariesLoading} 
              />
              <Button 
                onClick={handleInvite}
                disabled={!selectedAgent || isInviting || agentSummariesLoading}
                size="sm"
              >
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'} 
              </Button>
            </div>
            {/* Suggestions Dropdown */} 
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute bottom-full left-0 right-0 mb-1 max-h-40 overflow-y-auto bg-popover border rounded shadow-lg z-10 text-popover-foreground">
                {suggestions.map(agent => (
                  <li 
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent)} 
                    className="px-3 py-1 text-sm hover:bg-muted cursor-pointer"
                  >
                    {agent.name || `Agent ${agent.id.substring(0,6)}...`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceMemberSidebar; 