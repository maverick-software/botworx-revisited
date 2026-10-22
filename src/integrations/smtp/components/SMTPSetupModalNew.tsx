import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mail, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';
import { SMTP_PROVIDER_PRESETS, SMTPProviderPreset } from '../types/smtp';

/**
 * SMTP Integration Setup Modal
 * Handles SMTP server configuration with provider presets
 */
export function SMTPSetupModal({
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
  const [selectedPreset, setSelectedPreset] = useState<SMTPProviderPreset | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    connection_name: '',
    host: '',
    port: '587',
    secure: false,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    reply_to_email: ''
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handlePresetSelect = (preset: SMTPProviderPreset) => {
    setSelectedPreset(preset);
    setFormData(prev => ({
      ...prev,
      host: preset.host,
      port: preset.port.toString(),
      secure: preset.secure,
      connection_name: prev.connection_name || preset.displayName
    }));
  };

  const validateForm = () => {
    if (!formData.host.trim()) {
      setError('SMTP Host is required');
      return false;
    }
    if (!formData.port.trim()) {
      setError('Port is required');
      return false;
    }
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!formData.password.trim()) {
      setError('Password is required');
      return false;
    }
    if (!formData.from_email.trim()) {
      setError('From Email is required');
      return false;
    }
    return true;
  };

  const handleSMTPSetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get SMTP OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'smtp')
        .single();

      if (providerError) {
        throw new Error(`SMTP provider not found: ${providerError.message}`);
      }

      // Store password securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `smtp_password_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.password,
        `SMTP password for ${formData.connection_name || 'SMTP Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ SMTP password securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.username,
          connection_name: formData.connection_name || 'SMTP Connection',
          encrypted_access_token: null, // Password is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['send_email'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store SMTP-specific configuration
          connection_metadata: {
            host: formData.host,
            port: parseInt(formData.port),
            secure: formData.secure,
            from_email: formData.from_email,
            from_name: formData.from_name,
            reply_to_email: formData.reply_to_email,
            provider_preset: selectedPreset?.name || 'custom'
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create SMTP connection: ${insertError.message}`);
      }

      // Success! Call onSuccess callback
      onSuccess({
        connection_id: connectionData.id,
        connection_name: connectionData.connection_name,
        provider_name: 'smtp',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('SMTP server connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        host: '',
        port: '587',
        secure: false,
        username: '',
        password: '',
        from_email: '',
        from_name: '',
        reply_to_email: ''
      });
      setSelectedPreset(null);
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up SMTP integration:', err);
      const errorMessage = err.message || 'Failed to setup SMTP integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup SMTP server');
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
          <h2 className="text-2xl font-bold">Setup SMTP</h2>
          <p className="text-muted-foreground">Configure your SMTP server for email delivery</p>
        </div>
      </div>

      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5 text-blue-500" />
            <span>SMTP Server Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure your SMTP server settings for email delivery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Provider Preset Dropdown */}
          <div>
            <Label htmlFor="smtp_preset">
              Email Provider Preset (Optional)
            </Label>
            <Select onValueChange={(value) => {
              const preset = SMTP_PROVIDER_PRESETS.find(p => p.name === value);
              if (preset && preset.name !== 'custom') {
                handlePresetSelect(preset);
              }
            }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a preset to auto-fill settings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Configuration</SelectItem>
                {SMTP_PROVIDER_PRESETS.filter(preset => preset.name !== 'custom').map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.displayName} - {preset.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedPreset?.setupInstructions && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>{selectedPreset.displayName} Setup:</strong> {selectedPreset.setupInstructions}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label htmlFor="connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="connection_name"
              value={formData.connection_name}
              onChange={(e) => handleInputChange('connection_name', e.target.value)}
              placeholder="My SMTP Server"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="host">
                SMTP Host <span className="text-red-500">*</span>
              </Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="smtp.gmail.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="port">
                Port <span className="text-red-500">*</span>
              </Label>
              <Input
                id="port"
                value={formData.port}
                onChange={(e) => handleInputChange('port', e.target.value)}
                placeholder="587"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">
                Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                placeholder="your-email@domain.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder="Your SMTP password"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>

          <div>
            <Label htmlFor="reply_to_email">
              Reply-To Email (Optional)
            </Label>
            <Input
              id="reply_to_email"
              type="email"
              value={formData.reply_to_email}
              onChange={(e) => handleInputChange('reply_to_email', e.target.value)}
              placeholder="support@yourdomain.com"
              className="mt-1"
            />
          </div>

          <Button
            onClick={handleSMTPSetup}
            disabled={loading || !formData.host || !formData.username || !formData.password || !formData.from_email}
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
                Connect SMTP Server
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
            What your agents will be able to do with SMTP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Send emails through your SMTP server</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Custom from addresses and names</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Reply-to email configuration</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Secure credential management</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
