import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  GitBranch, 
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
 * GetZep Integration Setup Modal
 * Handles GetZep API key configuration for knowledge graph
 */
export function GetZepSetupModal({
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
    project_uuid: '',
    session_id: '',
    base_url: 'https://api.getzep.com' // Default GetZep cloud URL
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_key.trim()) {
      setError('GetZep API Key is required');
      return false;
    }
    if (!formData.project_uuid.trim()) {
      setError('Project UUID is required');
      return false;
    }
    if (!formData.session_id.trim()) {
      setError('Session ID is required');
      return false;
    }
    if (!formData.base_url.trim()) {
      setError('Base URL is required');
      return false;
    }
    return true;
  };

  const handleGetZepSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get GetZep service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'getzep')
        .single();

      if (providerError) {
        throw new Error(`GetZep provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `getzep_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `GetZep API key for ${formData.connection_name || 'GetZep Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ GetZep API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.project_uuid,
          connection_name: formData.connection_name || 'GetZep Connection',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['memory_read', 'memory_write', 'session_management', 'knowledge_graph'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store GetZep-specific configuration
          connection_metadata: {
            project_uuid: formData.project_uuid,
            session_id: formData.session_id,
            base_url: formData.base_url
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create GetZep connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'getzep',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('GetZep connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        api_key: '',
        project_uuid: '',
        session_id: '',
        base_url: 'https://api.getzep.com'
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up GetZep integration:', err);
      const errorMessage = err.message || 'Failed to setup GetZep integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup GetZep');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center">
          <GitBranch className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup GetZep</h2>
          <p className="text-muted-foreground">Connect your GetZep knowledge graph for AI memory</p>
        </div>
      </div>

      {/* API Key Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitBranch className="h-5 w-5 text-green-500" />
            <span>GetZep Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your GetZep knowledge graph connection
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
              placeholder="My GetZep Knowledge Graph"
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
              placeholder="Your GetZep API key"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Find your API key in the GetZep console under API Keys
            </p>
          </div>

          <div>
            <Label htmlFor="project_uuid">
              Project UUID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project_uuid"
              value={formData.project_uuid}
              onChange={(e) => handleInputChange('project_uuid', e.target.value)}
              placeholder="proj-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your GetZep project UUID from the console
            </p>
          </div>

          <div>
            <Label htmlFor="session_id">
              Session ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="session_id"
              value={formData.session_id}
              onChange={(e) => handleInputChange('session_id', e.target.value)}
              placeholder="agent-session-001"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Unique session identifier for this agent
            </p>
          </div>

          <div>
            <Label htmlFor="base_url">
              Base URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="base_url"
              value={formData.base_url}
              onChange={(e) => handleInputChange('base_url', e.target.value)}
              placeholder="https://api.getzep.com"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              GetZep API base URL (use default for GetZep Cloud)
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Setup Instructions:</strong> Create a GetZep account at{' '}
              <a href="https://www.getzep.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                getzep.com
              </a>
              , create a project, and get your API key and project UUID from the console.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleGetZepSetup}
            disabled={loading || !formData.api_key || !formData.project_uuid || !formData.session_id}
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
                Connect GetZep
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
            What your agents will be able to do with GetZep
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Knowledge graph memory storage</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Semantic concept extraction</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Relationship mapping</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Context-aware reasoning</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <div className="text-center">
        <a 
          href="https://docs.getzep.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:text-primary/80 flex items-center justify-center"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          View GetZep Documentation
        </a>
      </div>
    </div>
  );
}
