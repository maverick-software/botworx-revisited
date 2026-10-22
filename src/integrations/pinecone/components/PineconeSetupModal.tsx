import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Database, 
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
 * Pinecone Integration Setup Modal
 * Handles Pinecone API key configuration for vector database
 */
export function PineconeSetupModal({
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
    environment: '',
    index_name: '',
    dimensions: '1536' // Default for OpenAI embeddings
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_key.trim()) {
      setError('Pinecone API Key is required');
      return false;
    }
    if (!formData.environment.trim()) {
      setError('Environment is required');
      return false;
    }
    if (!formData.index_name.trim()) {
      setError('Index Name is required');
      return false;
    }
    if (!formData.dimensions.trim() || isNaN(parseInt(formData.dimensions))) {
      setError('Valid dimensions number is required');
      return false;
    }
    return true;
  };

  const handlePineconeSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get Pinecone service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'pinecone')
        .single();

      if (providerError) {
        throw new Error(`Pinecone provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `pinecone_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `Pinecone API key for ${formData.connection_name || 'Pinecone Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ Pinecone API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.environment,
          connection_name: formData.connection_name || 'Pinecone Connection',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['vector_search', 'vector_upsert', 'vector_delete', 'index_stats'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store Pinecone-specific configuration
          connection_metadata: {
            environment: formData.environment,
            index_name: formData.index_name,
            dimensions: parseInt(formData.dimensions),
            metric: 'cosine' // Default metric
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create Pinecone connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'pinecone',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('Pinecone connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        api_key: '',
        environment: '',
        index_name: '',
        dimensions: '1536'
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Pinecone integration:', err);
      const errorMessage = err.message || 'Failed to setup Pinecone integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Pinecone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Database className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Pinecone</h2>
          <p className="text-muted-foreground">Connect your Pinecone vector database for AI memory</p>
        </div>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-purple-500" />
            <span>Pinecone Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Pinecone vector database connection
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
              placeholder="My Pinecone Database"
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
              placeholder="Your Pinecone API key"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Find your API key in the Pinecone console under API Keys
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="environment">
                Environment <span className="text-red-500">*</span>
              </Label>
              <Input
                id="environment"
                value={formData.environment}
                onChange={(e) => handleInputChange('environment', e.target.value)}
                placeholder="us-east-1-aws"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your Pinecone environment (e.g., us-east-1-aws)
              </p>
            </div>
            <div>
              <Label htmlFor="index_name">
                Index Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="index_name"
                value={formData.index_name}
                onChange={(e) => handleInputChange('index_name', e.target.value)}
                placeholder="my-index"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Name of your Pinecone index
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="dimensions">
              Vector Dimensions <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.dimensions} onValueChange={(value) => handleInputChange('dimensions', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select dimensions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1536">1536 (OpenAI text-embedding-ada-002)</SelectItem>
                <SelectItem value="768">768 (Sentence Transformers)</SelectItem>
                <SelectItem value="384">384 (MiniLM)</SelectItem>
                <SelectItem value="512">512 (Custom)</SelectItem>
                <SelectItem value="1024">1024 (Custom)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Must match your index dimensions
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Setup Instructions:</strong> Create a Pinecone account at{' '}
              <a href="https://pinecone.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                pinecone.io
              </a>
              , create an index, and get your API key from the console.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handlePineconeSetup}
            disabled={loading || !formData.api_key || !formData.environment || !formData.index_name}
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
                Connect Pinecone
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
            What your agents will be able to do with Pinecone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Store and retrieve vector embeddings</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Semantic similarity search</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Long-term memory storage</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Context-aware responses</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <div className="text-center">
        <a 
          href="https://docs.pinecone.io/docs/quickstart"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:text-primary/80 flex items-center justify-center"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          View Pinecone Documentation
        </a>
      </div>
    </div>
  );
}
