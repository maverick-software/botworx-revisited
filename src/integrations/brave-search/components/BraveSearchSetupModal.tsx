import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';

/**
 * Brave Search API Integration Setup Modal
 * Handles Brave Search API key configuration for privacy-focused search
 */
export function BraveSearchSetupModal({
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
    api_key: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_key.trim()) {
      setError('Brave Search API Key is required');
      return false;
    }
    return true;
  };

  const handleBraveSearchSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get Brave Search service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'brave_search')
        .single();

      if (providerError) {
        throw new Error(`Brave Search provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `brave_search_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `Brave Search API key for ${formData.connection_name || 'Brave Search Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ Brave Search API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: 'brave_search_user',
          connection_name: formData.connection_name || 'Brave Search Connection',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['web_search', 'news_search', 'image_search'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store Brave Search-specific configuration
          connection_metadata: {
            provider: 'brave_search',
            base_url: 'https://api.search.brave.com/res/v1',
            privacy_focused: true
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create Brave Search connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'brave_search',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('Brave Search connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        api_key: ''
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Brave Search integration:', err);
      const errorMessage = err.message || 'Failed to setup Brave Search integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Brave Search');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-600 to-orange-700 flex items-center justify-center">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Brave Search</h2>
          <p className="text-muted-foreground">Connect Brave Search API for privacy-focused search</p>
        </div>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-orange-600" />
            <span>Brave Search Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Brave Search API key for privacy-focused search capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="connection_name"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder="My Brave Search Connection"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="api_key">
              API Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => handleInputChange('api_key', e.target.value)}
              placeholder="Your Brave Search API key"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your API key from the Brave Search API dashboard
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Setup Instructions:</strong> Sign up at{' '}
              <a href="https://api.search.brave.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                api.search.brave.com
              </a>
              {' '}and get your API key from the dashboard. Brave Search provides privacy-focused search results without tracking.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleBraveSearchSetup}
            disabled={loading || !formData.api_key}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Connect Brave Search
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Capabilities Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Agent Capabilities</span>
          </CardTitle>
          <CardDescription>
            What your agents will be able to do with Brave Search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Privacy-focused web search</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>News search without tracking</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Image search capabilities</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Independent search results</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <div className="text-center">
        <a 
          href="https://api.search.brave.com/app/documentation/web-search/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:text-primary/80 flex items-center justify-center"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          View Brave Search API Documentation
        </a>
      </div>
    </div>
  );
}
