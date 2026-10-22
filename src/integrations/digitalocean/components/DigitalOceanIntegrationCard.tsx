import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Server, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Eye, 
  EyeOff,
  Loader2
} from 'lucide-react';
import { useDigitalOceanConnection } from '../hooks/useDigitalOceanIntegration';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { VaultService } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';

interface DigitalOceanIntegrationCardProps {
  onConnectionSuccess?: () => void;
}

export function DigitalOceanIntegrationCard({ onConnectionSuccess }: DigitalOceanIntegrationCardProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const { connections, loading, refetch } = useDigitalOceanConnection();
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Setup form state
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');

  const handleSetupSubmit = async () => {
    if (!user || !apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get DigitalOcean OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'digitalocean')
        .single();

      if (providerError) throw providerError;

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `digitalocean_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        apiKey,
        `DigitalOcean API key - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ DigitalOcean API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: connectionName || 'DigitalOcean Connection',
          connection_name: connectionName || 'DigitalOcean Connection',
          encrypted_access_token: null,
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['droplet:read', 'image:read', 'region:read', 'size:read'],
          connection_status: 'active',
          credential_type: 'api_key'
        });

      if (insertError) throw insertError;

      toast.success('DigitalOcean API key connected successfully! 🎉');
      
      // Reset form and refresh connections
      setApiKey('');
      setConnectionName('');
      setIsSetupMode(false);
      refetch();
      onConnectionSuccess?.();

    } catch (err: any) {
      console.error('Error connecting DigitalOcean API key:', err);
      setError(err.message || 'Failed to connect DigitalOcean API key');
      toast.error('Failed to connect DigitalOcean API key');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_integration_credentials')
        .update({ connection_status: 'revoked' })
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('DigitalOcean connection removed');
      refetch();
    } catch (err: any) {
      console.error('Error disconnecting:', err);
      toast.error('Failed to remove connection');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Server className="h-5 w-5 text-blue-500" />
          <span>DigitalOcean</span>
        </CardTitle>
        <CardDescription>
          Connect your DigitalOcean account to manage droplets and infrastructure
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {connections.length === 0 ? (
          // No connections - show setup
          <div className="space-y-4">
            {!isSetupMode ? (
              <div className="text-center py-6">
                <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No DigitalOcean connections found
                </p>
                <Button onClick={() => setIsSetupMode(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Connect DigitalOcean
                </Button>
              </div>
            ) : (
              // Setup form
              <div className="space-y-4">
                <div>
                  <Label htmlFor="connection_name">Connection Name (Optional)</Label>
                  <Input
                    id="connection_name"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    placeholder="My DigitalOcean Connection"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="api_key">DigitalOcean API Token</Label>
                  <div className="relative mt-1">
                    <Input
                      id="api_key"
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your DigitalOcean API token"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Required scopes:</strong> Read access to droplets, images, regions, and sizes</p>
                      <p>
                        <Button variant="link" className="p-0 h-auto" asChild>
                          <a 
                            href="https://cloud.digitalocean.com/account/api/tokens" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            Get API Token <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex space-x-2">
                  <Button
                    onClick={handleSetupSubmit}
                    disabled={!apiKey || isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Server className="h-4 w-4 mr-2" />
                        Connect DigitalOcean
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSetupMode(false);
                      setError(null);
                      setApiKey('');
                      setConnectionName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Show connected accounts
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Connected Accounts</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSetupMode(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another
              </Button>
            </div>

            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">{connection.external_username}</p>
                    <p className="text-sm text-muted-foreground">
                      Connected {new Date(connection.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">Active</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(connection.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            {isSetupMode && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-4">
                  <h5 className="font-medium">Add Another Connection</h5>
                  
                  <div>
                    <Label htmlFor="new_connection_name">Connection Name</Label>
                    <Input
                      id="new_connection_name"
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                      placeholder="Another DigitalOcean Connection"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="new_api_key">API Token</Label>
                    <div className="relative mt-1">
                      <Input
                        id="new_api_key"
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter API token"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleSetupSubmit}
                      disabled={!apiKey || isConnecting}
                      size="sm"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsSetupMode(false);
                        setError(null);
                        setApiKey('');
                        setConnectionName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Capabilities:</strong> Create and manage droplets, view images, regions, and sizes
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
