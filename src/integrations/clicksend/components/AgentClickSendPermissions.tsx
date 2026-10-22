import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Image, 
  DollarSign, 
  History, 
  CheckCircle, 
  AlertTriangle,
  Settings,
  Plus,
  Loader2,
  ChevronDown,
  Trash2,
  Zap,
  BarChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
// Collapsible functionality implemented with state
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { clicksendMCPTools } from '../services/clicksend-tools';

interface AgentClickSendPermissionsProps {
  agent: any;
  user: any;
  onPermissionsChange?: (permissions: any[]) => void;
}

interface ClickSendConnection {
  connection_id: string;
  connection_name: string;
  external_username: string;
  connection_status: string;
  configuration: any;
}

interface UsageStats {
  sms_sent: number;
  mms_sent: number;
  balance_checks: number;
  history_queries: number;
  last_sms_sent?: string;
  last_mms_sent?: string;
  success_rate: number;
  total_operations: number;
}

export function AgentClickSendPermissions({ 
  agent, 
  user, 
  onPermissionsChange 
}: AgentClickSendPermissionsProps) {
  const navigate = useNavigate();
  const [hasConnection, setHasConnection] = useState(false);
  const [connection, setConnection] = useState<ClickSendConnection | null>(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  // Load connection and permission data
  useEffect(() => {
    loadConnectionData();
    loadPermissionData();
    loadUsageStats();
  }, [agent.id, user.id]);

  const loadConnectionData = async () => {
    try {
      const { data: connectionData, error } = await supabase.rpc(
        'get_user_clicksend_connection',
        { p_user_id: user.id }
      );

      if (error) {
        console.error('Error loading ClickSend connection:', error);
        return;
      }

      if (connectionData && connectionData.length > 0) {
        setHasConnection(true);
        setConnection(connectionData[0]);
      } else {
        setHasConnection(false);
        setConnection(null);
      }
    } catch (error) {
      console.error('Error loading connection data:', error);
    }
  };

  const loadPermissionData = async () => {
    try {
      if (!hasConnection || !connection) return;

      const { data: permissionData, error } = await supabase
        .from('agent_integration_permissions')
        .select('allowed_scopes, is_active')
        .eq('agent_id', agent.id)
        .eq('user_oauth_connection_id', connection.connection_id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading permissions:', error);
        return;
      }

      if (permissionData) {
        setHasPermissions(true);
        const scopes = Array.isArray(permissionData.allowed_scopes) 
          ? permissionData.allowed_scopes 
          : Object.keys(permissionData.allowed_scopes || {});
        setPermissions(scopes);
      } else {
        setHasPermissions(false);
        setPermissions([]);
      }
    } catch (error) {
      console.error('Error loading permission data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      const stats = await clicksendMCPTools.getUsageStats(agent.id, user.id, 30);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  const handleToggleAllPermissions = async (enabled: boolean) => {
    if (!hasConnection || !connection) return;

    setIsUpdating(true);
    try {
      if (enabled) {
        // Grant all permissions
        const allScopes = ['sms', 'mms', 'balance', 'history'];
        
        const { error } = await supabase
          .from('agent_integration_permissions')
          .upsert({
            agent_id: agent.id,
            user_oauth_connection_id: connection.connection_id,
            allowed_scopes: allScopes,
            is_active: true,
            granted_by_user_id: user.id,
            permission_level: 'custom'
          });

        if (error) throw error;

        setHasPermissions(true);
        setPermissions(allScopes);
        toast.success('ClickSend permissions granted to agent');
      } else {
        // Revoke all permissions
        const { error } = await supabase
          .from('agent_integration_permissions')
          .update({ is_active: false })
          .eq('agent_id', agent.id)
          .eq('user_oauth_connection_id', connection.connection_id);

        if (error) throw error;

        setHasPermissions(false);
        setPermissions([]);
        toast.success('ClickSend permissions revoked from agent');
      }

      onPermissionsChange?.(enabled ? ['clicksend'] : []);
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      toast.error(`Failed to update permissions: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePermissionChange = async (scope: string, enabled: boolean) => {
    if (!hasConnection || !connection) return;

    setIsUpdating(true);
    try {
      const newPermissions = enabled 
        ? [...permissions.filter(p => p !== scope), scope]
        : permissions.filter(p => p !== scope);

      if (newPermissions.length === 0) {
        // If no permissions left, deactivate the record
        const { error } = await supabase
          .from('agent_integration_permissions')
          .update({ is_active: false })
          .eq('agent_id', agent.id)
          .eq('user_oauth_connection_id', connection.connection_id);

        if (error) throw error;

        setHasPermissions(false);
        setPermissions([]);
      } else {
        // Update permissions
        const { error } = await supabase
          .from('agent_integration_permissions')
          .upsert({
            agent_id: agent.id,
            user_oauth_connection_id: connection.connection_id,
            allowed_scopes: newPermissions,
            is_active: true,
            granted_by_user_id: user.id,
            permission_level: 'custom'
          });

        if (error) throw error;

        setPermissions(newPermissions);
      }

      toast.success(`${scope.toUpperCase()} permission ${enabled ? 'granted' : 'revoked'}`);
    } catch (error: any) {
      console.error('Error updating permission:', error);
      toast.error(`Failed to update ${scope} permission: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await clicksendMCPTools.testConnection(agent.id, user.id);
      if (result.success) {
        toast.success('ClickSend connection test successful!');
      } else {
        toast.error(`Connection test failed: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`Connection test failed: ${error.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleRevokeAllPermissions = async () => {
    await handleToggleAllPermissions(false);
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading ClickSend permissions...</span>
      </div>
    );
  }

  const hasAnyPermissions = hasPermissions && permissions.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg p-6 space-y-6 relative">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">ClickSend SMS/MMS</h3>
            <p className="text-sm text-gray-600">Allow agent to send SMS and MMS messages</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          {hasAnyPermissions && (
            <Badge variant="default" className="flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Active</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Connection Status Check */}
      {!hasConnection ? (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800">ClickSend Account Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Connect your ClickSend account first to enable SMS/MMS capabilities for this agent.
              </p>
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => navigate('/credentials')}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Connect ClickSend
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current Connection Info */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="font-medium text-green-800">Connected to ClickSend</span>
              </div>
              <span className="text-sm text-green-700">
                {connection?.connection_name || connection?.external_username}
              </span>
            </div>
          </div>

          {/* Quick Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Enable SMS/MMS Access</h4>
              <p className="text-sm text-gray-600">
                Grant this agent permission to send messages on your behalf
              </p>
            </div>
            <Switch
              checked={hasAnyPermissions}
              onCheckedChange={handleToggleAllPermissions}
              disabled={isUpdating}
            />
          </div>

          {/* Detailed Permissions */}
          {hasAnyPermissions && (
            <div>
              <Button 
                variant="ghost" 
                className="w-full justify-between p-0"
                onClick={() => setShowDetails(!showDetails)}
              >
                <span className="font-medium text-gray-900">Permission Details</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              </Button>
              
              {showDetails && (
                <div className="space-y-3 mt-4">
                {/* SMS Sending Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-gray-900">Send SMS Messages</h5>
                      <p className="text-sm text-gray-600">Allow agent to send text messages to phone numbers</p>
                      <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                        <span>• Standard SMS rates apply</span>
                        <span>• 160 character limit per message</span>
                      </div>
                    </div>
                  </div>
                  <Checkbox
                    checked={permissions.includes('sms')}
                    onCheckedChange={(checked) => handlePermissionChange('sms', checked as boolean)}
                    disabled={isUpdating}
                  />
                </div>

                {/* MMS Sending Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Image className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-gray-900">Send MMS Messages</h5>
                      <p className="text-sm text-gray-600">Allow agent to send multimedia messages with images and videos</p>
                      <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                        <span>• Higher rates than SMS</span>
                        <span>• 5MB file size limit</span>
                      </div>
                    </div>
                  </div>
                  <Checkbox
                    checked={permissions.includes('mms')}
                    onCheckedChange={(checked) => handlePermissionChange('mms', checked as boolean)}
                    disabled={isUpdating}
                  />
                </div>

                {/* Balance Checking Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-gray-900">Check Account Balance</h5>
                      <p className="text-sm text-gray-600">Allow agent to view ClickSend account balance and usage</p>
                      <div className="mt-1 text-xs text-gray-500">
                        <span>• Read-only access to account information</span>
                      </div>
                    </div>
                  </div>
                  <Checkbox
                    checked={permissions.includes('balance')}
                    onCheckedChange={(checked) => handlePermissionChange('balance', checked as boolean)}
                    disabled={isUpdating}
                  />
                </div>

                {/* Message History Permission */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <History className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h5 className="font-medium text-gray-900">Access Message History</h5>
                      <p className="text-sm text-gray-600">Allow agent to view sent message history and delivery status</p>
                      <div className="mt-1 text-xs text-gray-500">
                        <span>• View messages sent by this agent only</span>
                      </div>
                    </div>
                  </div>
                  <Checkbox
                    checked={permissions.includes('history')}
                    onCheckedChange={(checked) => handlePermissionChange('history', checked as boolean)}
                    disabled={isUpdating}
                  />
                </div>
                </div>
              )}
            </div>
          )}

          {/* Usage Statistics */}
          {hasAnyPermissions && usageStats && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900">Recent Usage (Last 30 Days)</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDetailedStats(!showDetailedStats)}
                  className="text-blue-700 hover:text-blue-900"
                >
                  {showDetailedStats ? 'Hide' : 'Show'} Details
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{usageStats.sms_sent}</div>
                  <div className="text-sm text-blue-700">SMS Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{usageStats.mms_sent}</div>
                  <div className="text-sm text-blue-700">MMS Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{usageStats.balance_checks}</div>
                  <div className="text-sm text-blue-700">Balance Checks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-900">{usageStats.history_queries}</div>
                  <div className="text-sm text-blue-700">History Queries</div>
                </div>
              </div>

              {showDetailedStats && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700">Last SMS sent:</span>
                      <span className="text-blue-900">{formatRelativeTime(usageStats.last_sms_sent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Last MMS sent:</span>
                      <span className="text-blue-900">{formatRelativeTime(usageStats.last_mms_sent)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700">Success rate:</span>
                      <span className="text-blue-900">{usageStats.success_rate}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {hasAnyPermissions && (
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadUsageStats()}
              >
                <BarChart className="w-4 h-4 mr-2" />
                Refresh Usage
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRevokeAllPermissions}
                disabled={isUpdating}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Revoke Access
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <Loader2 className="w-6 h-6 text-blue-600 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-gray-600">Updating permissions...</p>
          </div>
        </div>
      )}
    </div>
  );
}
