import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import { Loader2, AlertCircle, Plus, User, Edit } from 'lucide-react';
import type { TeamMember } from '../../types';
import { AddTeamMemberModal } from './AddTeamMemberModal';
import { EditTeamMemberModal } from './EditTeamMemberModal';

// Define standard roles (consider moving to a shared constants file later)
const STANDARD_ROLES = [
  { id: 'member', name: 'Member' },
  { id: 'project_manager', name: 'Project Manager' },
  { id: 'user_liaison', name: 'User Liaison' },
  { id: 'qa', name: 'QA' },
];

interface TeamMemberListProps {
  teamId: string;
}

// Constant for the 'User' option value
const REPORTS_TO_USER_VALUE = '__USER__';

// Helper to get display name for a role
const getRoleDisplayName = (roleId: string): string => {
  const role = STANDARD_ROLES.find(r => r.id === roleId);
  return role?.name || 'Member';
};

export const TeamMemberList: React.FC<TeamMemberListProps> = ({ teamId }) => {
  const {
    members,
    loading,
    error,
    fetchTeamMembers,
    addTeamMember,
    removeTeamMember,
    updateTeamMember,
  } = useTeamMembers();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [updateRoleError, setUpdateRoleError] = useState<string | null>(null);

  // Fetch members when component mounts or teamId changes
  useEffect(() => {
    if (teamId) {
      fetchTeamMembers(teamId);
    }
  }, [teamId, fetchTeamMembers]);

  const currentMemberAgentIds = useMemo(() => members.map(m => m.agent_id), [members]);
  const memberReportingToUser = useMemo(() => members.find(m => m.reports_to_user), [members]);

  // Handle adding a member via the modal
  const handleAddMember = useCallback(async (agentId: string, role: string) => {
    if (!agentId || !role || !teamId) return null;
    
    try {
      const newMember = await addTeamMember(teamId, agentId, role);
      if (newMember) {
        // Refresh the member list after successful add
        await fetchTeamMembers(teamId);
        return newMember;
      }
      return null;
    } catch (err) {
      console.error("Error adding member:", err);
      throw err;
    }
  }, [teamId, addTeamMember, fetchTeamMembers]);

  // Handle opening the edit modal
  const handleEditMember = useCallback((member: TeamMember) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  }, []);

  // Handle updating a member's role
  const handleUpdateRole = useCallback(async (agentId: string, newRole: string) => {
    if (!agentId || !newRole) return null;
    setUpdateRoleError(null);
    
    try {
      const updatedMember = await updateTeamMember(teamId, agentId, { team_role: newRole });
      if (updatedMember) {
        await fetchTeamMembers(teamId);
        return updatedMember;
      }
      return null;
    } catch (err) {
      console.error("Error updating role:", err);
      throw err;
    }
  }, [teamId, updateTeamMember, fetchTeamMembers]);

  // Handle removing a member
  const handleRemoveMember = useCallback(async (agentId: string) => {
    if (!agentId) return false;
    setRemovingMemberId(agentId);
    
    try {
      const success = await removeTeamMember(teamId, agentId);
      if (success) {
        await fetchTeamMembers(teamId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error removing member:", err);
      throw err;
    } finally {
      setRemovingMemberId(null);
    }
  }, [teamId, removeTeamMember, fetchTeamMembers]);

  // --- UI Rendering --- 
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-foreground">Team Members</h2>
        
        {!loading && !error && (
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Member
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center items-center p-4">
            <Loader2 className="animate-spin h-6 w-6 text-primary" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md text-sm flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          Error loading team members: {error.message}
        </div>
      )}
      {!loading && !error && members.length === 0 && (
        <div className="text-center py-6 px-4 border border-dashed border-border rounded-lg">
          <User className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">This team doesn't have any members yet.</p>
        </div>
      )}

      {!loading && !error && members.length > 0 && (
        <ul className="space-y-3">
          {members.map(member => (
            <li key={member.agent_id} className="bg-muted/50 border border-border p-4 rounded-md shadow-sm flex justify-between items-center hover:bg-muted/70 transition-colors">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                  {member.agent?.name ? member.agent.name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="ml-4">
                  <span className="text-foreground font-medium block">{member.agent?.name || 'Anonymous'}</span>
                  <span className="text-sm text-muted-foreground block">
                    {getRoleDisplayName(member.team_role || 'member')}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => handleEditMember(member)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors duration-200"
                title="Edit member"
              >
                <Edit className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add Member Modal */}
      <AddTeamMemberModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMember={handleAddMember}
        existingMemberAgentIds={currentMemberAgentIds}
      />

      {/* Edit Member Modal */}
      <EditTeamMemberModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdateRole={handleUpdateRole}
        onRemoveMember={handleRemoveMember}
        member={selectedMember}
      />
    </div>
  );
}; 