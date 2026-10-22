import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { Key, Save, Check, AlertCircle, Loader2, Shield, ExternalLink, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface SystemAPIKey {
  id: string;
  provider_name: string;
  display_name: string;
  vault_secret_id: string | null;
  is_active: boolean;
  updated_at: string;
}

interface APIKeyConfig {
  provider: string;
  displayName: string;
  keyPrefix: string;
  description: string;
  docsUrl: string;
  getKeyUrl: string;
}

const API_KEY_CONFIGS: APIKeyConfig[] = [
  {
    provider: 'openai',
    displayName: 'OpenAI',
    keyPrefix: 'sk-',
    description: 'Platform-wide OpenAI API key for GPT models. All users will use this key.',
    docsUrl: 'https://platform.openai.com/docs',
    getKeyUrl: 'https://platform.openai.com/api-keys'
  },
  {
    provider: 'anthropic',
    displayName: 'Anthropic',
    keyPrefix: 'sk-ant-',
    description: 'Platform-wide Anthropic API key for Claude models. All users will use this key.',
    docsUrl: 'https://docs.anthropic.com',
    getKeyUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    provider: 'mistral_ai',
    displayName: 'Mistral AI',
    keyPrefix: '', // Mistral uses various formats
    description: 'Platform-wide Mistral AI API key for Mistral models.',
    docsUrl: 'https://docs.mistral.ai/',
    getKeyUrl: 'https://console.mistral.ai/api-keys/'
  },
  {
    provider: 'serper_api',
    displayName: 'Serper API',
    keyPrefix: '', // Serper uses various formats
    description: 'Platform-wide Serper API key for web search functionality.',
    docsUrl: 'https://serper.dev/api',
    getKeyUrl: 'https://serper.dev/api-key'
  }
];

export function AdminSystemAPIKeysPage() {
  const supabase = useSupabaseClient();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [keyStatus, setKeyStatus] = useState<Record<string, SystemAPIKey>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemAPIKeys();
  }, []);

  const loadSystemAPIKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_api_keys')
        .select('*');

      if (error) throw error;

      const statusMap: Record<string, SystemAPIKey> = {};
      data?.forEach((key: SystemAPIKey) => {
        statusMap[key.provider_name] = key;
      });

      setKeyStatus(statusMap);
    } catch (error) {
      console.error('Error loading system API keys:', error);
      toast.error('Failed to load API key status');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const validateKey = (provider: string, key: string): boolean => {
    const config = API_KEY_CONFIGS.find(c => c.provider === provider);
    if (!config) return false;

    if (!key.trim()) {
      toast.error(`${config.displayName} API key is required`);
      return false;
    }

    // Only validate prefix if one is specified
    if (config.keyPrefix && !key.startsWith(config.keyPrefix)) {
      toast.error(`Invalid ${config.displayName} API key format. Must start with "${config.keyPrefix}"`);
      return false;
    }

    return true;
  };

  const saveAPIKey = async (provider: string) => {
    const key = apiKeys[provider];
    if (!validateKey(provider, key)) return;

    setSaving(prev => ({ ...prev, [provider]: true }));

    try {
      // Get current user session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Store in vault using edge function
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/create-secret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: `system_${provider}_api_key_${Date.now()}`,
          secret: key,
          description: `System-wide ${provider} API key - Updated: ${new Date().toISOString()}`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to store key in vault');
      }

      const { id: vaultId } = await response.json();

      // Update system_api_keys table
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error: updateError } = await supabase
        .from('system_api_keys')
        .upsert({
          provider_name: provider,
          display_name: API_KEY_CONFIGS.find(c => c.provider === provider)?.displayName,
          vault_secret_id: vaultId,
          is_active: true,
          last_updated_by: user?.id
        }, {
          onConflict: 'provider_name', // Specify the unique column to resolve conflicts
          ignoreDuplicates: false // Update on conflict instead of ignoring
        });

      if (updateError) {
        throw new Error(`Failed to update system API key: ${updateError.message}`);
      }

      toast.success(`${API_KEY_CONFIGS.find(c => c.provider === provider)?.displayName} API key saved successfully!`);
      
      // Clear the input and show masked placeholder
      setApiKeys(prev => ({ ...prev, [provider]: '' }));
      
      // Reload status
      await loadSystemAPIKeys();
    } catch (error: any) {
      console.error('Error saving API key:', error);
      toast.error(error.message || 'Failed to save API key');
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const deleteAPIKey = async (provider: string) => {
    if (!confirm(`Are you sure you want to delete the ${API_KEY_CONFIGS.find(c => c.provider === provider)?.displayName} API key? This cannot be undone.`)) {
      return;
    }

    setDeleting(prev => ({ ...prev, [provider]: true }));

    try {
      const status = keyStatus[provider];
      if (!status?.vault_secret_id) {
        throw new Error('No API key found to delete');
      }

      // Update system_api_keys table to mark as inactive and remove vault reference
      const { error: updateError } = await supabase
        .from('system_api_keys')
        .update({
          vault_secret_id: null,
          is_active: false
        })
        .eq('provider_name', provider);

      if (updateError) {
        throw new Error(`Failed to delete API key: ${updateError.message}`);
      }

      toast.success(`${API_KEY_CONFIGS.find(c => c.provider === provider)?.displayName} API key deleted successfully!`);
      
      // Reload status
      await loadSystemAPIKeys();
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      toast.error(error.message || 'Failed to delete API key');
    } finally {
      setDeleting(prev => ({ ...prev, [provider]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Alerts at Top */}
      <div className="space-y-3">
        {/* Security Notice */}
        <Alert className="border border-primary/20 bg-primary/5">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground">
            <div className="space-y-1">
              <strong className="text-white">Security:</strong>
              <ul className="list-disc list-inside space-y-1 ml-2 text-white">
                <li>All API keys are encrypted with AES-256</li>
                <li>Keys are stored in Supabase Vault (zero plain-text storage)</li>
                <li>Only admins can view or modify these keys</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Usage Notice */}
        <Alert className="border border-success/20 bg-success/5">
          <AlertCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-sm text-foreground">
            <div className="space-y-1">
              <strong className="text-white">Platform-Wide Keys:</strong>
              <ul className="list-disc list-inside space-y-1 ml-2 text-white">
                <li>Keys saved here are automatically used by all agents and users</li>
                <li>Individual users do not configure their own keys for these services</li>
                <li>Changes take effect immediately across the entire platform</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        {/* Integration Note */}
        <Alert className="border border-blue-500/20 bg-blue-500/5">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-foreground">
            <div className="space-y-1">
              <strong className="text-white">Note:</strong>
              <p className="text-white ml-2">
                This page is for <strong>simple API key-only services</strong> that don't require per-account configuration.
              </p>
              <p className="text-white ml-2 mt-2">
                Services like <strong>SMTP, ClickSend SMS, and OAuth providers</strong> that need per-user sender identities or phone numbers should be configured at the <strong>user/account level</strong> in the Integrations page, not here.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      {/* API Keys Table */}
      <div className="border border-border overflow-hidden bg-card rounded-lg shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Provider</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">API Key</th>
              <th className="text-right p-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {API_KEY_CONFIGS.map((config, index) => {
              const status = keyStatus[config.provider];
              const isConfigured = status?.vault_secret_id && status?.is_active;

              return (
                <tr key={config.provider} className={index !== API_KEY_CONFIGS.length - 1 ? 'border-b border-border' : ''}>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Key className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{config.displayName}</div>
                        <div className="text-xs text-muted-foreground">{config.description}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="space-y-1">
                      {isConfigured ? (
                        <>
                          <Badge variant="default" className="bg-success/10 text-success border border-success/20">
                            <Check className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                          {status.updated_at && (
                            <div className="text-xs text-muted-foreground">
                              {new Date(status.updated_at).toLocaleDateString()}
                            </div>
                          )}
                        </>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border">Not Configured</Badge>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center space-x-2 max-w-md">
                      <Input
                        type="password"
                        value={apiKeys[config.provider] || ''}
                        onChange={(e) => handleKeyChange(config.provider, e.target.value)}
                        placeholder={isConfigured && !apiKeys[config.provider] ? '••••••••••••••••••••••••••••••••' : config.keyPrefix + '...'}
                        disabled={saving[config.provider] || deleting[config.provider]}
                        className="bg-background border border-border"
                      />
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(config.getKeyUrl, '_blank')}
                        className="border border-border hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Get Key
                      </Button>
                      {isConfigured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteAPIKey(config.provider)}
                          disabled={deleting[config.provider] || saving[config.provider]}
                          className="border border-destructive/50 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deleting[config.provider] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => saveAPIKey(config.provider)}
                        disabled={saving[config.provider] || deleting[config.provider] || !apiKeys[config.provider]}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {saving[config.provider] ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            {isConfigured ? 'Update' : 'Save'}
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

