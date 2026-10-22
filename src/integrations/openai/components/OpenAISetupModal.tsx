import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Key, 
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
 * OpenAI API Integration Setup Modal
 * Handles OpenAI API key configuration for GPT models
 */
export function OpenAISetupModal({
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
    connection_name: 'OpenAI API',
    api_key: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_key.trim()) {
      setError('OpenAI API Key is required');
      return false;
    }
    
    if (!formData.api_key.startsWith('sk-')) {
      setError('Invalid OpenAI API key format. Key must start with "sk-"');
      return false;
    }
    
    return true;
  };

  const handleOpenAISetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get OpenAI service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'openai')
        .single();

      if (providerError) {
        throw new Error(`OpenAI provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `openai_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `OpenAI API key for ${formData.connection_name} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ OpenAI API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.connection_name,
          connection_name: formData.connection_name,
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['chat', 'completion', 'embeddings', 'tools'],
          connection_status: 'active',
          credential_type: 'api_key',
          connection_metadata: {
            provider: 'openai',
            api_base_url: 'https://api.openai.com/v1',
            models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo']
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create connection: ${insertError.message}`);
      }

      console.log('✅ OpenAI connection created:', connectionData.id);

      toast.success('OpenAI API key connected successfully! 🤖');
      
      if (onSuccess) {
        onSuccess(connectionData);
      }
      
      onClose();
    } catch (err: any) {
      console.error('❌ OpenAI setup error:', err);
      setError(err.message || 'Failed to connect OpenAI API');
      toast.error('Failed to connect OpenAI API');
      
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Key className="h-6 w-6 text-primary" />
          <div>
            <CardTitle>Connect OpenAI API</CardTitle>
            <CardDescription>
              Add your OpenAI API key to enable GPT models for your agents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">To get your OpenAI API key:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center">
                  OpenAI API Keys <ExternalLink className="h-3 w-3 ml-1" />
                </a></li>
                <li>Click "Create new secret key"</li>
                <li>Copy the key (starts with "sk-")</li>
                <li>Paste it below</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="connection_name">Connection Name</Label>
            <Input
              id="connection_name"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder="OpenAI API"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">OpenAI API Key *</Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => handleInputChange('api_key', e.target.value)}
              placeholder="sk-..."
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Your API key is encrypted and stored securely in Supabase Vault
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleOpenAISetup}
            disabled={loading || !formData.api_key}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Connect OpenAI
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

