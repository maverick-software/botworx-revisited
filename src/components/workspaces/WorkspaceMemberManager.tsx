import React, { useState } from 'react';
import { useWorkspaceMembers, WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, User, Bot, Users, Plus, AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface WorkspaceMemberManagerProps {
  workspaceId: string;
}

export const WorkspaceMemberManager: React.FC<WorkspaceMemberManagerProps> = ({ workspaceId }) => {
  const {
    members,
    loading,
    error,
    addAgentMember, // Assuming we might add agents here too eventually
    addTeamMember,
    addUserMember,
    removeMember,
    updateMemberRole,
  } = useWorkspaceMembers(workspaceId);

  // Local state for managing invites/updates
  const [inviteInput, setInviteInput] = useState('');
  const [inviteType, setInviteType] = useState<'user' | 'team'>('user'); // Default to inviting users
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteInput.trim()) return;
    setIsInviting(true);
    setInviteError(null);
    let success = false;
    try {
      if (inviteType === 'user') {
        // TODO: Need a way to resolve email to user ID if needed
        // Assuming inviteInput is user ID for now
        success = await addUserMember(inviteInput.trim());
      } else {
        // Assuming inviteInput is team ID for now
        success = await addTeamMember(inviteInput.trim());
      }

      if (success) {
        setInviteInput(''); // Clear input on success
      } else {
        // Error state should be set by the hook
        setInviteError(error || 'Failed to add member. They may already be a member or ID is invalid.');
      }
    } catch (e: any) {
      setInviteError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
     if (!window.confirm("Are you sure you want to remove this member?")) return;
     // Error/loading is handled within the hook, just call it
     await removeMember(memberId);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
     // Error/loading handled in hook
     await updateMemberRole(memberId, newRole);
  };

  if (loading && !members.length) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      <div className="border border-border p-4 rounded-lg bg-card">
        <h3 className="text-md font-medium mb-3">Invite Members</h3>
        <div className="flex flex-col sm:flex-row gap-2">
           <Select value={inviteType} onValueChange={(value: 'user' | 'team') => setInviteType(value)}>
             <SelectTrigger className="w-full sm:w-[100px]">
               <SelectValue placeholder="Type" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="user">User ID</SelectItem>
               <SelectItem value="team">Team ID</SelectItem>
             </SelectContent>
           </Select>
          <Input
            type="text" // Could change to email if we implement resolution
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder={inviteType === 'user' ? 'Enter User ID...' : 'Enter Team ID...'}
            className="flex-grow"
            disabled={isInviting}
          />
          <Button onClick={handleInvite} disabled={isInviting || !inviteInput.trim()}>
            {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Invite
          </Button>
        </div>
        {inviteError && <p className="text-xs text-red-500 mt-2 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> {inviteError}</p>}
        {/* Display hook error if it exists */} 
        {error && !inviteError && <p className="text-xs text-red-500 mt-2 flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> {error}</p>}
      </div>

      {/* Member List Section */}
      <div>
        <h3 className="text-md font-medium mb-3">Current Members</h3>
        {loading && <Loader2 className="animate-spin text-gray-400 my-2" />}
        {!loading && members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members yet.</p>
        )}
        {!loading && members.length > 0 && (
          <ul className="space-y-3">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between p-3 border border-border rounded-md bg-card">
                <div className="flex items-center space-x-3">
                  {member.user_id && (
                    member.user_profile?.avatar_url ? (
                      <img src={member.user_profile.avatar_url} alt="User" className="w-6 h-6 rounded-full" />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )
                  )}
                  {member.agent_id && <Bot className="w-5 h-5 text-blue-400" />} 
                  {member.team_id && <Users className="w-5 h-5 text-green-400" />}
                  <span className="text-sm font-medium">
                    {member.user_id && (member.user_profile?.full_name || `User ID: ${member.user_id.substring(0, 8)}...`)}
                    {member.agent_id && `${(member.agent?.name || `Agent ID: ${member.agent_id.substring(0, 8)}...`)} (agent)`}
                    {member.team_id && (member.team?.name || `Team ID: ${member.team_id.substring(0, 8)}...`)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {member.user_id || member.team_id ? (
                    <Select 
                      value={member.role || 'member'}
                      onValueChange={(newRole) => handleRoleChange(member.id, newRole)}
                      // TODO: Disable based on permissions
                    >
                      <SelectTrigger className="w-[120px] text-xs h-8">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        {/* Add other roles if needed */}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="w-[120px] h-8"></div> 
                  )}
                  <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(member.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                    title="Remove member"
                     // TODO: Disable based on permissions
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}; 