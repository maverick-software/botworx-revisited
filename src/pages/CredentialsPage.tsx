import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useConnections } from '@/integrations/_shared';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RefreshCw, Trash2, CheckCircle, Shield, Key, ExternalLink, Eye, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

// Using centralized service types via hook
interface OAuthConnection {
  connection_id: string;
  provider_name: string;
  provider_display_name: string;
  external_username: string | null;
  connection_name: string | null;
  scopes_granted: string[];
  connection_status: string;
  credential_type: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RefreshStatus {
  [connectionId: string]: {
    isRefreshing: boolean;
    success: boolean;
    message: string;
    newExpiryDate?: string;
    needsReconnection?: boolean;
  };
}

export function CredentialsPage() {
  const { user } = useAuth();
  const { connections: unifiedConnections, loading: loadingUnified, revoke: revokeUnified, remove: removeUnified, refetch } = useConnections({ includeRevoked: false });
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>({});
  const [selectedConnection, setSelectedConnection] = useState<OAuthConnection | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // Use the unified connections hook
  const connections = unifiedConnections.map((conn: any) => ({
    connection_id: conn.connection_id,
    provider_name: conn.provider_name,
    provider_display_name: conn.provider_display_name,
    external_username: conn.external_username ?? null,
    connection_name: conn.connection_name ?? null,
    scopes_granted: conn.scopes_granted || [],
    connection_status: conn.connection_status,
    credential_type: conn.credential_type,
    token_expires_at: conn.token_expires_at ?? null,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  }));
  
  const loading = loadingUnified;

  const handleViewDetails = (connection: OAuthConnection) => {
    setSelectedConnection(connection);
    setShowDetailsModal(true);
  };

  const handleRefreshToken = async (connectionId: string) => {
    try {
      setRefreshStatus(prev => ({
        ...prev,
        [connectionId]: {
          isRefreshing: true,
          success: false,
          message: 'Refreshing token...'
        }
      }));

      console.log('Starting token refresh for connection:', connectionId);
      
      const connection = connections.find(c => c.connection_id === connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      const { data, error } = await supabase.functions.invoke('oauth-refresh', {
        body: {
          connection_id: connectionId
        }
      });

      if (error) {
        console.error('OAuth refresh error:', error);
        throw error;
      }

      const expiryDate = data?.expires_at ? new Date(data.expires_at) : null;
      setRefreshStatus(prev => ({
        ...prev,
        [connectionId]: {
          isRefreshing: false,
          success: true,
          message: 'Success!',
          newExpiryDate: expiryDate?.toISOString()
        }
      }));

      await refetch();
      
      setTimeout(() => {
        setRefreshStatus(prev => ({
          ...prev,
          [connectionId]: {
            isRefreshing: false,
            success: false,
            message: ''
          }
        }));
      }, 3000);

    } catch (error) {
      console.error('Error refreshing token:', error);
      setRefreshStatus(prev => ({
        ...prev,
        [connectionId]: {
          isRefreshing: false,
          success: false,
          message: 'Failed to refresh token'
        }
      }));
    }
  };

  const handleRevokeConnection = async (connectionId: string) => {
    if (confirm('Are you sure you want to revoke this connection? This action cannot be undone.')) {
      try {
        await revokeUnified(connectionId);
        await refetch();
      } catch (error) {
        console.error('Error revoking connection:', error);
      }
    }
  };

  const handleClearCache = async () => {
    if (!user?.id) {
      toast.error('Unable to clear cache: missing user information');
      return;
    }

    setClearingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('invalidate-agent-tool-cache', {
        body: {
          user_id: user.id
        }
      });

      if (error) {
        console.error('Cache clear error:', error);
        toast.error('Failed to clear tool cache');
        return;
      }

      if (data?.success) {
        toast.success(`Tool cache cleared! (${data.tools_count} tools refreshed)`);
        // Refresh connections after clearing cache
        refetch();
      } else {
        toast.error(data?.error || 'Failed to clear cache');
      }
    } catch (error: any) {
      console.error('Cache clear error:', error);
      toast.error('Failed to clear tool cache');
    } finally {
      setClearingCache(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'expired':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'revoked':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTokenExpiryColor = (expiresAt: string | null, refreshStatus?: any): string => {
    if (refreshStatus?.success) return 'text-green-600';
    if (!expiresAt) return 'text-muted-foreground';
    const isExpired = new Date(expiresAt) <= new Date();
    return isExpired ? 'text-red-600' : 'text-green-600';
  };

  const formatExpiryDate = (expiresAt: string | null, refreshStatus?: any): string => {
    const dateToFormat = refreshStatus?.newExpiryDate || expiresAt;
    
    if (!dateToFormat) return 'No expiry information';
    
    const date = new Date(dateToFormat);
    const now = new Date();
    
    if (date <= now) {
      return `Expired ${format(date, 'MMM dd, yyyy')}`;
    } else {
      return `Expires ${format(date, 'MMM dd, yyyy')}`;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Compact Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-semibold">Credentials</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="p-1.5 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
              title="Clear tool cache (refreshes credential tools and schemas)"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${clearingCache ? 'animate-spin' : ''}`} />
            </button>
            <Button onClick={refetch} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your OAuth connections and API credentials stored securely in the vault
        </p>
      </div>

      {connections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium mb-2">No credentials found</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
              Connect services from the Integrations page
            </p>
            <Button asChild size="sm">
              <a href="/integrations">
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Integrations
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => (
            <Card key={connection.connection_id} className="border hover:bg-muted/20 transition-colors">
              <CardContent className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-foreground">
                          {connection.provider_display_name || connection.provider_name}
                        </h3>
                        <Badge variant="secondary" className="text-xs h-5 px-2">
                          {connection.credential_type === 'oauth' ? 'OAuth' : 'API Key'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {connection.external_username || connection.connection_name || 'Connected Account'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs h-6 px-2 ${getStatusColor(connection.connection_status)}`}
                    >
                      {connection.connection_status === 'active' ? 'Active' : 
                       connection.connection_status === 'expired' ? 'Expired' :
                       connection.connection_status === 'revoked' ? 'Revoked' :
                       connection.connection_status}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(connection)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0 bg-background border-border !rounded-xl !border-border !bg-background">
          {selectedConnection && (
            <div className="relative overflow-hidden bg-background">
              {/* Header */}
              <div className="px-6 py-4 bg-muted/30 border-b border-border">
                <h4 className="font-semibold text-lg flex items-center text-foreground">
                  <Shield className="h-5 w-5 mr-2 text-muted-foreground" />
                  {selectedConnection.provider_display_name || selectedConnection.provider_name}
                </h4>
                <p className="text-muted-foreground text-sm mt-1">
                  {selectedConnection.external_username || selectedConnection.connection_name || 'Connection Details'}
                </p>
              </div>

              {/* Connection Status Bar */}
              <div className="px-6 py-3 bg-muted/10 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs h-6 px-3 ${
                        selectedConnection.connection_status === 'active' 
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700' 
                          : selectedConnection.connection_status === 'expired'
                          ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                          : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                      }`}
                    >
                      {selectedConnection.connection_status === 'active' ? '✅ Active' : 
                       selectedConnection.connection_status === 'expired' ? '⚠️ Expired' :
                       selectedConnection.connection_status === 'revoked' ? '❌ Revoked' :
                       selectedConnection.connection_status}
                    </Badge>
                    <Badge variant="outline" className="text-xs h-6 px-3">
                      {selectedConnection.credential_type === 'oauth' ? 'OAuth' : 'API Key'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Connected {format(new Date(selectedConnection.created_at), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Permissions Section */}
                <div className="bg-muted/20 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium flex items-center gap-2 text-foreground">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      Permissions
                    </h5>
                    <Badge variant="secondary" className="text-xs h-5 px-2">
                      {selectedConnection.scopes_granted.length} granted
                    </Badge>
                  </div>
                  {selectedConnection.scopes_granted.length > 0 ? (
                    <div className="bg-muted/30 rounded-md p-3 border border-border/50">
                      <div className="flex flex-wrap gap-2">
                        {selectedConnection.scopes_granted.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs h-6 px-3">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No permissions granted</p>
                  )}
                </div>

                {/* Token/API Key Info */}
                {selectedConnection.credential_type === 'oauth' && selectedConnection.token_expires_at && (
                  <div className="bg-muted/20 rounded-lg border border-border p-4">
                    <h5 className="font-medium flex items-center gap-2 text-foreground mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      Token Status
                    </h5>
                    <div className="bg-muted/30 rounded-md p-3 border border-border/50">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expires:</span>
                        <span className={`font-medium ${getTokenExpiryColor(selectedConnection.token_expires_at, refreshStatus[selectedConnection.connection_id])}`}>
                          {formatExpiryDate(selectedConnection.token_expires_at, refreshStatus[selectedConnection.connection_id])}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedConnection.credential_type === 'api_key' && (
                  <div className="bg-muted/20 rounded-lg border border-border p-4">
                    <h5 className="font-medium flex items-center gap-2 text-foreground mb-3">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      API Key Status
                    </h5>
                    <div className="bg-muted/30 rounded-md p-3 border border-border/50">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expiry:</span>
                        <span className="font-medium text-green-600 dark:text-green-400">Never expires</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between pt-4 border-t border-border">
                  {selectedConnection.credential_type === 'oauth' && selectedConnection.connection_status !== 'expired' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshToken(selectedConnection.connection_id)}
                      disabled={refreshStatus[selectedConnection.connection_id]?.isRefreshing}
                    >
                      {refreshStatus[selectedConnection.connection_id]?.isRefreshing ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-2" />
                      ) : refreshStatus[selectedConnection.connection_id]?.success ? (
                        <CheckCircle className="h-3 w-3 mr-2 text-green-500" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-2" />
                      )}
                      {refreshStatus[selectedConnection.connection_id]?.isRefreshing 
                        ? 'Refreshing...' 
                        : refreshStatus[selectedConnection.connection_id]?.success
                        ? 'Refreshed!'
                        : 'Refresh Token'
                      }
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      handleRevokeConnection(selectedConnection.connection_id);
                      setShowDetailsModal(false);
                    }}
                    className="ml-auto"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Revoke Connection
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
