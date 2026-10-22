import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  Settings, 
  Mail, 
  ChevronRight, 
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/integrations/gmail';
import { useConnections, useIntegrationsByClassification, getAgentIntegrationPermissions } from '@/integrations/_shared';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
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

interface AgentIntegrationsManagerProps {
  agentId: string;
  category?: 'tool' | 'channel';
  title?: string;
  description?: string;
}

const DEFAULT_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify'
];

const DEFAULT_SEARCH_API_SCOPES = [
  'web_search',
  'news_search', 
  'image_search',
  'local_search'
];

export function AgentIntegrationsManager({ 
  agentId, 
  category = 'channel', 
  title = 'Integrations', 
  description = 'Connect external services to this agent' 
}: AgentIntegrationsManagerProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { connections: gmailConnections } = useGmailConnection();
  const { connections: unifiedConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification(category as 'tool' | 'channel');
  
  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  // State for workflow
  const [workflowMode, setWorkflowMode] = useState<'add' | 'view' | 'edit'>('add');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [selectedCredential, setSelectedCredential] = useState<any>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [editingPermission, setEditingPermission] = useState<AgentPermission | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, { capability_key: string; display_label: string; display_order: number }[]>>({});
  
  // Data state
  const [permissions, setPermissions] = useState<AgentPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agentId && user) {
      fetchAgentPermissions();
    }
  }, [agentId, user, unifiedConnections, gmailConnections]);

  useEffect(() => {
    // Load capability catalog for current classification integrations
    (async () => {
      try {
        if (!integrations || integrations.length === 0) return;
        const ids = integrations.map(i => i.id);
        const { data } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', ids)
          .order('display_order');
        const map: Record<string, any[]> = {};
        (data || []).forEach((row: any) => {
          if (!map[row.integration_id]) map[row.integration_id] = [];
          map[row.integration_id].push({ capability_key: row.capability_key, display_label: row.display_label, display_order: row.display_order });
        });
        setCapabilities(map);
      } catch (e) {
        console.warn('Capabilities load skipped', e);
      }
    })();
  }, [integrations, supabase]);

  const fetchAgentPermissions = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Use the new helper function instead of RPC
      const data = await getAgentIntegrationPermissions(agentId, user.id);

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
        },
        integration_name: perm.integration_name || perm.provider_name || 'Unknown'
      }));

      setPermissions(formattedPermissions);
    } catch (error) {
      console.error('Error fetching agent permissions:', error);
      toast.error('Failed to load integration permissions');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Show available integrations (only Gmail for now)
  const handleAddIntegration = () => {
    setWorkflowMode('add');
    setShowAddModal(true);
  };

  // Step 2: Show credentials for selected integration
  const handleSelectIntegration = (integration: { id: string; name: string; icon_name?: string }) => {
    setSelectedIntegration(integration);
    
    // Set default scopes based on integration type
    const integrationId = integration.id || integration.name.toLowerCase();
    const defaultScopes = integrationId === 'gmail' ? DEFAULT_GMAIL_SCOPES :
                         (integrationId.includes('serper') || 
                          integrationId.includes('serpapi') || 
                          integrationId.includes('brave') || 
                          integrationId.includes('search')) ? DEFAULT_SEARCH_API_SCOPES :
                         integrationId.includes('mailgun') ? ['send_email','validate','stats','suppressions'] : [];
    
    setSelectedScopes(defaultScopes);
    setShowAddModal(false);
    setShowCredentialsModal(true);
  };

  // Step 3: Show permissions for selected credential
  const handleSelectCredential = (credential: any) => {
    setSelectedCredential(credential);
    setShowCredentialsModal(false);
    setShowPermissionsModal(true);
  };

  // Final step: Grant permission
  const handleGrantPermission = async () => {
    if (!selectedCredential || selectedScopes.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: selectedCredential.id,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user?.id
      });

      if (error) throw error;

      toast.success(`${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'} added successfully`);
      resetModals();
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error granting permission:', error);
      toast.error(`Failed to add ${category === 'channel' ? 'channel' : category === 'tool' ? 'tool' : 'integration'}`);
    } finally {
      setSaving(false);
    }
  };

  // Update existing permission
  const handleUpdatePermission = async () => {
    if (!editingPermission || selectedScopes.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }

    try {
      setSaving(true);
      // Use the existing grant function which handles updates via ON CONFLICT
      const { data, error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: editingPermission.user_oauth_connection_id,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user?.id
      });

      if (error) throw error;

      toast.success('Permissions updated successfully');
      resetModals();
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const resetModals = () => {
    setShowAddModal(false);
    setShowCredentialsModal(false);
    setShowPermissionsModal(false);
    setShowViewModal(false);
    setSelectedIntegration(null);
    setSelectedCredential(null);
    setSelectedScopes([]);
    setEditingPermission(null);
    setWorkflowMode('add');
  };

  // Show credentials for existing integration
  const handleViewCredentials = (permission: AgentPermission) => {
    // Find the integration type and set up for viewing
    setWorkflowMode('view');
    const providerName = permission.connection?.provider_name || 'Integration';
    const iconName = providerName.toLowerCase() === 'gmail' ? 'Mail' : 
                     providerName.toLowerCase().includes('search') ? 'Search' : 'Settings';
    setSelectedIntegration({ name: providerName, icon_name: iconName });
    setSelectedCredential(permission.connection);
    setShowViewModal(true);
  };

  // Start editing permissions for existing integration
  const handleModifyPermissions = (permission: AgentPermission) => {
    setWorkflowMode('edit');
    setEditingPermission(permission);
    setSelectedCredential(permission.connection);
    
    // Set default scopes based on provider type if no existing scopes
    const providerName = permission.connection?.provider_name?.toLowerCase();
    const defaultScopes = providerName === 'gmail' ? DEFAULT_GMAIL_SCOPES :
                         (providerName?.includes('search') || 
                          providerName?.includes('serper') || 
                          providerName?.includes('serpapi') || 
                          providerName?.includes('brave')) ? DEFAULT_SEARCH_API_SCOPES : [];
    
    setSelectedScopes(permission.allowed_scopes || defaultScopes);
    setShowViewModal(false);
    setShowPermissionsModal(true);
  };

  const handleRevokePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase.rpc('revoke_agent_integration_permission', {
        p_permission_id: permissionId
      });

      if (error) throw error;
      toast.success(`${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'} removed`);
      fetchAgentPermissions();
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast.error(`Failed to remove ${category === 'channel' ? 'channel' : category === 'tool' ? 'tool' : 'integration'}`);
    }
  };

  // Get available integrations for this classification
  const availableIntegrations = integrations.filter(integration => 
    integration.status === 'available' && 
    !permissions.some(perm => perm.connection?.provider_name === integration.name)
  );

  // Filter permissions to only show those that match the current category
  const filteredPermissions = permissions.filter(permission => {
    const providerName = permission.connection?.provider_name?.toLowerCase();
    
    // Find the integration definition by matching provider name
    // Try multiple matching strategies to handle naming inconsistencies
    const integration = integrations.find(int => {
      const intName = int.name.toLowerCase();
      // Direct match
      if (intName === providerName) return true;
      // Gmail special cases: "gmail" provider should match "email" or "gmail" integration
      if (providerName === 'gmail' && (intName === 'email' || intName === 'gmail')) return true;
      // Email special case: "email" integration should match "gmail" or "sendgrid" providers
      if (intName === 'email' && (providerName === 'gmail' || providerName === 'sendgrid')) return true;
      // Search provider matching
      if ((providerName?.includes('search') || providerName?.includes('serper') || providerName?.includes('serpapi') || providerName?.includes('brave')) &&
          (intName.includes('search') || intName.includes('web'))) return true;
      return false;
    });
    
    // If we found the integration, use its agent_classification
    if (integration) {
      return integration.agent_classification === category;
    }
    
    // If no integration found, default based on provider name patterns
    // Gmail/SendGrid should be channels, Web Search should be tools
    if (providerName === 'gmail' || providerName === 'sendgrid') {
      return category === 'channel';
    }
    if (providerName?.includes('search') || 
        providerName?.includes('serper') || 
        providerName?.includes('serpapi') || 
        providerName?.includes('brave') ||
        providerName === 'web search') {
      return category === 'tool';
    }
    
    // Default: if we don't know what it is, show it in tools
    return category === 'tool';
  });

  // Get available credentials for selected integration
  const getAvailableCredentials = () => {
    if (!selectedIntegration) return [];
    
    const integrationId = selectedIntegration.id || selectedIntegration.name?.toLowerCase();
    // Centralized: unify from useConnections
    const providerMap: Record<string, string | null> = {
      'gmail': 'gmail',
      'serper-api': 'serper_api',
      'serper api': 'serper_api',
      'serpapi': 'serpapi',
      'brave-search-api': 'brave_search',
      'brave search api': 'brave_search',
      'web-search': null,
      'web search': null,
    }
    const provider = providerMap[integrationId as keyof typeof providerMap]
    return unifiedConnections
      .filter(c => c.connection_status === 'active' && (!provider || c.provider_name === provider))
      .filter(c => !permissions.some(perm => perm.user_oauth_connection_id === c.connection_id))
      .map(c => ({
        id: c.connection_id,
        external_username: c.external_username || c.connection_name || `${c.provider_display_name} Connection`,
        provider_display_name: c.provider_display_name,
        provider_name: c.provider_name,
        connection_metadata: {},
      }))
  };
  
  const availableCredentials = getAvailableCredentials();

  // Helper function to get the appropriate icon for each integration type
  const getIntegrationIcon = (providerName?: string) => {
    const provider = providerName?.toLowerCase();
    switch (provider) {
      case 'gmail':
        return <Mail className="h-5 w-5 text-blue-500" />;
      case 'serper api':
      case 'serpapi':
      case 'brave search api':
      case 'web search':
      case 'websearch':
        return <Search className="h-5 w-5 text-green-500" />;
      default:
        return <Settings className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading integrations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleAddIntegration}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}
          </Button>
        </CardHeader>
        <CardContent>
          {filteredPermissions.length > 0 ? (
            <div className="space-y-3">
              {filteredPermissions.map(permission => (
                <div key={permission.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded">
                      {getIntegrationIcon(permission.connection?.provider_name)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {(() => {
                          const providerName = permission.connection?.provider_name || permission.integration_name || 'Integration';
                          // Capitalize provider names for better display
                          if (providerName.toLowerCase() === 'gmail') return 'Gmail';
                          if (providerName.toLowerCase() === 'sendgrid') return 'SendGrid';
                          if (providerName.toLowerCase() === 'slack') return 'Slack';
                          if (providerName.toLowerCase() === 'discord') return 'Discord';
                          if (providerName.toLowerCase().includes('serper')) return 'Serper API';
                          if (providerName.toLowerCase().includes('serpapi')) return 'SerpAPI';
                          if (providerName.toLowerCase().includes('brave')) return 'Brave Search';
                          return providerName;
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {permission.connection?.external_username || permission.connection?.connection_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={permission.is_active ? "default" : "secondary"}>
                      {permission.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewCredentials(permission)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Settings className="h-10 w-10 mx-auto opacity-50 mb-2" />
              <p>No {category === 'channel' ? 'channels' : category === 'tool' ? 'tools' : 'integrations'} connected</p>
              <p className="text-xs mt-1">Add {category === 'channel' ? 'a channel' : category === 'tool' ? 'a tool' : 'an integration'} to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 1: Add Integration Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}</DialogTitle>
            <DialogDescription>
              Choose {category === 'channel' ? 'a channel' : category === 'tool' ? 'a tool' : 'an integration'} to connect to this agent
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(85vh-10rem)]">
            <div className="space-y-4 p-1">
              {availableIntegrations.length > 0 ? (
                availableIntegrations.map((integration: { id: string; name: string; description?: string }) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                    onClick={() => handleSelectIntegration(integration)}
                  >
                    <div className="flex items-center gap-3">
                      <Mail className="h-8 w-8 text-blue-500" />
                      <div>
                        <div className="font-medium">{integration.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {integration.description}
                        </div>
                        {capabilities[integration.id] && capabilities[integration.id].length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {capabilities[integration.id].map(c => (
                              <Badge key={c.capability_key} variant="secondary" className="text-xs">{c.display_label}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No new integrations available. Gmail is currently the only supported integration.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Select Credentials Modal */}
      <Dialog open={showCredentialsModal && workflowMode === 'add'} onOpenChange={setShowCredentialsModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCredentialsModal(false);
                  setShowAddModal(true);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              Select Credentials
            </DialogTitle>
            <DialogDescription>
              Choose which {selectedIntegration?.name} account to use
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto min-h-0 max-h-[calc(85vh-10rem)]">
            <div className="space-y-4 p-1">
              {availableCredentials.length > 0 ? (
                availableCredentials.map(credential => (
                  <div
                    key={credential.id}
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted"
                    onClick={() => handleSelectCredential(credential)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-background rounded">
                        {getIntegrationIcon(selectedIntegration?.name)}
                      </div>
                      <div>
                        <div className="font-medium">{credential.external_username}</div>
                        <div className="text-sm text-muted-foreground">
                          {credential.connection_metadata?.user_name || credential.provider_display_name || selectedIntegration?.name || 'API Account'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                ))
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No available credentials. Please connect {selectedIntegration?.name || 'this integration'} first in the{' '}
                    <a href="/integrations" className="text-primary hover:underline">
                      Integrations page
                    </a>
                    .
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCredentialsModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 3: Select Permissions Modal */}
      <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {workflowMode === 'add' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setShowCredentialsModal(true);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {workflowMode === 'edit' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPermissionsModal(false);
                    setShowViewModal(true);
                    setWorkflowMode('view');
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              {workflowMode === 'edit' ? 'Modify Permissions' : 'Set Permissions'}
            </DialogTitle>
            <DialogDescription>
              Choose what this agent can do with {selectedCredential?.external_username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Allowed Actions</Label>
              <div className="space-y-2">
                {(() => {
                  const integrationId = selectedIntegration?.id || selectedIntegration?.name?.toLowerCase() || '';
                  const isSearchAPI = integrationId.includes('serper') || integrationId.includes('serpapi') || integrationId.includes('brave') || integrationId.includes('search');
                  
                  if (isSearchAPI) {
                    return (
                      <>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes('web_search')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes([...selectedScopes, 'web_search']);
                              } else {
                                setSelectedScopes(selectedScopes.filter(s => s !== 'web_search'));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <Search className="h-4 w-4" />
                          Web search
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes('news_search')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes([...selectedScopes, 'news_search']);
                              } else {
                                setSelectedScopes(selectedScopes.filter(s => s !== 'news_search'));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <Search className="h-4 w-4" />
                          News search
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes('image_search')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes([...selectedScopes, 'image_search']);
                              } else {
                                setSelectedScopes(selectedScopes.filter(s => s !== 'image_search'));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <Search className="h-4 w-4" />
                          Image search
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedScopes.includes('local_search')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes([...selectedScopes, 'local_search']);
                              } else {
                                setSelectedScopes(selectedScopes.filter(s => s !== 'local_search'));
                              }
                            }}
                            className="rounded border-border"
                          />
                          <Search className="h-4 w-4" />
                          Local search
                        </label>
                      </>
                    );
                  } else {
                    // Gmail scopes
                    return (
                      <>
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
                            className="rounded border-border"
                          />
                          <Mail className="h-4 w-4" />
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
                            className="rounded border-border"
                          />
                          <Mail className="h-4 w-4" />
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
                            className="rounded border-border"
                          />
                          <Settings className="h-4 w-4" />
                          Modify emails (archive, labels, etc.)
                        </label>
                      </>
                    );
                  }
                })()}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={workflowMode === 'edit' ? handleUpdatePermission : handleGrantPermission} 
              disabled={selectedScopes.length === 0 || saving}
            >
              {saving ? (workflowMode === 'edit' ? 'Updating...' : 'Adding...') : (workflowMode === 'edit' ? 'Update Permissions' : `Add ${category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Detail Modal (for existing integrations) */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getIntegrationIcon(selectedIntegration?.name)}
              {selectedIntegration?.name || 'Integration'}
            </DialogTitle>
            <DialogDescription>
              Account: {selectedCredential?.external_username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Current Permissions</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {(() => {
                  const permission = permissions.find(p => p.connection?.external_username === selectedCredential?.external_username);
                  const scopes = permission?.allowed_scopes || [];
                  
                  return (
                    <>
                      {scopes.includes('https://www.googleapis.com/auth/gmail.readonly') && (
                        <div>• Read emails</div>
                      )}
                      {scopes.includes('https://www.googleapis.com/auth/gmail.send') && (
                        <div>• Send emails</div>
                      )}
                      {scopes.includes('https://www.googleapis.com/auth/gmail.modify') && (
                        <div>• Modify emails (archive, labels, etc.)</div>
                      )}
                      {scopes.length === 0 && (
                        <div>• No permissions granted</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                const permission = permissions.find(p => p.connection?.external_username === selectedCredential?.external_username);
                if (permission) {
                  handleRevokePermission(permission.id);
                  setShowViewModal(false);
                }
              }}
            >
              Remove {category === 'channel' ? 'Channel' : category === 'tool' ? 'Tool' : 'Integration'}
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                const permission = permissions.find(p => p.connection?.external_username === selectedCredential?.external_username);
                if (permission) {
                  handleModifyPermissions(permission);
                }
              }}
            >
              Modify Permissions
            </Button>
            <Button onClick={() => setShowViewModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 