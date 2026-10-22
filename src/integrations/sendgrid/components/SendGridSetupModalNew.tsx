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
 * SendGrid Integration Setup Modal
 * Handles SendGrid API key and email configuration
 */
export function SendGridSetupModal({
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
    from_email: '',
    from_name: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.api_key.trim()) {
      setError('SendGrid API Key is required');
      return false;
    }
    if (!formData.from_email.trim()) {
      setError('From Email is required');
      return false;
    }
    return true;
  };

  const handleSendGridSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get SendGrid OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'sendgrid')
        .single();

      if (providerError) {
        throw new Error(`SendGrid provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `sendgrid_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.api_key,
        `SendGrid API key for ${formData.connection_name || 'SendGrid Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ SendGrid API key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.from_email,
          connection_name: formData.connection_name || 'SendGrid Connection',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['send_email', 'email_templates', 'email_stats'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store SendGrid-specific configuration
          connection_metadata: {
            from_email: formData.from_email,
            from_name: formData.from_name,
            provider: 'sendgrid'
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create SendGrid connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'sendgrid',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('SendGrid connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        api_key: '',
        from_email: '',
        from_name: ''
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up SendGrid integration:', err);
      const errorMessage = err.message || 'Failed to setup SendGrid integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup SendGrid');
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
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup SendGrid</h2>
          <p className="text-muted-foreground">Configure your SendGrid API key and email settings</p>
        </div>
      </div>

      {/* SendGrid Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>SendGrid Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your SendGrid API key and email settings
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
              placeholder="My SendGrid Connection"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="api_key">
              SendGrid API Key <span className="text-red-500">*</span>
            </Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => handleInputChange('api_key', e.target.value)}
              placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your API key with mail.send permissions
            </p>
          </div>

          <div>
            <Label htmlFor="from_email">
              From Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="from_email"
              type="email"
              value={formData.from_email}
              onChange={(e) => handleInputChange('from_email', e.target.value)}
              placeholder="noreply@yourdomain.com"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your verified sender email address
            </p>
          </div>

          <div>
            <Label htmlFor="from_name">
              From Name (Optional)
            </Label>
            <Input
              id="from_name"
              value={formData.from_name}
              onChange={(e) => handleInputChange('from_name', e.target.value)}
              placeholder="Your App Name"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Display name for your emails
            </p>
          </div>

          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            <a 
              href="https://app.sendgrid.com/settings/api_keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-foreground underline"
            >
              Get your SendGrid API key
            </a>
          </div>

          <Button
            onClick={handleSendGridSetup}
            disabled={loading || !formData.api_key || !formData.from_email}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Connect SendGrid
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
            What your agents will be able to do with SendGrid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Send transactional and marketing emails</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Track email delivery and engagement</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Create agent-specific email addresses</span>
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
