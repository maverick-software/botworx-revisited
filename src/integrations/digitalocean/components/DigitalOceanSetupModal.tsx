import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Server, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Key,
  Cloud
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';

/**
 * DigitalOcean Integration Setup Modal
 * Handles DigitalOcean API token setup and credential storage
 */
export function DigitalOceanSetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user,
  supabase
}: IntegrationSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    connection_name: '',
    api_token: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_token.trim()) {
      setError('API Token is required');
      return false;
    }
    return true;
  };

  const handleSetupSubmit = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get DigitalOcean OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'digitalocean')
        .single();

      if (providerError) {
        throw new Error(`DigitalOcean provider not found: ${providerError.message}`);
      }

      // Store API token securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `digitalocean_api_token_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_token,
        `DigitalOcean API token for ${formData.connection_name || 'DigitalOcean Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ DigitalOcean API token securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.connection_name || 'DigitalOcean Connection',
          connection_name: formData.connection_name || 'DigitalOcean Connection',
          encrypted_access_token: null, // API token is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['droplet:read', 'droplet:create', 'droplet:delete', 'image:read', 'region:read', 'size:read'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store DigitalOcean-specific metadata
          metadata: {
            api_version: 'v2',
            base_url: 'https://api.digitalocean.com',
            permissions: ['Read Droplets', 'Create Droplets', 'Delete Droplets', 'Read Images', 'Read Regions', 'Read Sizes']
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'digitalocean',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('DigitalOcean API connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        api_token: ''
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up DigitalOcean integration:', err);
      const errorMessage = err.message || 'Failed to setup DigitalOcean integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup DigitalOcean integration');
    } finally {
      setLoading(false);
    }
  };

  // Note: Don't return null here - let the parent Dialog handle visibility
  // if (!isOpen) return null; // ❌ This destroys component state!

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Server className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup DigitalOcean</h2>
          <p className="text-muted-foreground">Connect your DigitalOcean account to manage cloud infrastructure</p>
        </div>
      </div>

      {/* API Token Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>DigitalOcean API Token</span>
          </CardTitle>
          <CardDescription>
            Connect your DigitalOcean account using an API token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>To get your DigitalOcean API token:</strong></p>
                <p>1. Go to <Button variant="link" className="p-0 h-auto" asChild>
                  <a href="https://cloud.digitalocean.com/account/api/tokens" target="_blank" rel="noopener noreferrer">
                    DigitalOcean API Tokens <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button></p>
                <p>2. Click "Generate New Token"</p>
                <p>3. Give it a name and select "Read" and "Write" scopes</p>
                <p>4. Copy the token and paste it below</p>
              </div>
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="connection_name"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder="My DigitalOcean Connection"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="api_token">
              API Token <span className="text-red-500">*</span>
            </Label>
            <Input
              id="api_token"
              type="password"
              value={formData.api_token}
              onChange={(e) => handleInputChange('api_token', e.target.value)}
              placeholder="dop_v1_..."
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your API token will be securely stored in Supabase Vault
            </p>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button
              onClick={handleSetupSubmit}
              disabled={loading || !formData.api_token}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Connect DigitalOcean
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Capabilities Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cloud className="h-5 w-5 text-green-500" />
            <span>Agent Capabilities</span>
          </CardTitle>
          <CardDescription>
            What your agents will be able to do with DigitalOcean
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>View and manage droplets</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Create new droplets</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Delete droplets</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Browse available images and regions</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Monitor infrastructure status</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Secure API key management</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
