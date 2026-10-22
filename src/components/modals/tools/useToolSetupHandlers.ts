import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { VaultService } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';
import { SEARCH_PROVIDERS, OCR_PROVIDERS } from './toolConstants';

interface ToolSetupHandlersProps {
  agentId: string;
  modalState: {
    selectedProvider: string;
    apiKey: string;
    connectionName: string;
    setConnectingService: (service: string | null) => void;
    setError: (error: string | null) => void;
    setSaved: (saved: boolean) => void;
    setSetupService: (service: string | null) => void;
    resetForm: () => void;
    setActiveTab: (tab: string) => void;
  };
  refetchIntegrationPermissions: () => Promise<void>;
  refetchConnections: () => Promise<void>;
}

export function useToolSetupHandlers({
  agentId,
  modalState,
  refetchIntegrationPermissions,
  refetchConnections
}: ToolSetupHandlersProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const vaultService = new VaultService(supabase);

  const handleApiKeySetup = async (toolId: string) => {
    if (!modalState.selectedProvider || !modalState.apiKey || !user) {
      modalState.setError('Please select a provider and enter an API key');
      return;
    }

    modalState.setConnectingService(toolId);
    modalState.setError(null);

    try {
      // Get provider configuration
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', modalState.selectedProvider)
        .single();

      if (providerError) throw providerError;

      // Create vault secret for API key
      const secretName = `${modalState.selectedProvider}_api_key_${user.id}_${Date.now()}`;
      const { data: vaultSecretId, error: vaultError } = await supabase.rpc('create_vault_secret', {
        p_secret: modalState.apiKey,
        p_name: secretName,
        p_description: `${modalState.selectedProvider} API key for user ${user.id} - Created: ${new Date().toISOString()}`
      });

      if (vaultError || !vaultSecretId) {
        throw new Error(`Failed to secure API key in vault: ${vaultError?.message}`);
      }

      // Store connection
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: modalState.connectionName || `${modalState.selectedProvider} Connection`,
          connection_name: modalState.connectionName || `${modalState.selectedProvider} Connection`,
          encrypted_access_token: null,
          vault_access_token_id: vaultSecretId,
          scopes_granted: ['web_search', 'news_search', 'image_search'],
          connection_status: 'active',
          credential_type: 'api_key'
        })
        .select('id')
        .single();

      if (insertError || !connectionData) throw insertError || new Error('Failed to create API key connection');

      // Associate with agent
      const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: connectionData.id,
        p_allowed_scopes: ['web_search','news_search','image_search','local_search'],
        p_permission_level: 'custom',
        p_user_id: user.id
      });

      if (grantError) throw grantError;

      await refetchIntegrationPermissions();

      // Get the tool name
      const providerInfo = SEARCH_PROVIDERS.find(p => p.id === modalState.selectedProvider) || 
                           OCR_PROVIDERS.find(p => p.id === modalState.selectedProvider);
      const toolName = toolId === 'web_search' 
        ? `Web Search (${providerInfo?.name || modalState.selectedProvider})`
        : toolId === 'ocr_processing'
        ? `OCR Processing (${providerInfo?.name || modalState.selectedProvider})`
        : modalState.selectedProvider;

      toast.success(`${toolName} connected successfully! 🎉`);
      modalState.setSaved(true);
      modalState.setSetupService(null);
      modalState.resetForm();
      
      await refetchConnections();
      modalState.setActiveTab('connected');
    } catch (error: any) {
      console.error('API key setup error:', error);
      modalState.setError(error.message || 'Failed to connect API key');
      toast.error('Failed to connect API key. Please try again.');
    } finally {
      modalState.setConnectingService(null);
    }
  };

  const handleDigitalOceanSetup = async () => {
    if (!user || !modalState.apiKey.trim()) {
      modalState.setError('API token is required');
      return;
    }

    modalState.setConnectingService('digitalocean');
    modalState.setError(null);

    try {
      // Get DigitalOcean OAuth provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'digitalocean')
        .single();

      if (providerError) throw providerError;

      // Store API key securely in vault
      const secretName = `digitalocean_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        modalState.apiKey,
        `DigitalOcean API key - Created: ${new Date().toISOString()}`
      );

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: modalState.connectionName || 'DigitalOcean Connection',
          connection_name: modalState.connectionName || 'DigitalOcean Connection',
          encrypted_access_token: null,
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['droplet:read', 'image:read', 'region:read', 'size:read'],
          connection_status: 'active',
          credential_type: 'api_key'
        })
        .select('id')
        .single();

      if (insertError || !connectionData) throw insertError || new Error('Failed to create DigitalOcean connection');

      // Associate the DigitalOcean connection with this agent
      const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: connectionData.id,
        p_allowed_scopes: ['droplet:read', 'droplet:create', 'droplet:delete', 'image:read', 'region:read', 'size:read'],
        p_permission_level: 'custom',
        p_user_id: user.id
      });

      if (grantError) throw grantError;

      await refetchIntegrationPermissions();

      toast.success('DigitalOcean API key connected successfully! 🎉');
      
      modalState.resetForm();
      modalState.setSetupService(null);
      await refetchConnections();
      modalState.setActiveTab('connected');

    } catch (err: any) {
      console.error('Error connecting DigitalOcean API key:', err);
      modalState.setError(err.message || 'Failed to connect DigitalOcean API key');
      toast.error('Failed to connect DigitalOcean API key');
    } finally {
      modalState.setConnectingService(null);
    }
  };

  return {
    handleApiKeySetup,
    handleDigitalOceanSetup
  };
}

