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
  ExternalLink,
  Key
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';
import { SMTP_PROVIDER_PRESETS } from '../../smtp/types/smtp';
import { useFormModalState } from '../../../hooks/useModalState';

// Email providers for Email Relay integration
const EMAIL_PROVIDERS = [
  {
    id: 'smtp',
    name: 'SMTP Server',
    setupUrl: '',
    description: 'Connect to any SMTP server (Gmail, Outlook, Yahoo, etc.)',
    fields: ['host', 'port', 'username', 'password', 'from_email', 'from_name', 'reply_to_email', 'smtp_preset'],
    credentialType: 'api_key'
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    setupUrl: 'https://app.sendgrid.com/settings/api_keys',
    description: 'High-deliverability email service with advanced analytics',
    fields: ['api_key', 'from_email', 'from_name'],
    credentialType: 'api_key'
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    setupUrl: 'https://app.mailgun.com/app/account/security/api_keys',
    description: 'Powerful email service with validation and routing',
    fields: ['domain', 'api_key', 'region'],
    credentialType: 'api_key'
  }
];

/**
 * Email Relay Integration Setup Modal
 * Handles email provider selection and configuration
 */
export function EmailRelaySetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user,
  supabase
}: IntegrationSetupProps) {
  const [loading, setLoading] = useState(false);
  const [selectedSMTPPreset, setSelectedSMTPPreset] = useState<any>(null);
  
  // Use protected form state that persists across tab switches
  const {
    formData,
    errors,
    updateFormField,
    setFieldError,
    clearErrors
  } = useFormModalState(
    {
      connection_name: '',
      selected_provider: 'sendgrid',
      // SendGrid fields
      api_key: '',
      from_email: '',
      from_name: '',
      // Mailgun fields
      domain: '',
      region: 'US',
      // SMTP fields
      host: '',
      port: '587',
      secure: false,
      username: '',
      password: '',
      reply_to_email: '',
      smtp_preset: ''
    },
    {
      preserveOnHidden: true,
      preserveOnBlur: true,
      onCleanup: () => {
        console.log('[EmailRelaySetupModal] Form state cleaned up');
        setSelectedSMTPPreset(null);
      }
    }
  );

  // Component lifecycle debugging (commented out for production)
  // useEffect(() => {
  //   if (isOpen) console.log('[EmailRelaySetupModal] Modal opened');
  // }, [isOpen]);

  const handleInputChange = (field: string, value: string | boolean) => {
    updateFormField(field, value);
  };

  const handleSMTPPresetSelect = (preset: any) => {
    setSelectedSMTPPreset(preset);
    updateFormField('host', preset.host);
    updateFormField('port', preset.port.toString());
    updateFormField('secure', preset.secure);
    if (!formData.connection_name) {
      updateFormField('connection_name', preset.displayName);
    }
  };

  // Memoized form validation to prevent infinite re-renders
  const isFormValid = useMemo(() => {
    const provider = EMAIL_PROVIDERS.find(p => p.id === formData.selected_provider);
    if (!provider) return false;

    switch (formData.selected_provider) {
      case 'smtp':
        return !!(formData.host.trim() && formData.username.trim() && formData.password.trim() && formData.from_email.trim());
      case 'sendgrid':
        return !!(formData.api_key.trim() && formData.from_email.trim());
      case 'mailgun':
        return !!(formData.domain.trim() && formData.api_key.trim());
      default:
        return false;
    }
  }, [formData.selected_provider, formData.host, formData.username, formData.password, formData.from_email, formData.api_key, formData.domain]);

  const validateForm = () => {
    const provider = EMAIL_PROVIDERS.find(p => p.id === formData.selected_provider);
    if (!provider) return false;

    switch (formData.selected_provider) {
      case 'smtp':
        if (!formData.host.trim() || !formData.username.trim() || !formData.password.trim() || !formData.from_email.trim()) {
          setFieldError('connection_name', 'SMTP Host, Username, Password, and From Email are required');
          return false;
        }
        break;
      case 'sendgrid':
        if (!formData.api_key.trim() || !formData.from_email.trim()) {
          setFieldError('connection_name', 'SendGrid API Key and From Email are required');
          return false;
        }
        break;
      case 'mailgun':
        if (!formData.domain.trim() || !formData.api_key.trim()) {
          setFieldError('connection_name', 'Mailgun Domain and API Key are required');
          return false;
        }
        break;
      default:
        return false;
    }
    return true;
  };

  const handleEmailRelaySetup = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    clearErrors();

    try {
      const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === formData.selected_provider);
      if (!selectedProvider) {
        throw new Error('Invalid email provider selected');
      }

      // Get OAuth provider for the selected email provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', formData.selected_provider)
        .single();

      if (providerError) {
        throw new Error(`${selectedProvider.name} provider not found: ${providerError.message}`);
      }

      // Store credentials securely in vault
      const vaultService = new VaultService(supabase);
      let vaultKeyId: string;
      let metadata: Record<string, any> = {
        provider: formData.selected_provider,
        provider_name: selectedProvider.name
      };

      // Handle different provider configurations
      switch (formData.selected_provider) {
        case 'smtp':
          const smtpSecretName = `smtp_password_${user.id}_${Date.now()}`;
          vaultKeyId = await vaultService.createSecret(
            smtpSecretName,
            formData.password,
            `SMTP password for ${formData.connection_name || 'SMTP Connection'} - Created: ${new Date().toISOString()}`
          );
          metadata = {
            ...metadata,
            host: formData.host,
            port: parseInt(formData.port),
            secure: formData.secure,
            from_email: formData.from_email,
            from_name: formData.from_name,
            reply_to_email: formData.reply_to_email,
            provider_preset: selectedSMTPPreset?.name || 'custom'
          };
          break;

        case 'sendgrid':
          const sendgridSecretName = `sendgrid_api_key_${user.id}_${Date.now()}`;
          vaultKeyId = await vaultService.createSecret(
            sendgridSecretName,
            formData.api_key,
            `SendGrid API key for ${formData.connection_name || 'SendGrid Connection'} - Created: ${new Date().toISOString()}`
          );
          metadata = {
            ...metadata,
            from_email: formData.from_email,
            from_name: formData.from_name
          };
          break;

        case 'mailgun':
          const mailgunSecretName = `mailgun_api_key_${user.id}_${Date.now()}`;
          vaultKeyId = await vaultService.createSecret(
            mailgunSecretName,
            formData.api_key,
            `Mailgun API key for ${formData.connection_name || 'Mailgun Connection'} - Created: ${new Date().toISOString()}`
          );
          metadata = {
            ...metadata,
            domain: formData.domain,
            region: formData.region
          };
          break;

        default:
          throw new Error('Invalid provider configuration');
      }

      console.log(`✅ ${selectedProvider.name} credentials securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.selected_provider === 'smtp' ? formData.username : 
                             formData.selected_provider === 'sendgrid' ? formData.from_email : 
                             formData.domain,
          connection_name: formData.connection_name || `${selectedProvider.name} Connection`,
          encrypted_access_token: null, // Credentials are in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: getProviderScopes(formData.selected_provider),
          connection_status: 'active',
          credential_type: selectedProvider.credentialType,
          connection_metadata: metadata
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
      
      // Reset form fields individually
      updateFormField('connection_name', '');
      updateFormField('selected_provider', 'sendgrid');
      updateFormField('api_key', '');
      updateFormField('from_email', '');
      updateFormField('from_name', '');
      updateFormField('domain', '');
      updateFormField('region', 'US');
      updateFormField('host', '');
      updateFormField('port', '587');
      updateFormField('username', '');
      updateFormField('password', '');
      updateFormField('secure', false);
      updateFormField('reply_to_email', '');
      updateFormField('smtp_preset', '');
      setSelectedSMTPPreset(null);
      clearErrors();
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Email Relay integration:', err);
      const errorMessage = err.message || 'Failed to setup Email Relay integration';
      setFieldError('connection_name', errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Email Relay');
    } finally {
      setLoading(false);
    }
  };

  const getProviderScopes = (provider: string) => {
    switch (provider) {
      case 'smtp':
        return ['send_email'];
      case 'sendgrid':
        return ['send_email', 'email_templates', 'email_stats'];
      case 'mailgun':
        return ['send_email', 'email_validation', 'email_stats', 'suppression_management'];
      default:
        return ['send_email'];
    }
  };

  // Note: Don't return null here - let the parent Dialog handle visibility
  // if (!isOpen) return null; // ❌ This destroys component state!

  const selectedProvider = EMAIL_PROVIDERS.find(p => p.id === formData.selected_provider);

  // Debug: Check if SMTP presets are loaded (remove in production)
  if (formData.selected_provider === 'smtp' && typeof console !== 'undefined') {
    console.log('SMTP_PROVIDER_PRESETS loaded:', SMTP_PROVIDER_PRESETS?.length, 'presets');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Email Relay</h2>
          <p className="text-muted-foreground">Choose an email provider and configure your connection</p>
        </div>
      </div>

      {/* Email Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-blue-500" />
            <span>Email Provider Configuration</span>
          </CardTitle>
          <CardDescription>
            Choose an email service provider and configure your settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.connection_name && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.connection_name}</AlertDescription>
            </Alert>
          )}

          {/* Provider Selection */}
          <div>
            <Label htmlFor="provider_select">
              Email Provider <span className="text-red-500">*</span>
            </Label>
            <Select 
              value={formData.selected_provider} 
              onValueChange={(value) => handleInputChange('selected_provider', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose your email provider" />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
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

          {/* Dynamic Fields Based on Provider */}
          {formData.selected_provider === 'smtp' && (
            <>
              {/* SMTP Provider Preset Dropdown */}
              <div>
                <Label htmlFor="smtp_preset">
                  Email Provider Preset (Optional)
                </Label>
                <Select onValueChange={(value) => {
                  const preset = SMTP_PROVIDER_PRESETS.find(p => p.name === value);
                  if (preset && preset.name !== 'custom') {
                    handleSMTPPresetSelect(preset);
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
                
                {selectedSMTPPreset?.setupInstructions && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>{selectedSMTPPreset.displayName} Setup:</strong> {selectedSMTPPreset.setupInstructions}
                    </AlertDescription>
                  </Alert>
                )}
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
            </>
          )}

          {formData.selected_provider === 'sendgrid' && (
            <>
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
            </>
          )}

          {formData.selected_provider === 'mailgun' && (
            <>
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
            </>
          )}

          {selectedProvider && (
            <Button
              onClick={handleEmailRelaySetup}
              disabled={loading || !isFormValid}
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
                  Connect {selectedProvider.name}
                </>
              )}
            </Button>
          )}
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
            What your agents will be able to do with Email Relay
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
              <span>High deliverability across providers</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Custom from addresses and branding</span>
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
