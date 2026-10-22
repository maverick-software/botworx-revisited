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
    <div className="container mx-auto p-8 max-w-6xl">
      {/* Clean Header */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold tracking-tight">Credentials</h1>
          <Button onClick={refetch} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xl text-muted-foreground">
          Your integrations
        </p>
      </div>

      {connections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="p-4 bg-muted/50 rounded-full mb-6">
              <Shield className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No credentials yet</h3>
            <p className="text-lg text-muted-foreground text-center mb-8 max-w-md">
              Connect your first service to get started with integrations
            </p>
            <Button asChild size="lg" className="px-8">
              <a href="/integrations">
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect Services
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <Card key={connection.connection_id} className="border border-border/60 hover:border-border hover:shadow-sm transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-foreground">
                          {connection.provider_display_name || connection.provider_name}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className="text-xs font-medium"
                        >
                          {connection.credential_type === 'oauth' ? 'OAuth' : 'API Key'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {connection.external_username || connection.connection_name || 'Connected Account'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Badge 
                      className={`${getStatusColor(connection.connection_status)} font-medium`}
                    >
                      {connection.connection_status === 'active' ? 'Connected' : 
                       connection.connection_status === 'expired' ? 'Expired' :
                       connection.connection_status === 'revoked' ? 'Revoked' :
                       connection.connection_status}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(connection)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Modal - Clean & Organized */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4 text-blue-600" />
              </div>
              {selectedConnection?.provider_display_name || selectedConnection?.provider_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedConnection && (
            <div className="space-y-8 py-4">
              {/* Overview */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Account</h4>
                  <p className="text-muted-foreground">
                    {selectedConnection.external_username || selectedConnection.connection_name || 'N/A'}
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Status</h4>
                  <Badge className={getStatusColor(selectedConnection.connection_status)}>
                    {selectedConnection.connection_status}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Type</h4>
                  <Badge variant="outline" className="w-fit">
                    {selectedConnection.credential_type === 'oauth' ? 'OAuth Connection' : 'API Key'}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Connected</h4>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedConnection.created_at), 'MMM dd, yyyy')}
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-semibold text-foreground">Permissions</h4>
                  <Badge variant="secondary" className="ml-auto">
                    {selectedConnection.scopes_granted.length} granted
                  </Badge>
                </div>
                {selectedConnection.scopes_granted.length > 0 ? (
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex flex-wrap gap-2">
                      {selectedConnection.scopes_granted.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs font-medium">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No permissions granted</p>
                )}
              </div>

              {/* Token/API Key Info */}
              {selectedConnection.credential_type === 'oauth' && selectedConnection.token_expires_at && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Token Information</h4>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={getTokenExpiryColor(selectedConnection.token_expires_at, refreshStatus[selectedConnection.connection_id])}>
                        {formatExpiryDate(selectedConnection.token_expires_at, refreshStatus[selectedConnection.connection_id])}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedConnection.credential_type === 'api_key' && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">API Key Information</h4>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Expiry:</span>
                      <span className="text-foreground">Never expires</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-6 border-t">
                <div className="flex gap-3">
                  {selectedConnection.credential_type === 'oauth' && selectedConnection.connection_status !== 'expired' && (
                    <Button
                      variant="outline"
                      onClick={() => handleRefreshToken(selectedConnection.connection_id)}
                      disabled={refreshStatus[selectedConnection.connection_id]?.isRefreshing}
                    >
                      {refreshStatus[selectedConnection.connection_id]?.isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : refreshStatus[selectedConnection.connection_id]?.success ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {refreshStatus[selectedConnection.connection_id]?.isRefreshing 
                        ? 'Refreshing...' 
                        : refreshStatus[selectedConnection.connection_id]?.success
                        ? 'Refreshed!'
                        : 'Refresh Token'
                      }
                    </Button>
                  )}
                </div>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleRevokeConnection(selectedConnection.connection_id);
                    setShowDetailsModal(false);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Revoke Connection
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
