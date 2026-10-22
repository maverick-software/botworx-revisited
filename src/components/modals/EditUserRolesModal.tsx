import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, X } from 'lucide-react';

// Reusing AdminUser definition (consider moving to a shared types file)
interface AdminUser {
    id: string;
    email: string;
    // ... other fields if needed by the modal
    roles: { id: string; name: string }[];
}

interface Role {
    id: string;
    name: string;
    description?: string;
}

interface EditUserRolesModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onRolesUpdated: (userId: string, updatedRoles: { id: string; name: string }[]) => void; // Callback to update parent state
}

export function EditUserRolesModal({ user, isOpen, onClose, onRolesUpdated }: EditUserRolesModalProps) {
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available roles when the modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchAvailableRoles = async () => {
        setLoadingRoles(true);
        setError(null);
        try {
          const { data, error: rolesError } = await supabase
            .from('roles')
            .select('id, name, description')
            .order('name');

          if (rolesError) throw rolesError;
          setAvailableRoles(data || []);
        } catch (err: any) {
          console.error("Error fetching available roles:", err);
          setError(`Failed to load roles: ${err.message}`);
        } finally {
          setLoadingRoles(false);
        }
      };
      fetchAvailableRoles();
    }
  }, [isOpen]);

  // Set initial selected roles when user data is available
  useEffect(() => {
    if (user) {
      setSelectedRoleIds(new Set(user.roles.map(role => role.id)));
    } else {
      setSelectedRoleIds(new Set()); // Clear if no user
    }
  }, [user]);

  const handleCheckboxChange = (roleId: string, isChecked: boolean) => {
    setSelectedRoleIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(roleId);
      } else {
        // Prevent removing the last role? Or allow zero roles? Allowing zero for now.
        // Prevent admin from removing their own admin role? Needs check against current auth user ID.
        // For now, basic add/remove:
        newSet.delete(roleId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setError(null);
    const roleIdsToSave = Array.from(selectedRoleIds);

    try {
      const { error: updateError } = await supabase.functions.invoke(
        'admin-update-user-roles',
        {
          body: { 
            userIdToUpdate: user.id, 
            roleIds: roleIdsToSave
          }
        }
      );

      if (updateError) throw new Error(updateError.message || 'Failed to update roles');
      
      // Roles updated successfully
      console.log(`Roles updated for user ${user.id}`);
      // Call the callback to update the parent component's state
      const updatedRolesList = availableRoles.filter(r => roleIdsToSave.includes(r.id));
      onRolesUpdated(user.id, updatedRolesList);
      onClose(); // Close the modal

    } catch (err: any) {
        console.error("Error updating roles:", err);
        setError(err.message || 'An unknown error occurred while saving roles.');
    } finally {
        setIsSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Roles for {user.email}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md flex items-center text-sm">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {loadingRoles ? (
                <div className="text-center text-gray-400 py-4">Loading available roles...</div>
            ) : availableRoles.length === 0 && !error ? (
                 <div className="text-center text-gray-400 py-4">No roles found in the system.</div>
            ) : (
                 <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {availableRoles.map(role => (
                        <label key={role.id} className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer">
                            <input 
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-800"
                                checked={selectedRoleIds.has(role.id)}
                                onChange={(e) => handleCheckboxChange(role.id, e.target.checked)}
                            />
                            <span className="text-white font-medium">{role.name}</span>
                            {role.description && <span className="text-sm text-gray-400">- {role.description}</span>}
                        </label>
                    ))}
                </div>
            )}
        </div>

        <div className="flex justify-end p-4 border-t border-gray-700 space-x-3">
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-gray-600 text-gray-200 hover:bg-gray-500 disabled:opacity-50"
           >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={loadingRoles || isSaving}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait flex items-center"
          >
            {isSaving ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                </>
            ) : (
                'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 