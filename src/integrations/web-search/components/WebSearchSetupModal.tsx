import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  ExternalLink,
  Key
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';

// Search providers for Web Search integration
const SEARCH_PROVIDERS = [
  { 
    id: 'serper_api', 
    name: 'Serper API', 
    setupUrl: 'https://serper.dev/api-key', 
    rateLimit: '1,000 queries/month free',
    description: 'Google search results with rich snippets and knowledge graph'
  },
  { 
    id: 'serpapi', 
    name: 'SerpAPI', 
    setupUrl: 'https://serpapi.com/manage-api-key', 
    rateLimit: '100 queries/month free',
    description: 'Multiple search engines with location-based results'
  },
  { 
    id: 'brave_search', 
    name: 'Brave Search API', 
    setupUrl: 'https://api.search.brave.com/app/keys', 
    rateLimit: '2,000 queries/month free',
    description: 'Privacy-focused search with independent index'
  }
];

/**
 * Web Search Integration Setup Modal
 * Handles web search provider selection and API key setup
 */
export function WebSearchSetupModal({
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
    api_key: '',
    selected_provider: 'serper_api',
    default_location: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_key.trim()) {
      setError('API Key is required');
      return false;
    }
    return true;
  };

  const handleWebSearchSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get the selected provider info
      const selectedProvider = SEARCH_PROVIDERS.find(p => p.id === formData.selected_provider);
      if (!selectedProvider) {
        throw new Error('Invalid search provider selected');
      }

      // Get OAuth provider for the selected search provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', formData.selected_provider)
        .single();

      if (providerError) {
        throw new Error(`${selectedProvider.name} provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `${formData.selected_provider}_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `${selectedProvider.name} API key for ${formData.connection_name || 'Web Search'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ ${selectedProvider.name} API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.connection_name || `${selectedProvider.name} Connection`,
          connection_name: formData.connection_name || `${selectedProvider.name} Connection`,
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['web_search', 'news_search', 'image_search', 'local_search'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store web search-specific metadata
          metadata: {
            provider: formData.selected_provider,
            provider_name: selectedProvider.name,
            default_location: formData.default_location,
            rate_limit: selectedProvider.rateLimit
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
        provider_name: formData.selected_provider,
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success(`${selectedProvider.name} connected successfully! 🎉`);
      
      // Reset form
      setFormData({
        connection_name: '',
        api_key: '',
        selected_provider: 'serper_api',
        default_location: ''
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Web Search integration:', err);
      const errorMessage = err.message || 'Failed to setup Web Search integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Web Search');
    } finally {
      setLoading(false);
    }
  };

  // Note: Don't return null here - let the parent Dialog handle visibility
  // if (!isOpen) return null; // ❌ This destroys component state!

  const selectedProvider = SEARCH_PROVIDERS.find(p => p.id === formData.selected_provider);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
          <Search className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Web Search</h2>
          <p className="text-muted-foreground">Choose a search provider and configure API access</p>
        </div>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>API Key Configuration</span>
          </CardTitle>
          <CardDescription>
            Choose a search provider and enter your API key to enable web search functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Provider Selection */}
          <div>
            <Label htmlFor="provider_select">
              Search Provider <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.selected_provider} 
              onValueChange={(value) => handleInputChange('selected_provider', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose your search provider" />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} - {provider.rateLimit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedProvider?.description}
            </p>
          </div>

          <div>
            <Label htmlFor="connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="connection_name"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder={`My ${selectedProvider?.name} Connection`}
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
              placeholder="Enter your API key"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your API key will be securely encrypted and stored
            </p>
            {selectedProvider && (
              <div className="mt-2">
                <a
                  href={selectedProvider.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Get API Key from {selectedProvider.name}
                </a>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="default_location">
              Default Location (Optional)
            </Label>
            <Input
              id="default_location"
              value={formData.default_location}
              onChange={(e) => handleInputChange('default_location', e.target.value)}
              placeholder="e.g., New York, NY"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Default location for localized search results
            </p>
          </div>

          <Button
            onClick={handleWebSearchSetup}
            disabled={loading || !formData.api_key}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Connect {selectedProvider?.name || 'Web Search'}
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
            What your agents will be able to do with Web Search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Search the web for real-time information</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Get news and current events data</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Location-based search results</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Secure API key storage</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
