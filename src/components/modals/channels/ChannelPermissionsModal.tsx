import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { ChannelScopeSelector } from './ChannelScopeSelector';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ChannelPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  editingPermission: AgentPermission | null;
  onPermissionUpdated: () => void;
}

// Default scopes helper function
function getDefaultScopesForService(serviceId: string): string[] {
  if (serviceId === 'gmail') return [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
  ];
  if (serviceId === 'sendgrid') return ['send_email'];
  if (serviceId === 'mailgun') return ['send_email', 'validate', 'stats', 'suppressions'];
  return [];
}

export function ChannelPermissionsModal({
  isOpen,
  onClose,
  agentId,
  editingPermission,
  onPermissionUpdated
}: ChannelPermissionsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize selected scopes when editing permission changes
  useEffect(() => {
    if (editingPermission) {
      const defaultScopes = getDefaultScopesForService(editingPermission.provider_name);
      setSelectedScopes(editingPermission.allowed_scopes || defaultScopes);
    } else {
      setSelectedScopes([]);
    }
  }, [editingPermission]);

  const handleSave = async () => {
    if (!editingPermission || !user?.id) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: editingPermission.connection_id,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user.id
      });
      
      if (error) throw error;
      
      onPermissionUpdated();
      onClose();
      toast.success('Permissions updated successfully');
    } catch (error: any) {
      console.error('Update permissions error', error);
      toast.error('Failed to update permissions');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setSelectedScopes([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Modify Permissions
          </DialogTitle>
          <DialogDescription>
            Choose what this agent can do with{' '}
            {editingPermission?.external_username || editingPermission?.provider_name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <ChannelScopeSelector
            editingPermission={editingPermission}
            selectedScopes={selectedScopes}
            onScopesChange={setSelectedScopes}
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
