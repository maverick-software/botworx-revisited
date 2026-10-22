import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Shield,
  Bot,
  Key
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { VaultService } from '../../_shared';

/**
 * Discord Integration Setup Modal
 * Handles Discord bot application setup and credential storage
 */
export function DiscordSetupModal({
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
  const [step, setStep] = useState<'instructions' | 'credentials' | 'testing'>('instructions');
  
  // Form state
  const [formData, setFormData] = useState({
    connection_name: '',
    bot_token: '',
    application_id: '',
    public_key: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.bot_token.trim()) {
      setError('Bot Token is required');
      return false;
    }
    if (!formData.application_id.trim()) {
      setError('Application ID is required');
      return false;
    }
    if (!formData.public_key.trim()) {
      setError('Public Key is required');
      return false;
    }
    return true;
  };

  const handleSetupSubmit = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Get Discord OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'discord')
        .single();

      if (providerError) {
        throw new Error(`Discord provider not found: ${providerError.message}`);
      }

      // Store bot token securely in vault
      const vaultService = new VaultService(supabase);
      const secretName = `discord_bot_token_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        formData.bot_token,
        `Discord bot token for ${formData.connection_name || 'Discord Connection'} - Created: ${new Date().toISOString()}`
      );

      console.log(`✅ Discord bot token securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.connection_name || 'Discord Bot Connection',
          connection_name: formData.connection_name || 'Discord Bot Connection',
          encrypted_access_token: null, // Bot token is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['bot', 'messages.read', 'messages.write', 'guilds'],
          connection_status: 'active',
          credential_type: 'bot_token',
          // Store Discord-specific metadata
          metadata: {
            application_id: formData.application_id,
            public_key: formData.public_key,
            bot_permissions: ['Send Messages', 'Read Message History', 'Use Slash Commands']
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
        provider_name: 'discord',
        external_username: connectionData.external_username,
        scopes_granted: connectionData.scopes_granted
      });

      toast.success('Discord bot connected successfully! 🎉');
      
      // Reset form
      setFormData({
        connection_name: '',
        bot_token: '',
        application_id: '',
        public_key: ''
      });
      
      onClose();

    } catch (err: any) {
      console.error('Error setting up Discord integration:', err);
      const errorMessage = err.message || 'Failed to setup Discord integration';
      setError(errorMessage);
      onError(errorMessage);
      toast.error('Failed to setup Discord integration');
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
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Discord</h2>
          <p className="text-muted-foreground">Connect your Discord bot to enable agent communication</p>
        </div>
      </div>

      {/* Step 1: Instructions */}
      {step === 'instructions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-indigo-500" />
              <span>Discord Bot Setup Instructions</span>
            </CardTitle>
            <CardDescription>
              Discord integration requires creating a Discord application and bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p><strong>Follow these steps to create your Discord bot:</strong></p>
                  
                  <div className="space-y-2">
                    <p><strong>1.</strong> Go to the <Button variant="link" className="p-0 h-auto" asChild>
                      <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">
                        Discord Developer Portal <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button></p>
                    
                    <p><strong>2.</strong> Click "New Application" and give it a name</p>
                    
                    <p><strong>3.</strong> Go to the "Bot" section and click "Add Bot"</p>
                    
                    <p><strong>4.</strong> Copy the <strong>Bot Token</strong> (keep this secret!)</p>
                    
                    <p><strong>5.</strong> Go back to "General Information" and copy:</p>
                    <ul className="ml-4 space-y-1">
                      <li>• <strong>Application ID</strong></li>
                      <li>• <strong>Public Key</strong></li>
                    </ul>
                    
                    <p><strong>6.</strong> Set the Interaction Endpoint URL to:</p>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-interaction-handler
                    </code>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex space-x-2">
              <Button onClick={() => setStep('credentials')} className="flex-1">
                <Shield className="h-4 w-4 mr-2" />
                I've Created My Bot
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Credentials */}
      {step === 'credentials' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-indigo-500" />
              <span>Enter Discord Credentials</span>
            </CardTitle>
            <CardDescription>
              Enter the credentials from your Discord application
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
                placeholder="My Discord Bot"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="bot_token">
                Bot Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="bot_token"
                type="password"
                value={formData.bot_token}
                onChange={(e) => handleInputChange('bot_token', e.target.value)}
                placeholder="Enter your bot token"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="application_id">
                Application ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="application_id"
                value={formData.application_id}
                onChange={(e) => handleInputChange('application_id', e.target.value)}
                placeholder="Enter your application ID"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="public_key">
                Public Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="public_key"
                value={formData.public_key}
                onChange={(e) => handleInputChange('public_key', e.target.value)}
                placeholder="Enter your public key"
                className="mt-1"
              />
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                onClick={handleSetupSubmit}
                disabled={loading || !formData.bot_token || !formData.application_id || !formData.public_key}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Connect Discord Bot
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setStep('instructions')}>
                Back
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capabilities Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Agent Capabilities</span>
          </CardTitle>
          <CardDescription>
            What your agents will be able to do with Discord
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Send messages to Discord channels</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Read messages from Discord servers</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Access Discord server information</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Bot functionality and commands</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
