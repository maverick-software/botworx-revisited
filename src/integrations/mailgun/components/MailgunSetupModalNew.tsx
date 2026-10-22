import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
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

/**
 * Mailgun Integration Setup Modal
 * Handles Mailgun domain and API key configuration
 */
export function MailgunSetupModal({
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
    domain: '',
    api_key: '',
    region: 'US'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.domain.trim()) {
      setError('Mailgun Domain is required');
      return false;
    }
    if (!formData.api_key.trim()) {
      setError('Mailgun API Key is required');
      return false;
    }
    return true;
  };

  const handleMailgunSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get Mailgun OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();

      if (providerError) {
        throw new Error(`Mailgun provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `mailgun_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `Mailgun API key for ${formData.connection_name || 'Mailgun Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ Mailgun API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.domain,
          connection_name: formData.connection_name || 'Mailgun Connection',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['send_email', 'email_validation', 'email_stats', 'suppression_management'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store Mailgun-specific configuration
          connection_metadata: {
            domain: formData.domain,
            region: formData.region,
            provider: 'mailgun'
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create Mailgun connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'mailgun',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('Mailgun connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        domain: '',
        api_key: '',
        region: 'US'
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Mailgun integration:', err);
      const errorMessage = err.message || 'Failed to setup Mailgun integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Mailgun');
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
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Mailgun</h2>
          <p className="text-muted-foreground">Configure your Mailgun domain and API key for high-deliverability email</p>
        </div>
      </div>

      {/* Mailgun Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-orange-500" />
            <span>Mailgun Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your Mailgun domain and API key for high-deliverability email
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
              placeholder="My Mailgun Connection"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="domain">
              Mailgun Domain <span className="text-red-500">*</span>
            </Label>
            <Input
              id="domain"
              value={formData.domain}
              onChange={(e) => handleInputChange('domain', e.target.value)}
              placeholder="mail.yourdomain.com"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your verified Mailgun sending domain
            </p>
          </div>

          <div>
            <Label htmlFor="api_key">
              Mailgun API Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => handleInputChange('api_key', e.target.value)}
              placeholder="key-xxxxxxxxxxxxxxxxxxxxxx"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your private API key from Mailgun dashboard
            </p>
          </div>

          <div>
            <Label htmlFor="region">
              Region
            </Label>
            <select
              id="region"
              value={formData.region}
              onChange={(e) => handleInputChange('region', e.target.value)}
              className="w-full p-2 mt-1 bg-card border border-border rounded-md text-foreground"
            >
              <option value="US">US (api.mailgun.net)</option>
              <option value="EU">EU (api.eu.mailgun.net)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Select your Mailgun account region
            </p>
          </div>

          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            <a 
              href="https://app.mailgun.com/app/account/security/api_keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground underline"
            >
              Get your Mailgun API key
            </a>
          </div>

          <Button
            onClick={handleMailgunSetup}
            disabled={loading || !formData.domain || !formData.api_key}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Connect Mailgun
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
            What your agents will be able to do with Mailgun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>High-deliverability email sending</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Advanced email validation</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Delivery statistics and analytics</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Suppression list management</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
