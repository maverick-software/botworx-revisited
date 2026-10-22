import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Trash2, 
  Shield, 
  AlertCircle, 
  CheckCircle,
  Mail,
  Settings,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/integrations/gmail';
import { toast } from 'react-hot-toast';

interface AgentPermission {
  id: string;
  agent_id: string;
  user_oauth_connection_id: string;
  allowed_scopes: string[];
  permission_level: string;
  is_active: boolean;
  connection?: {
    connection_name: string;
    external_username: string;
    provider_name: string;
  };
}

interface AgentIntegrationAssignmentProps {
  agentId: string;
}

const DEFAULT_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

export function AgentIntegrationAssignment({ agentId }: AgentIntegrationAssignmentProps) {
  const { user } = useAuth();
  const { connections: gmailConnections } = useGmailConnection();
  const [permissions, setPermissions] = useState<AgentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(DEFAULT_GMAIL_SCOPES);

  useEffect(() => {
    if (agentId && user) {
      fetchAgentPermissions();
    }
  }, [agentId, user]);

  const fetchAgentPermissions = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log('[Integration] Fetching permissions for agent:', agentId);
      
      // Use the new helper function instead of RPC
      const data = await getAgentIntegrationPermissions(agentId, user.id);

      console.log('[Integration] Raw permissions data:', data);

      const formattedPermissions = data.map((perm: any) => ({
        id: perm.permission_id,
        agent_id: perm.agent_id,
        user_oauth_connection_id: perm.connection_id,
        allowed_scopes: perm.allowed_scopes || [],
        permission_level: perm.permission_level,
        is_active: perm.is_active,
        connection: {
          connection_name: perm.connection_name,
          external_username: perm.external_username,
          provider_name: perm.provider_name
        }
      }));

      console.log('[Integration] Formatted permissions:', formattedPermissions);
      setPermissions(formattedPermissions);
    } catch (error) {
      console.error('[Integration] Error fetching agent permissions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load integration permissions';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermission = async () => {
    if (!selectedConnectionId || selectedScopes.length === 0) {
      toast.error('Please select a connection and at least one permission');
      return;
    }

    try {
      setSaving(true);
      console.log('[Integration] Granting permission:', { agentId, selectedConnectionId, selectedScopes });

      const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: selectedConnectionId,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user?.id
      });

      if (error) {
        console.error('[Integration] RPC error:', error);
        throw error;
      }

      console.log('[Integration] Permission granted successfully:', data);
      toast.success('Integration permission granted successfully');
      setSelectedConnectionId('');
      setSelectedScopes(DEFAULT_GMAIL_SCOPES);
      fetchAgentPermissions();
    } catch (error) {
      console.error('[Integration] Error granting permission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to grant integration permission';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    try {
      console.log('[Integration] Revoking permission:', permissionId);
      
      const { data, error } = await supabase.rpc('revoke_agent_integration_permission', {
        p_permission_id: permissionId
      });

      if (error) {
        console.error('[Integration] RPC error:', error);
        throw error;
      }

      console.log('[Integration] Permission revoked successfully:', data);
      toast.success('Integration permission revoked');
      fetchAgentPermissions();
    } catch (error) {
      console.error('[Integration] Error revoking permission:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke integration permission';
      toast.error(errorMessage);
    }
  };

  const handleTogglePermission = async (permissionId: string, isActive: boolean) => {
    try {
      if (isActive) {
        // If enabling, we don't need to do anything special since the permission already exists
        const { error } = await supabase
          .from('agent_integration_permissions')
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', permissionId);

        if (error) throw error;
      } else {
        // If disabling, use the revoke function for consistency
        const { data, error } = await supabase.rpc('revoke_agent_integration_permission', {
          p_permission_id: permissionId
        });

        if (error) throw error;
      }

      toast.success(`Integration ${isActive ? 'enabled' : 'disabled'}`);
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error toggling permission:', error);
      toast.error('Failed to update integration status');
    }
  };

  const availableConnections = gmailConnections.filter(
    conn => conn.connection_status === 'active' && 
    !permissions.some(perm => perm.user_oauth_connection_id === conn.id)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-gray-400">Loading integrations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Integration Permissions
        </CardTitle>
        <CardDescription>
          Assign saved credentials to allow this agent to use integrated services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new permission */}
        {availableConnections.length > 0 && (
          <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-300">Add Integration</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="connection">Select Credential</Label>
                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                  <SelectTrigger id="connection">
                    <SelectValue placeholder="Choose a saved credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableConnections.map(conn => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {conn.external_username}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, 'https://www.googleapis.com/auth/gmail.readonly']);
                        } else {
                          setSelectedScopes(selectedScopes.filter(s => s !== 'https://www.googleapis.com/auth/gmail.readonly'));
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                    Read emails
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.send')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, 'https://www.googleapis.com/auth/gmail.send']);
                        } else {
                          setSelectedScopes(selectedScopes.filter(s => s !== 'https://www.googleapis.com/auth/gmail.send'));
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                    Send emails
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.modify')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScopes([...selectedScopes, 'https://www.googleapis.com/auth/gmail.modify']);
                        } else {
                          setSelectedScopes(selectedScopes.filter(s => s !== 'https://www.googleapis.com/auth/gmail.modify'));
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                    Modify emails (archive, labels, etc.)
                  </label>
                </div>
              </div>
            </div>

            <Button
              onClick={handleAddPermission}
              disabled={!selectedConnectionId || selectedScopes.length === 0 || saving}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Grant Access
            </Button>
          </div>
        )}

        {/* No available connections */}
        {gmailConnections.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No Gmail accounts connected. 
              <a href="/integrations" className="ml-1 text-blue-400 hover:text-blue-300">
                Connect an account first
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Existing permissions */}
        <div className="space-y-3">
          {permissions.map(permission => (
            <div key={permission.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-700 rounded">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium text-white">
                    {permission.connection?.external_username || 'Gmail Account'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {permission.allowed_scopes?.length || 0} permissions granted
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={permission.is_active}
                  onCheckedChange={(checked) => handleTogglePermission(permission.id, checked)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokePermission(permission.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {permissions.length === 0 && availableConnections.length === 0 && gmailConnections.length > 0 && (
          <div className="text-center py-4 text-gray-400">
            No integrations assigned to this agent yet
          </div>
        )}
      </CardContent>
    </Card>
  );
} 