import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
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
 * Serper API Integration Setup Modal
 * Handles Serper API key configuration for web search
 */
export function SerperAPISetupModal({
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
      setError('Serper API Key is required');
      return false;
    }
    return true;
  };

  const handleSerperSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get Serper API service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'serper_api')
        .single();

      if (providerError) {
        throw new Error(`Serper API provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `serper_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `Serper API key for ${formData.connection_name || 'Serper API Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ Serper API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: 'serper_user',
          connection_name: formData.connection_name || 'Serper API Connection',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['web_search', 'news_search', 'image_search', 'local_search'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store Serper-specific configuration
          connection_metadata: {
            provider: 'serper',
            base_url: 'https://google.serper.dev',
            search_types: ['search', 'news', 'images', 'places']
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create Serper API connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'serper_api',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('Serper API connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        api_key: ''
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Serper API integration:', err);
      const errorMessage = err.message || 'Failed to setup Serper API integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Serper API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Search className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Serper API</h2>
          <p className="text-muted-foreground">Connect Serper API for fast Google search results</p>
        </div>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-blue-500" />
            <span>Serper API Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Serper API key for web search capabilities
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
              placeholder="My Serper API Connection"
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
              placeholder="Your Serper API key"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Get your API key from the Serper dashboard
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Setup Instructions:</strong> Sign up at{' '}
              <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                serper.dev
              </a>
              {' '}and get your API key from the dashboard. Serper provides fast Google search results with generous free tier.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleSerperSetup}
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
                Connect Serper API
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
            What your agents will be able to do with Serper API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Fast Google web search</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>News search and monitoring</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Image search capabilities</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Local business search</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <div className="text-center">
        <a 
          href="https://serper.dev/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:text-primary/80 flex items-center justify-center"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          View Serper API Documentation
        </a>
      </div>
    </div>
  );
}
