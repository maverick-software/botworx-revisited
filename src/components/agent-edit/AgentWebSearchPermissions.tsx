/**
 * Agent Web Search Permissions Component
 * Manages web search API access for agents
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  Globe,
  Shield,
  Settings
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface WebSearchPermission {
  permission_id: string;
  agent_id: string;
  provider_id: string;
  provider_name: string;
  provider_display_name: string;
  key_id: string;
  key_name: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

interface UserWebSearchKey {
  key_id: string;
  key_name: string;
  provider_id: string;
  provider_name: string;
  provider_display_name: string;
  key_status: string;
  created_at: string;
}

interface AgentWebSearchPermissionsProps {
  agentId: string;
  className?: string;
}

const DEFAULT_WEB_SEARCH_PERMISSIONS = ['web_search', 'news_search'];

const PERMISSION_DESCRIPTIONS = {
  web_search: 'Search the web for current information and content',
  news_search: 'Search for recent news articles and current events',
  image_search: 'Search for images and visual content',
  scrape_and_summarize: 'Scrape and summarize web page content',
};

const getProviderIcon = (providerName: string) => {
  switch (providerName) {
    case 'serper':
      return <Search className="h-4 w-4" />;
    case 'serpapi':
      return <Globe className="h-4 w-4" />;
    case 'brave_search':
      return <Shield className="h-4 w-4" />;
    default:
      return <Search className="h-4 w-4" />;
  }
};

export function AgentWebSearchPermissions({ agentId, className }: AgentWebSearchPermissionsProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  const [permissions, setPermissions] = useState<WebSearchPermission[]>([]);
  const [userKeys, setUserKeys] = useState<UserWebSearchKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(DEFAULT_WEB_SEARCH_PERMISSIONS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentId && user) {
      loadData();
    }
  }, [agentId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadPermissions(), loadUserKeys()]);
    } catch (error) {
      console.error('Error loading web search data:', error);
      toast.error('Failed to load web search permissions');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    const { data, error } = await supabase.rpc('get_agent_web_search_permissions', {
      p_agent_id: agentId
    });

    if (error) throw error;

    const formattedPermissions = data?.map((perm: any) => ({
      permission_id: perm.permission_id,
      agent_id: perm.agent_id,
      provider_id: perm.provider_id,
      provider_name: perm.provider_name,
      provider_display_name: perm.provider_display_name,
      key_id: perm.key_id,
      key_name: perm.key_name,
      permissions: Array.isArray(perm.permissions) ? perm.permissions : [],
      is_active: perm.is_active,
      created_at: perm.created_at,
    })) || [];

    setPermissions(formattedPermissions);
  };

  const loadUserKeys = async () => {
    const { data, error } = await supabase.rpc('get_user_web_search_keys');

    if (error) throw error;

    setUserKeys(data || []);
  };

  const handleAddPermission = () => {
    setSelectedKeyId('');
    setSelectedPermissions(DEFAULT_WEB_SEARCH_PERMISSIONS);
    setError(null);
    setShowAddModal(true);
  };

  const handleGrantPermission = async () => {
    if (!selectedKeyId || selectedPermissions.length === 0) {
      setError('Please select an API key and at least one permission');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data, error } = await supabase.rpc('grant_agent_web_search_permission', {
        p_agent_id: agentId,
        p_user_key_id: selectedKeyId,
        p_permissions: selectedPermissions
      });

      if (error) throw error;

      toast.success('Web search permissions granted successfully');
      setShowAddModal(false);
      await loadPermissions();
    } catch (error: any) {
      console.error('Error granting web search permission:', error);
      setError(error.message || 'Failed to grant web search permissions');
      toast.error('Failed to grant web search permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokePermission = async (providerId: string, providerName: string) => {
    if (!confirm(`Remove ${providerName} web search access for this agent?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('revoke_agent_web_search_permission', {
        p_agent_id: agentId,
        p_provider_id: providerId
      });

      if (error) throw error;

      toast.success('Web search permissions revoked successfully');
      await loadPermissions();
    } catch (error: any) {
      console.error('Error revoking web search permission:', error);
      toast.error('Failed to revoke web search permissions');
    }
  };

  const handlePermissionToggle = (permission: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions(prev => [...prev, permission]);
    } else {
      setSelectedPermissions(prev => prev.filter(p => p !== permission));
    }
  };

  const getAvailableKeys = () => {
    return userKeys.filter(key => 
      !permissions.some(perm => 
        perm.key_id === key.key_id && perm.is_active
      )
    );
  };

  if (loading) {
    return (
      <Card className={`bg-card border-border ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-400" />
            Web Search Access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400">Loading web search permissions...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`bg-card border-border ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-400" />
            Web Search Access
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Grant this agent access to your web search API keys
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {userKeys.length === 0 ? (
            <Alert className="bg-yellow-900/20 border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                No web search API keys found. Add API keys in the{' '}
                <a href="/integrations" className="underline hover:text-yellow-300">
                  Integrations page
                </a>{' '}
                first.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {permissions.length === 0 ? (
                <div className="text-center py-6">
                  <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No web search permissions granted</p>
                  <Button onClick={handleAddPermission} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Grant Web Search Access
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {permissions.filter(perm => perm.is_active).map((permission) => (
                      <div key={permission.permission_id} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-gray-700 rounded-lg">
                            {getProviderIcon(permission.provider_name)}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {permission.provider_display_name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {permission.key_name}
                            </div>
                            <div className="flex gap-1 mt-1">
                              {permission.permissions.map((perm) => (
                                <Badge key={perm} variant="secondary" className="text-xs">
                                  {perm.replace('_', ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokePermission(permission.provider_id, permission.provider_display_name)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {getAvailableKeys().length > 0 && (
                    <Button onClick={handleAddPermission} variant="outline" className="w-full border-border text-foreground hover:bg-card border border-border">
                      <Plus className="h-4 w-4 mr-2" />
                      Add More Web Search Access
                    </Button>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Permission Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[500px] bg-card border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-400" />
              Grant Web Search Access
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Allow this agent to use your web search API keys
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {error && (
              <Alert className="bg-red-900/20 border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-white font-medium mb-2 block">
                Select API Key
              </label>
              <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
                <SelectTrigger className="bg-card border border-border border-border text-white">
                  <SelectValue placeholder="Choose a web search API key" />
                </SelectTrigger>
                <SelectContent className="bg-card border border-border border-border">
                  {getAvailableKeys().map((key) => (
                    <SelectItem key={key.key_id} value={key.key_id} className="text-white hover:bg-gray-700">
                      <div className="flex items-center space-x-2">
                        {getProviderIcon(key.provider_name)}
                        <span>{key.provider_display_name} - {key.key_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-white font-medium mb-3 block">
                Permissions
              </label>
              <div className="space-y-3">
                {Object.entries(PERMISSION_DESCRIPTIONS).map(([permission, description]) => (
                  <div key={permission} className="flex items-start space-x-3">
                    <Checkbox
                      id={permission}
                      checked={selectedPermissions.includes(permission)}
                      onCheckedChange={(checked) => handlePermissionToggle(permission, !!checked)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <label htmlFor={permission} className="text-white cursor-pointer">
                        {permission.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <p className="text-sm text-gray-400 mt-1">
                        {description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddModal(false)}
              className="border-border text-foreground hover:bg-card border border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrantPermission}
              disabled={saving || !selectedKeyId || selectedPermissions.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Granting...' : 'Grant Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 