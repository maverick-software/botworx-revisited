import React, { useState, useCallback } from 'react';
import { AgentSelector } from '../shared/AgentSelector';
import { Loader2, AlertCircle, Plus, X } from 'lucide-react';
import type { TeamMember } from '../../types';

// Define standard roles (consider moving to a shared constants file later)
const STANDARD_ROLES = [
  { id: 'member', name: 'Member' },
  { id: 'project_manager', name: 'Project Manager' },
  { id: 'user_liaison', name: 'User Liaison' },
  { id: 'qa', name: 'QA' },
];

interface AddTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (agentId: string, role: string) => Promise<TeamMember | null>;
  existingMemberAgentIds: string[];
}

export const AddTeamMemberModal: React.FC<AddTeamMemberModalProps> = ({
  isOpen,
  onClose,
  onAddMember,
  existingMemberAgentIds,
}) => {
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState<string>('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<string>(STANDARD_ROLES[0]?.id || '');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddMember = useCallback(async () => {
    if (!selectedAgentToAdd || !selectedRoleToAdd) {
      setAddError('Please select an agent and a role.');
      return;
    }

    setIsAdding(true);
    setAddError(null);
    
    try {
      const newMember = await onAddMember(selectedAgentToAdd, selectedRoleToAdd);
      if (newMember) {
        // Reset form and close modal on success
        setSelectedAgentToAdd('');
        setSelectedRoleToAdd(STANDARD_ROLES[0]?.id || '');
        onClose();
      } else {
        setAddError('Failed to add team member.');
      }
    } catch (err: any) {
      console.error("Error adding member:", err);
      setAddError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsAdding(false);
    }
  }, [selectedAgentToAdd, selectedRoleToAdd, onAddMember, onClose]);

  if (!isOpen) return null;

  // CSS classes
  const inputClasses = "block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
  const buttonClasses = "inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "inline-flex items-center justify-center px-3 py-1.5 border border-gray-600 text-xs font-medium rounded shadow-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const selectClasses = "block w-full pl-3 pr-8 py-1 border border-gray-700 text-white bg-gray-800 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
      
      {/* Modal content */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
          {/* Header with close button */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-200">Add Team Member</h3>
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
              <AgentSelector
                onSelectAgent={(agentId) => setSelectedAgentToAdd(agentId)}
                excludeAgentIds={existingMemberAgentIds}
                initialSelectedAgentId={selectedAgentToAdd}
                disabled={isAdding}
              />
            </div>
            
            <div>
              <label htmlFor="role-selector" className={labelClasses}>Role</label>
              <select
                id="role-selector"
                value={selectedRoleToAdd}
                onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                className={selectClasses}
                disabled={isAdding}
              >
                {STANDARD_ROLES.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            
            {addError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/50 p-2 rounded-md flex items-center">
                <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                {addError}
              </div>
            )}
            
            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-5">
              <button
                onClick={onClose}
                className={secondaryButtonClasses}
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={isAdding || !selectedAgentToAdd || !selectedRoleToAdd}
                className={buttonClasses}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 