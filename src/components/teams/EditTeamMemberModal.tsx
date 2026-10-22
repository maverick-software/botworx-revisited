import React, { useState, useCallback } from 'react';
import { Loader2, AlertCircle, Save, Trash2, X } from 'lucide-react';
import type { TeamMember } from '../../types';

// Define standard roles (consider moving to a shared constants file later)
const STANDARD_ROLES = [
  { id: 'member', name: 'Member' },
  { id: 'project_manager', name: 'Project Manager' },
  { id: 'user_liaison', name: 'User Liaison' },
  { id: 'qa', name: 'QA' },
];

interface EditTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateRole: (memberId: string, role: string) => Promise<TeamMember | null>;
  onRemoveMember: (memberId: string) => Promise<boolean>;
  member: TeamMember | null;
}

export const EditTeamMemberModal: React.FC<EditTeamMemberModalProps> = ({
  isOpen,
  onClose,
  onUpdateRole,
  onRemoveMember,
  member,
}) => {
  const [selectedRole, setSelectedRole] = useState<string>(member?.team_role || 'member');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Update selected role when member changes
  React.useEffect(() => {
    if (member) {
      setSelectedRole(member.team_role || 'member');
    }
    // Reset delete confirmation when modal opens with new member
    setConfirmDelete(false);
  }, [member]);

  const handleUpdateRole = useCallback(async () => {
    if (!member || !selectedRole) return;

    setIsUpdating(true);
    setError(null);
    
    try {
      const updatedMember = await onUpdateRole(member.agent_id, selectedRole);
      if (updatedMember) {
        onClose();
      } else {
        setError('Failed to update role.');
      }
    } catch (err: any) {
      console.error("Error updating role:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsUpdating(false);
    }
  }, [member, selectedRole, onUpdateRole, onClose]);

  const handleRemoveMember = useCallback(async () => {
    if (!member) return;
    
    setIsDeleting(true);
    setError(null);
    
    try {
      const success = await onRemoveMember(member.agent_id);
      if (success) {
        onClose();
      } else {
        setError('Failed to remove team member.');
      }
    } catch (err: any) {
      console.error("Error removing member:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }, [member, onRemoveMember, onClose]);

  if (!isOpen || !member) return null;

  // CSS classes
  const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
  const buttonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-gray-600 text-sm font-medium rounded shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const dangerButtonClasses = "inline-flex items-center justify-center px-4 py-2 border border-red-600 text-sm font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const selectClasses = "block w-full pl-3 pr-8 py-2 border border-gray-700 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
      
      {/* Modal content */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
          {/* Header with close button */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-200">
              Edit Team Member: {member.agent?.name || 'Unknown Agent'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Form */}
          <div className="space-y-4">
            <div>
              <label htmlFor="role-selector" className={labelClasses}>Role</label>
              <select
                id="role-selector"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className={selectClasses}
                disabled={isUpdating || isDeleting}
              >
                {STANDARD_ROLES.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/50 p-2 rounded-md flex items-center">
                <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                {error}
              </div>
            )}
            
            {/* Actions */}
            <div className="mt-8 space-y-4">
              {/* Save/Cancel Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className={secondaryButtonClasses}
                  disabled={isUpdating || isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRole}
                  disabled={isUpdating || isDeleting || selectedRole === member.team_role}
                  className={buttonClasses}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1.5" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
              
              {/* Danger Zone */}
              <div className="pt-3 border-t border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Danger Zone</h4>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className={secondaryButtonClasses + " text-red-400 hover:text-white hover:bg-red-600 hover:border-red-600 w-full justify-center"}
                    disabled={isUpdating || isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Remove from team
                  </button>
                ) : (
                  <button
                    onClick={handleRemoveMember}
                    className={dangerButtonClasses + " w-full justify-center"}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-1.5" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Confirm Remove
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 