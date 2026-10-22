import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  FolderOpen, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Cloud,
  HardDrive,
  Settings,
  Upload,
  Download,
  Share,
  Search
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useConnections } from '@/integrations/_shared';
import { useAgentIntegrationPermissions } from '@/integrations/_shared/hooks/useAgentIntegrationPermissions';
import { toast } from 'react-hot-toast';

interface SourcesTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

interface CloudSource {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  status: 'configured' | 'not_configured';
  requiresAuth: string;
  features: string[];
}

interface OneDriveCredential {
  connection_id: string;
  external_username: string | null;
  connection_name: string | null;
  scopes_granted: string[];
  connection_status: string;
}

interface OneDrivePermission {
  id: string;
  connection_id: string;
  is_active: boolean;
  allowed_scopes: string[];
}

export function SourcesTab({ agentId, agentData, onAgentUpdated }: SourcesTabProps) {
  const { user } = useAuth();
  // supabase client imported directly
  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { permissions: agentPermissions, refetch: refetchPermissions } = useAgentIntegrationPermissions(agentId);

  // State
  const [onedriveCredentials, setOnedriveCredentials] = useState<OneDriveCredential[]>([]);
  const [onedrivePermissions, setOnedrivePermissions] = useState<OneDrivePermission[]>([]);
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  // Load OneDrive credentials and permissions
  useEffect(() => {
    loadOneDriveData();
  }, [user, agentId, connections, agentPermissions]);

  const loadOneDriveData = async () => {
    if (!user || !agentId) return;

    try {
      // Load OneDrive credentials
      const onedriveConnections = connections.filter(
        conn => conn.provider_name === 'microsoft-onedrive' && 
               conn.connection_status === 'active'
      );
      
      setOnedriveCredentials(onedriveConnections.map(conn => ({
        connection_id: conn.connection_id,
        external_username: conn.external_username,
        connection_name: conn.connection_name,
        scopes_granted: conn.scopes_granted || [],
        connection_status: conn.connection_status
      })));

      // Use hook data for OneDrive permissions instead of direct database query
      const onedrivePermissions = agentPermissions.filter(
        perm => perm.provider_name === 'microsoft-onedrive'
      );
      
      setOnedrivePermissions(onedrivePermissions.map(perm => ({
        id: perm.permission_id,
        connection_id: perm.connection_id,
        is_active: perm.is_active,
        allowed_scopes: perm.allowed_scopes || []
      })));
    } catch (error) {
      console.error('Error loading OneDrive data:', error);
    }
  };

  const handleConfigureOneDrive = () => {
    if (onedriveCredentials.length === 0) {
      toast.error('No OneDrive connections found. Please connect your OneDrive account first from the Credentials page.');
      return;
    }
    setShowOneDriveModal(true);
  };

  const handleGrantOneDrivePermission = async () => {
    if (!selectedCredential || selectedScopes.length === 0) {
      toast.error('Please select a credential and at least one permission');
      return;
    }

    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: selectedCredential,
        p_allowed_scopes: selectedScopes,
        p_permission_level: 'custom',
        p_user_id: user.id
      });

      if (error) {
        console.error('Error granting OneDrive permission:', error);
        toast.error('Failed to grant OneDrive permission');
      } else {
        toast.success('OneDrive permission granted successfully');
        await refetchPermissions(); // Use hook's refetch instead
        await loadOneDriveData();
        setShowOneDriveModal(false);
        setSelectedCredential('');
        setSelectedScopes([]);
      }
    } catch (error) {
      console.error('Error granting OneDrive permission:', error);
      toast.error('Failed to grant OneDrive permission');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeOneDrivePermission = async (permissionId: string) => {
    try {
      const { error } = await supabase.rpc('revoke_agent_integration_permission', {
        p_permission_id: permissionId
      });

      if (error) {
        console.error('Error revoking OneDrive permission:', error);
        toast.error('Failed to revoke OneDrive permission');
      } else {
        toast.success('OneDrive permission revoked successfully');
        await refetchPermissions(); // Use hook's refetch instead
        await loadOneDriveData();
      }
    } catch (error) {
      console.error('Error revoking OneDrive permission:', error);
      toast.error('Failed to revoke OneDrive permission');
    }
  };

  // Map OneDrive OAuth scopes to capabilities
  const mapOneDriveScopes = (scopes: string[]): string[] => {
    const capabilities: string[] = [];
    
    if (scopes.includes('https://graph.microsoft.com/Files.Read') || 
        scopes.includes('https://graph.microsoft.com/Files.Read.All')) {
      capabilities.push('files.read');
    }
    if (scopes.includes('https://graph.microsoft.com/Files.ReadWrite') || 
        scopes.includes('https://graph.microsoft.com/Files.ReadWrite.All')) {
      capabilities.push('files.write');
    }
    if (scopes.includes('https://graph.microsoft.com/Sites.Read.All')) {
      capabilities.push('sites.read');
    }
    if (scopes.includes('https://graph.microsoft.com/Sites.ReadWrite.All')) {
      capabilities.push('sites.write');
    }
    
    return capabilities.length > 0 ? capabilities : ['files.read'];
  };

  const getOneDriveStatus = (): { enabled: boolean; status: 'configured' | 'not_configured'; statusText: string } => {
    if (onedrivePermissions.length > 0) {
      return { enabled: true, status: 'configured', statusText: 'Connected' };
    }
    if (onedriveCredentials.length > 0) {
      return { enabled: false, status: 'not_configured', statusText: 'Available' };
    }
    return { enabled: false, status: 'not_configured', statusText: 'Not Connected' };
  };

  const onedriveStatus = getOneDriveStatus();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Cloud Storage Sources</h3>
        <p className="text-sm text-muted-foreground">
          Connect your agent to cloud storage services for document access and file operations.
        </p>
      </div>

      {/* OneDrive Integration */}
      <Card className={onedriveStatus.enabled ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-lg ${onedriveStatus.enabled ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">Microsoft OneDrive</h4>
                  <Badge variant={onedriveStatus.enabled ? "default" : "outline"} className="text-xs">
                    {onedriveStatus.enabled ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {onedriveStatus.statusText}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {onedriveStatus.statusText}
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Access files and documents from Microsoft OneDrive with secure OAuth authentication.
                </p>
                {onedriveStatus.enabled && onedrivePermissions.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowPermissions(!showPermissions)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center gap-1"
                    >
                      View Available Tools ({onedrivePermissions.reduce((count, perm) => count + mapOneDriveScopes(perm.allowed_scopes).length, 0)})
                      <div className={`transform transition-transform text-[10px] ${showPermissions ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </button>
                    {showPermissions && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {onedrivePermissions.map((perm) => {
                          const capabilities = mapOneDriveScopes(perm.allowed_scopes);
                          return capabilities.map((cap) => (
                            <Badge key={`${perm.id}-${cap}`} variant="secondary" className="text-xs">
                              {cap.replace('files.', 'Files ').replace('sites.', 'Sites ')}
                            </Badge>
                          ));
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleConfigureOneDrive}
                disabled={onedriveCredentials.length === 0}
              >
                <Settings className="w-4 h-4 mr-1" />
                {onedriveStatus.enabled ? 'Manage' : 'Configure'}
              </Button>
              {onedriveStatus.enabled && onedrivePermissions.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleRevokeOneDrivePermission(onedrivePermissions[0].id)}
                >
                  Disconnect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coming Soon Sources */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            Additional Cloud Storage (Coming Soon)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Google Drive', icon: Cloud, features: ['File Access', 'Shared Documents', 'Version History'] },
              { name: 'Dropbox', icon: Cloud, features: ['File Sync', 'Shared Folders', 'File History'] },
              { name: 'Box', icon: HardDrive, features: ['Enterprise Security', 'Workflow Integration', 'Advanced Permissions'] },
              { name: 'SharePoint', icon: HardDrive, features: ['Team Sites', 'Document Libraries', 'Workflows'] }
            ].map((source) => {
          const Icon = source.icon;
          return (
                <div key={source.name} className="p-4 border rounded-lg bg-background/50 opacity-60">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <h5 className="font-medium text-sm">{source.name}</h5>
                        <Badge variant="outline" className="text-xs">
                          Coming Soon
                        </Badge>
                      </div>
                  <div className="flex flex-wrap gap-1">
                          {source.features.map((feature) => (
                            <Badge key={feature} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
              );
            })}
                </div>
              </CardContent>
            </Card>

      {/* OneDrive Configuration Modal */}
      <Dialog open={showOneDriveModal} onOpenChange={setShowOneDriveModal}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden bg-background border-0 shadow-2xl rounded-2xl flex flex-col">
          <DialogHeader className="pb-4 border-b border-border/50 flex-shrink-0">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              Configure OneDrive Access
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Grant your agent access to specific OneDrive capabilities using your connected Microsoft account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto flex-1 pr-2 pb-4">
            {/* Credential Selection */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-foreground">Select OneDrive Account</Label>
              <div className="space-y-3">
                {onedriveCredentials.map((cred) => (
                  <div key={cred.connection_id} className="relative">
                    <input
                      type="radio"
                      id={cred.connection_id}
                      name="onedrive-credential"
                      value={cred.connection_id}
                      checked={selectedCredential === cred.connection_id}
                      onChange={(e) => setSelectedCredential(e.target.value)}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor={cred.connection_id} 
                      className="flex items-center gap-4 p-4 rounded-xl border-2 border-border/30 bg-card/50 hover:bg-card cursor-pointer transition-all duration-200 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-950/20 peer-checked:shadow-sm"
                    >
                      <div className="w-3 h-3 rounded-full border-2 border-border peer-checked:border-blue-500 peer-checked:bg-blue-500 transition-all duration-200"></div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {cred.connection_name || cred.external_username || 'Microsoft OneDrive Connection'}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {cred.scopes_granted.length} permissions available
                    </div>
                  </div>
                    </label>
                  </div>
                ))}
                    </div>
                  </div>

            {/* Scope Selection */}
            {selectedCredential && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">Select Permissions</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const selectedCred = onedriveCredentials.find(c => c.connection_id === selectedCredential);
                        const availableScopes = selectedCred?.scopes_granted || [];
                        if (selectedScopes.length === availableScopes.length) {
                          setSelectedScopes([]); // Deselect all
                        } else {
                          setSelectedScopes(availableScopes); // Select all
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      {(() => {
                        const selectedCred = onedriveCredentials.find(c => c.connection_id === selectedCredential);
                        const availableScopes = selectedCred?.scopes_granted || [];
                        return selectedScopes.length === availableScopes.length ? 'Deselect All' : 'Select All';
                      })()}
                    </button>
                </div>
      </div>

                {/* Dropdown Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPermissions(!showPermissions)}
                  className="w-full flex items-center justify-between p-3 bg-card/50 border border-border/50 rounded-lg hover:bg-card transition-colors"
                >
                  <span className="text-sm font-medium">
                    {selectedScopes.length > 0 
                      ? `${selectedScopes.length} permissions selected`
                      : 'Click to select permissions'
                    }
                  </span>
                  <div className={`transform transition-transform ${showPermissions ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </button>
                
                {/* Collapsible Permissions List */}
                {showPermissions && (
                  <div className="bg-card/30 border border-border/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                    {(() => {
                      const selectedCred = onedriveCredentials.find(c => c.connection_id === selectedCredential);
                      const availableScopes = selectedCred?.scopes_granted || [];
                      
                      // Map all possible scopes to their display info
                      const scopeDisplayMap: Record<string, { label: string; description: string }> = {
                        'https://graph.microsoft.com/Files.Read': { 
                          label: 'Read Files', 
                          description: 'Access and read your files' 
                        },
                        'https://graph.microsoft.com/Files.ReadWrite': { 
                          label: 'Read and Write Files', 
                          description: 'Create, edit, and manage your files' 
                        },
                        'https://graph.microsoft.com/Files.Read.All': { 
                          label: 'Read All Files', 
                          description: 'Access all files you have permission to read' 
                        },
                        'https://graph.microsoft.com/Files.ReadWrite.All': { 
                          label: 'Full File Access', 
                          description: 'Complete access to all your files and folders' 
                        },
                        'https://graph.microsoft.com/Sites.Read.All': { 
                          label: 'Read SharePoint Sites', 
                          description: 'Access SharePoint sites and libraries' 
                        },
                        'https://graph.microsoft.com/Sites.ReadWrite.All': { 
                          label: 'Write SharePoint Sites', 
                          description: 'Create and modify SharePoint sites and libraries' 
                        },
                        'https://graph.microsoft.com/User.Read': { 
                          label: 'Read User Profile', 
                          description: 'Access your basic profile information' 
                        }
                      };
                      
                      return availableScopes.map((scope) => {
                        const displayInfo = scopeDisplayMap[scope] || { 
                          label: scope.split('/').pop() || scope, 
                          description: 'Microsoft Graph permission' 
                        };
                        
                        return (
                          <div key={scope} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md transition-colors">
                            <input
                              type="checkbox"
                              id={`scope-${scope}`}
                              checked={selectedScopes.includes(scope)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedScopes([...selectedScopes, scope]);
                                } else {
                                  setSelectedScopes(selectedScopes.filter(s => s !== scope));
                                }
                              }}
                              className="w-4 h-4 rounded border-border"
                            />
                            <label htmlFor={`scope-${scope}`} className="flex-1 cursor-pointer">
                              <div className="text-sm font-medium text-foreground">{displayInfo.label}</div>
                              <div className="text-xs text-muted-foreground">{displayInfo.description}</div>
                            </label>
                </div>
          );
                      });
                    })()}
                    </div>
            </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  {selectedScopes.length} of {(() => {
                    const selectedCred = onedriveCredentials.find(c => c.connection_id === selectedCredential);
                    return selectedCred?.scopes_granted.length || 0;
                  })()} permissions selected
            </div>
          </div>
            )}

          </div>
          
          {/* Actions - Fixed at bottom */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50 bg-background flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setShowOneDriveModal(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGrantOneDrivePermission}
              disabled={loading || !selectedCredential || selectedScopes.length === 0}
              className="px-6 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Granting Access...
                </div>
              ) : (
                'Grant Access'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
