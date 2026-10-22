import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useChannelPermissions } from '../channels/useChannelPermissions';
import { useAgentIntegrationPermissions } from '@/integrations/_shared/hooks/useAgentIntegrationPermissions';
import { StandaloneIntegrationSetupModal } from './StandaloneIntegrationSetupModal';
import { toast } from 'react-hot-toast';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Loader2, 
  Save,
  ExternalLink,
  Settings,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ChannelsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

interface ChannelSettings {
  email_enabled: boolean;
  sms_enabled: boolean;
  slack_enabled: boolean;
  discord_enabled: boolean;
  telegram_enabled: boolean;
  whatsapp_enabled: boolean;
}



export function ChannelsTab({ agentId, agentData, onAgentUpdated }: ChannelsTabProps) {
  const [settings, setSettings] = useState<ChannelSettings>({
    email_enabled: false,
    sms_enabled: false,
    slack_enabled: false,
    discord_enabled: false,
    telegram_enabled: false,
    whatsapp_enabled: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [credentialModal, setCredentialModal] = useState({
    isOpen: false,
    channelType: null as 'email' | 'sms' | null,
    selectedProvider: '',
    availableProviders: [] as any[],
    availableCredentials: [] as any[]
  });
  
  const [integrationSetupModal, setIntegrationSetupModal] = useState({
    isOpen: false,
    providerName: '',
    channelType: null as 'email' | 'sms' | null
  });
  const [newApiKey, setNewApiKey] = useState('');
  const [newBotToken, setNewBotToken] = useState('');

  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  // Use the comprehensive permission system
  const { agentPermissions, fetchAgentPermissions } = useChannelPermissions(agentId);
  const { permissions: integrationPermissions, refetch: refetchPermissions } = useAgentIntegrationPermissions(agentId);

  // Function to check if a channel is actually enabled based on active permissions
  const isChannelEnabled = useCallback((channelType: string): boolean => {
    const providerMap: Record<string, string[]> = {
      email: ['gmail', 'smtp', 'smtp_server', 'sendgrid', 'mailgun', 'microsoft-outlook'],
      sms: ['twilio', 'aws_sns', 'clicksend_sms'],
      slack: ['slack'],
      discord: ['discord'],
      telegram: ['telegram'],
      whatsapp: ['whatsapp_business']
    };

    const providers = providerMap[channelType] || [];
    const actualProviderNames = agentPermissions.map(perm => perm.provider_name);
    console.log(`[isChannelEnabled] Checking ${channelType}:`, {
      expectedProviders: providers,
      actualProviderNames,
      agentPermissions,
      activePermissions: agentPermissions.filter(perm => perm.is_active),
      matchingPermissions: agentPermissions.filter(perm => 
        perm.is_active && providers.includes(perm.provider_name)
      ),
      providerNameMatches: actualProviderNames.map(name => ({
        name,
        matchesExpected: providers.includes(name)
      }))
    });
    
    return agentPermissions.some(perm => 
      perm.is_active && providers.includes(perm.provider_name)
    );
  }, [agentPermissions]);

  useEffect(() => {
    console.log('[ChannelsTab] agentPermissions updated:', agentPermissions);
    
    // Channel toggle state shows whether there are active permissions
    // But the cards themselves should always be clickable/active
    const newSettings = {
      email_enabled: isChannelEnabled('email'),
      sms_enabled: isChannelEnabled('sms'),
      slack_enabled: isChannelEnabled('slack'),
      discord_enabled: isChannelEnabled('discord'),
      telegram_enabled: isChannelEnabled('telegram'),
      whatsapp_enabled: isChannelEnabled('whatsapp')
    };
    
    console.log('[ChannelsTab] New settings:', newSettings);
    setSettings(newSettings);
  }, [agentPermissions, isChannelEnabled]);



  const handleToggle = async (channel: keyof ChannelSettings, enabled: boolean) => {
    if (enabled && channel === 'email_enabled') {
      // Only open modal if it's not already open to prevent reopening loop
      if (!credentialModal.isOpen) {
        await openEmailProviderModal();
      }
      return;
    }
    
    if (enabled && channel === 'sms_enabled') {
      // Only open modal if it's not already open to prevent reopening loop
      if (!credentialModal.isOpen) {
        await openSmsProviderModal();
      }
      return;
    }
    
    if (!enabled) {
      // Disable channel by revoking permissions
      await handleDisableChannel(channel);
      return;
    }
    
    // For other channels, just update the local state for now
    setSettings(prev => ({ ...prev, [channel]: enabled }));
    setHasChanges(true);
  };

  const handleDisableChannel = async (channel: keyof ChannelSettings) => {
    try {
      const channelType = channel.replace('_enabled', '');
      const providerMap: Record<string, string[]> = {
        email: ['gmail', 'smtp', 'sendgrid', 'mailgun', 'microsoft-outlook'], // Include for cleanup of existing permissions
        sms: ['twilio', 'aws_sns', 'clicksend_sms'],
        slack: ['slack'],
        discord: ['discord'],
        telegram: ['telegram'],
        whatsapp: ['whatsapp_business']
      };

      const providers = providerMap[channelType] || [];
      
      // Find active permissions for this channel type
      const activePermissions = agentPermissions.filter(perm => 
        perm.is_active && providers.includes(perm.provider_name)
      );

      // Revoke all active permissions for this channel
      for (const permission of activePermissions) {
        const { error } = await supabase
          .from('agent_integration_permissions')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', permission.id);

        if (error) throw error;
      }

      // Refresh permissions to update the UI
      await fetchAgentPermissions();
      await refetchPermissions();
      
      toast.success(`${channelType.charAt(0).toUpperCase() + channelType.slice(1)} channel disabled`);
    } catch (error) {
      console.error('Error disabling channel:', error);
      toast.error('Failed to disable channel');
    }
  };

  const openEmailProviderModal = async () => {
    // Check for existing email credentials in your system
    try {
      const { data: credentials, error } = await supabase
        .from('user_integration_credentials')
        .select(`
          *,
          service_providers!inner(name, display_name)
        `)
        .eq('user_id', user?.id)
        .in('connection_status', ['active', 'connected'])
        .in('service_providers.name', ['smtp', 'sendgrid', 'mailgun', 'gmail', 'microsoft-outlook']);

      if (error) {
        console.error('Error loading email credentials:', error);
      }

      // Show provider selection modal with existing credentials
      setCredentialModal({
        isOpen: true,
        channelType: 'email',
        selectedProvider: '',
        availableProviders: [
          { id: 'smtp', name: 'SMTP', description: 'Generic SMTP server', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
          { id: 'gmail', name: 'Gmail', description: 'Google Gmail', requiresApiKey: false, requiresOAuth: true, authType: 'oauth' },
          { id: 'microsoft-outlook', name: 'Microsoft Outlook', description: 'Microsoft Outlook/Office 365', requiresApiKey: false, requiresOAuth: true, authType: 'oauth' },
          { id: 'sendgrid', name: 'SendGrid', description: 'SendGrid email service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
          { id: 'mailgun', name: 'Mailgun', description: 'Mailgun email service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' }
        ],
        availableCredentials: credentials || []
      });
    } catch (error) {
      console.error('Error opening email provider modal:', error);
      toast.error('Failed to load email providers');
    }
  };

  const openSmsProviderModal = async () => {
    // Check for existing SMS credentials in your system
    try {
      const { data: credentials, error } = await supabase
        .from('user_integration_credentials')
        .select(`
          *,
          service_providers!inner(name, display_name)
        `)
        .eq('user_id', user?.id)
        .in('connection_status', ['active', 'connected'])
        .in('service_providers.name', ['twilio', 'aws_sns', 'clicksend_sms']);

      if (error) {
        console.error('Error loading SMS credentials:', error);
      }

      // Show provider selection modal with existing credentials
      setCredentialModal({
        isOpen: true,
        channelType: 'sms',
        selectedProvider: '',
        availableProviders: [
          { id: 'clicksend_sms', name: 'ClickSend SMS', description: 'ClickSend SMS/MMS service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
          { id: 'twilio', name: 'Twilio', description: 'Twilio SMS service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' },
          { id: 'aws_sns', name: 'AWS SNS', description: 'Amazon Simple Notification Service', requiresApiKey: true, requiresOAuth: false, authType: 'api_key' }
        ],
        availableCredentials: credentials || []
      });
    } catch (error) {
      console.error('Error opening SMS provider modal:', error);
      toast.error('Failed to load SMS providers');
    }
  };

  // Helper function to map OAuth scopes to agent capabilities
  const mapOAuthScopesToAgentCapabilities = (oauthScopes: string[], providerName: string): string[] => {
  if (providerName === 'gmail') {
    const capabilities: string[] = [];
    
    // Core Gmail API scopes
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.send')) {
      capabilities.push('email.send');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.readonly')) {
      capabilities.push('email.read');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.modify')) {
      capabilities.push('email.modify');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.compose')) {
      capabilities.push('email.compose');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.insert')) {
      capabilities.push('email.insert');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.labels')) {
      capabilities.push('email.labels');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.metadata')) {
      capabilities.push('email.metadata');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.settings.basic')) {
      capabilities.push('email.settings.basic');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/gmail.settings.sharing')) {
      capabilities.push('email.settings.sharing');
    }
    
    // User profile scopes
    if (oauthScopes.includes('https://www.googleapis.com/auth/userinfo.email')) {
      capabilities.push('profile.email');
    }
    if (oauthScopes.includes('https://www.googleapis.com/auth/userinfo.profile')) {
      capabilities.push('profile.info');
    }
    
    // OpenID Connect
    if (oauthScopes.includes('openid')) {
      capabilities.push('openid');
    }
    if (oauthScopes.includes('email')) {
      capabilities.push('profile.email');
    }
    if (oauthScopes.includes('profile')) {
      capabilities.push('profile.info');
    }
    
    // Fallback: if no specific scopes found, grant basic send permission
    return capabilities.length > 0 ? capabilities : ['email.send'];
  }
  
  if (providerName === 'microsoft-outlook') {
    const capabilities: string[] = [];
    
    // Microsoft Graph API scopes
    if (oauthScopes.includes('https://graph.microsoft.com/Mail.Send')) {
      capabilities.push('email.send');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/Mail.Read')) {
      capabilities.push('email.read');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/Mail.ReadWrite')) {
      capabilities.push('email.read', 'email.modify');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/Calendars.Read')) {
      capabilities.push('calendar.read');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/Calendars.ReadWrite')) {
      capabilities.push('calendar.read', 'calendar.write');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/Contacts.Read')) {
      capabilities.push('contacts.read');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/Contacts.ReadWrite')) {
      capabilities.push('contacts.read', 'contacts.write');
    }
    if (oauthScopes.includes('https://graph.microsoft.com/User.Read')) {
      capabilities.push('profile.info');
    }
    
    // Fallback: if no specific scopes found, grant basic send permission
    return capabilities.length > 0 ? capabilities : ['email.send'];
  }
  
  // For SMS providers
  if (providerName === 'clicksend_sms') {
    const capabilities: string[] = [];
    
    // ClickSend MCP tool capabilities based on scopes (using actual MCP tool names)
    if (oauthScopes.includes('sms') || oauthScopes.includes('sms.send')) {
      capabilities.push('clicksend_send_sms');
    }
    if (oauthScopes.includes('mms') || oauthScopes.includes('mms.send')) {
      capabilities.push('clicksend_send_mms');
    }
    if (oauthScopes.includes('balance') || oauthScopes.includes('account.balance')) {
      capabilities.push('clicksend_get_balance');
    }
    if (oauthScopes.includes('history') || oauthScopes.includes('sms.history')) {
      capabilities.push('clicksend_get_sms_history');
    }
    if (oauthScopes.includes('delivery_receipts') || oauthScopes.includes('sms.delivery')) {
      capabilities.push('clicksend_get_delivery_receipts');
    }
    
    // Default ClickSend MCP tools if no specific scopes (grant basic SMS/MMS capabilities)
    return capabilities.length > 0 ? capabilities : ['clicksend_send_sms', 'clicksend_send_mms'];
  }
  
  if (providerName === 'twilio') {
    return ['sms.send', 'sms.receive'];
  }
  
  if (providerName === 'aws_sns') {
    return ['sms.send'];
  }
  
  // For other providers, default to basic capabilities
  if (providerName === 'smtp' || providerName === 'sendgrid' || providerName === 'mailgun') {
    return ['email.send'];
  }
  
  return ['email.send']; // Default fallback
};

  const handleAuthorizeCredential = async (credentialId: string) => {
    try {
      // First, get the credential details to understand what OAuth scopes are available
      const { data: credential, error: credentialError } = await supabase
        .from('user_integration_credentials')
        .select(`
          *,
          service_providers!inner(name, display_name)
        `)
        .eq('id', credentialId)
        .single();

      if (credentialError || !credential) {
        throw new Error('Could not fetch credential details');
      }

      const providerName = credential.service_providers.name;
      const oauthScopes = credential.scopes_granted || [];
      
      // Map OAuth scopes to agent capabilities
      const allowedScopes = mapOAuthScopesToAgentCapabilities(oauthScopes, providerName);
      
      console.log(`[ChannelsTab] Mapping OAuth scopes for ${providerName}:`, {
        oauthScopes,
        mappedCapabilities: allowedScopes
      });

      // Check if permission already exists
      const { data: existingPermission } = await supabase
        .from('agent_integration_permissions')
        .select('id, is_active')
        .eq('agent_id', agentId)
        .eq('user_oauth_connection_id', credentialId)
        .single();

      if (existingPermission) {
        // If permission exists but is inactive, reactivate it with proper scopes
        if (!existingPermission.is_active) {
          const { error } = await supabase
            .from('agent_integration_permissions')
            .update({
              is_active: true,
              allowed_scopes: allowedScopes,
              permission_level: 'custom',
              granted_by_user_id: user?.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPermission.id);

          if (error) throw error;
        } else {
          // Update existing active permission with correct scopes
          const { error } = await supabase
            .from('agent_integration_permissions')
            .update({
              allowed_scopes: allowedScopes,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPermission.id);

          if (error) throw error;
        }
      } else {
        // Create new permission with properly mapped scopes
        const { error } = await supabase
          .from('agent_integration_permissions')
          .insert({
            agent_id: agentId,
            user_oauth_connection_id: credentialId,
            allowed_scopes: allowedScopes,
            permission_level: 'custom',
            granted_by_user_id: user?.id,
            is_active: true
          });

        if (error) throw error;
      }

      // Refresh permissions to update the UI
      await fetchAgentPermissions();
      await refetchPermissions();
      
      setCredentialModal(prev => ({ ...prev, isOpen: false }));
      toast.success(`Agent authorized with ${allowedScopes.length} ${providerName} capabilities`);
    } catch (error) {
      console.error('Error authorizing credential:', error);
      toast.error('Failed to authorize email access');
    }
  };

  const handleProviderSelect = (providerId: string) => {
    setCredentialModal(prev => ({ ...prev, selectedProvider: providerId }));
  };

  const handleIntegrationSetupComplete = async (connection: any) => {
    // Close the integration setup modal
    setIntegrationSetupModal({ isOpen: false, providerName: '', channelType: null });
    
    // Refresh permissions to show the new connection
    await refetchPermissions();
    
    // Show success message
    toast.success(`${connection.provider_name} integration setup completed!`);
  };

  const handleIntegrationSetupClose = () => {
    setIntegrationSetupModal({ isOpen: false, providerName: '', channelType: null });
  };

  const handleCreateNewCredential = (providerId: string) => {
    // Close credential selection modal and open integration setup modal
    setCredentialModal(prev => ({ ...prev, isOpen: false }));
    
    // Open the standalone integration setup modal
    setIntegrationSetupModal({
      isOpen: true,
      providerName: providerId,
      channelType: credentialModal.channelType
    });
  };

  const handleCreateCredential = async () => {
    if (!credentialModal.selectedProvider || !user) return;

    const provider = credentialModal.availableProviders.find(p => p.id === credentialModal.selectedProvider);
    if (!provider) return;

    try {
      const authType = provider.authType || 'api_key';
      
      // For OAuth providers like Microsoft Outlook, open the proper setup modal
      if (authType === 'oauth') {
        setCredentialModal(prev => ({ ...prev, isOpen: false }));
        
        // For Microsoft Outlook, redirect to integrations page to use the proper OAuth setup
        if (provider.id === 'microsoft-outlook') {
          window.location.href = '/integrations?provider=microsoft-outlook';
          return;
        }
        
        // For other OAuth providers, show informational message
        toast(`Please set up ${provider.name} in the Integrations page first. OAuth providers require proper authentication flow.`, {
          icon: 'ℹ️',
          duration: 4000,
        });
        return;
      }
      
      if (authType === 'api_key' && !newApiKey.trim()) {
        toast.error('API key is required');
        return;
      }
      
      if (authType === 'bot_token' && !newBotToken.trim()) {
        toast.error('Bot token is required');
        return;
      }

      // Find the service provider ID from the database
      const { data: serviceProvider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', provider.id)
        .single();

      if (providerError || !serviceProvider) {
        throw new Error(`Service provider ${provider.id} not found`);
      }

      const credentialValue = authType === 'bot_token' ? newBotToken : newApiKey;
      
      const configuration = {
        provider: provider.id,
        auth_type: authType,
        [authType]: credentialValue
      };

      const credentialData = {
        user_id: user.id,
        service_provider_id: serviceProvider.id, // Use the correct column name
        external_user_id: `${authType}_${Date.now()}`,
        external_username: provider.name || null,
        connection_name: `${credentialModal.channelType}_${provider.id}`,
        connection_status: 'active' as const,
        credential_type: authType as 'api_key',
        scopes_granted: ['channel_access'],
        vault_access_token_id: credentialValue,
        vault_refresh_token_id: null,
        token_expires_at: null,
        connection_metadata: configuration
      };

      const { error } = await supabase
        .from('user_integration_credentials')
        .insert(credentialData);

      if (error) throw error;

      toast.success(`${provider.name} credentials saved successfully`);
      setNewApiKey('');
      setNewBotToken('');
      setCredentialModal(prev => ({ ...prev, isOpen: false }));
      
      // Refresh permissions to update the UI
      await refetchPermissions();
      
    } catch (error) {
      console.error('Error creating credential:', error);
      toast.error('Failed to save credentials. Please try again.');
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('agents')
        .update({
          email_enabled: settings.email_enabled,
          sms_enabled: settings.sms_enabled,
          slack_enabled: settings.slack_enabled,
          discord_enabled: settings.discord_enabled,
          telegram_enabled: settings.telegram_enabled,
          whatsapp_enabled: settings.whatsapp_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;

      toast.success('Channel settings updated successfully');
      setHasChanges(false);
      onAgentUpdated?.(data);
    } catch (error) {
      console.error('Error updating channel settings:', error);
      toast.error('Failed to update channel settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get connected providers for a channel
  const getConnectedProviders = (channelType: string): string[] => {
    const providerMap: Record<string, string[]> = {
      email: ['gmail', 'smtp', 'sendgrid', 'mailgun', 'microsoft-outlook'],
      sms: ['twilio', 'aws_sns', 'clicksend_sms'],
      slack: ['slack'],
      discord: ['discord'],
      telegram: ['telegram'],
      whatsapp: ['whatsapp_business']
    };

    const providers = providerMap[channelType] || [];
    return agentPermissions
      .filter(perm => perm.is_active && providers.includes(perm.provider_name))
      .map(perm => perm.provider_name.charAt(0).toUpperCase() + perm.provider_name.slice(1));
  };

  // Function to check if credentials exist for a channel (even if not currently active)
  const hasCredentialsForChannel = async (channelType: string): Promise<boolean> => {
    try {
      const providerMap: Record<string, string[]> = {
        email: ['gmail', 'smtp', 'sendgrid', 'mailgun', 'microsoft-outlook'],
        sms: ['twilio', 'aws_sns', 'clicksend_sms'],
        slack: ['slack'],
        discord: ['discord'],
        telegram: ['telegram'],
        whatsapp: ['whatsapp_business']
      };

      const providers = providerMap[channelType] || [];
      
      const { data: credentials } = await supabase
        .from('user_integration_credentials')
        .select('service_providers!inner(name)')
        .eq('user_id', user?.id)
        .in('connection_status', ['active', 'connected'])
        .in('service_providers.name', providers);

      return (credentials?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  };

  const channels = [
    {
      id: 'email_enabled' as keyof ChannelSettings,
      name: 'Email',
      description: 'Send and receive emails through various providers',
      icon: Mail,
      enabled: settings.email_enabled,
      requiresAuth: 'API or OAuth',
      providers: getConnectedProviders('email'),
      status: (settings.email_enabled && getConnectedProviders('email').length > 0) ? 'configured' : 'not_configured'
    },
    {
      id: 'sms_enabled' as keyof ChannelSettings,
      name: 'SMS',
      description: 'Send and receive text messages',
      icon: Phone,
      enabled: settings.sms_enabled,
      requiresAuth: 'API',
      providers: getConnectedProviders('sms'),
      status: (settings.sms_enabled && getConnectedProviders('sms').length > 0) ? 'configured' : 'not_configured'
    },
    {
      id: 'slack_enabled' as keyof ChannelSettings,
      name: 'Slack',
      description: 'Interact in Slack channels and direct messages',
      icon: MessageSquare,
      enabled: settings.slack_enabled,
      requiresAuth: 'OAuth',
      providers: getConnectedProviders('slack'),
      status: settings.slack_enabled ? 'configured' : 'not_configured',
      disabled: true // Not yet implemented
    },
    {
      id: 'discord_enabled' as keyof ChannelSettings,
      name: 'Discord',
      description: 'Respond to mentions in Discord servers',
      icon: MessageSquare,
      enabled: settings.discord_enabled,
      requiresAuth: 'Bot Token',
      providers: getConnectedProviders('discord'),
      status: settings.discord_enabled ? 'configured' : 'not_configured',
      disabled: true // Not yet implemented
    },
    {
      id: 'telegram_enabled' as keyof ChannelSettings,
      name: 'Telegram',
      description: 'Chat with users on Telegram',
      icon: MessageSquare,
      enabled: settings.telegram_enabled,
      requiresAuth: 'Bot Token',
      providers: getConnectedProviders('telegram'),
      status: settings.telegram_enabled ? 'configured' : 'not_configured',
      disabled: true // Not yet implemented
    },
    {
      id: 'whatsapp_enabled' as keyof ChannelSettings,
      name: 'WhatsApp',
      description: 'Send and receive WhatsApp messages',
      icon: MessageSquare,
      enabled: settings.whatsapp_enabled,
      requiresAuth: 'API',
      providers: getConnectedProviders('whatsapp'),
      status: settings.whatsapp_enabled ? 'configured' : 'not_configured',
      disabled: true // Not yet implemented
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Communication Channels</h3>
        <p className="text-sm text-muted-foreground">
          Configure which communication channels your agent can use to interact with users.
        </p>
      </div>

      <div className="space-y-4">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const isConfigured = channel.status === 'configured';
          const isDisabled = (channel as any).disabled;
          
          return (
            <Card key={channel.id} className={isDisabled ? 'opacity-50' : ''}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      isDisabled
                        ? 'bg-muted text-muted-foreground/50'
                        : channel.enabled && isConfigured
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`font-medium ${isDisabled ? 'text-muted-foreground' : ''}`}>{channel.name}</h4>
                        {isDisabled ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground border-muted">
                            Coming Soon
                          </Badge>
                        ) : isConfigured ? (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {channel.requiresAuth} Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {isDisabled ? 'This integration is coming soon and not yet available.' : channel.description}
                      </p>
                      {!isDisabled && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            Providers:
                          </p>
                          {channel.providers.map((provider, index) => (
                            <Badge key={provider} variant="secondary" className="text-xs">
                              {provider}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!isConfigured && !isDisabled && (
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                    )}
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={channel.id}
                        checked={channel.enabled}
                        onCheckedChange={(checked) => handleToggle(channel.id, checked)}
                        disabled={isDisabled}
                      />
                      <Label htmlFor={channel.id} className="sr-only">
                        Toggle {channel.name}
                      </Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {/* Credential Configuration Modal */}
      <Dialog open={credentialModal.isOpen} onOpenChange={(open) => 
        setCredentialModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Configure {credentialModal.channelType?.toUpperCase()} Provider</span>
            </DialogTitle>
            <DialogDescription>
              Select a provider and configure your credentials to enable this communication channel.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Existing Credentials */}
            {credentialModal.availableCredentials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Existing Credentials</Label>
                <div className="space-y-2">
                  {credentialModal.availableCredentials.map((cred) => (
                    <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center space-x-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">
                            {cred.connection_name || cred.service_providers?.display_name || 'Email Account'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {cred.service_providers?.display_name || cred.service_providers?.name || 'Unknown Provider'}
                            {cred.external_username && ` • ${cred.external_username}`}
                            {cred.connection_status && ` • ${cred.connection_status}`}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAuthorizeCredential(cred.id)}
                      >
                        Authorize Agent
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or create new</span>
                  </div>
                </div>
              </div>
            )}

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Provider</Label>
              <Select value={credentialModal.selectedProvider} onValueChange={handleProviderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {credentialModal.availableProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-muted-foreground">{provider.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credential Input */}
            {credentialModal.selectedProvider && (
              <div className="space-y-4">
                {(() => {
                  const provider = credentialModal.availableProviders.find(p => p.id === credentialModal.selectedProvider);
                  if (!provider) return null;

                  return (
                    <div className="space-y-3">
                      {provider.authType === 'api_key' && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center space-x-2">
                            <Key className="h-4 w-4" />
                            <span>API Key</span>
                          </Label>
                          <Input
                            type="password"
                            value={newApiKey}
                            onChange={(e) => setNewApiKey(e.target.value)}
                            placeholder="Enter your API key..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Your API key will be encrypted and stored securely.
                          </p>
                        </div>
                      )}

                      {provider.authType === 'bot_token' && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center space-x-2">
                            <Shield className="h-4 w-4" />
                            <span>Bot Token</span>
                          </Label>
                          <Input
                            type="password"
                            value={newBotToken}
                            onChange={(e) => setNewBotToken(e.target.value)}
                            placeholder="Enter your bot token..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Your bot token will be encrypted and stored securely.
                          </p>
                        </div>
                      )}
                      
                      {provider.authType === 'oauth' && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            This provider requires OAuth authentication. Click "Connect" to authorize access through {provider.name}.
                          </p>
                        </div>
                      )}

                      <div className="flex space-x-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setCredentialModal(prev => ({ ...prev, isOpen: false }))}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateCredential}
                          className="flex-1"
                          disabled={
                            (provider.authType === 'api_key' && !newApiKey.trim()) ||
                            (provider.authType === 'bot_token' && !newBotToken.trim())
                          }
                        >
                          {provider.authType === 'oauth' ? 'Connect' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Standalone Integration Setup Modal */}
      <StandaloneIntegrationSetupModal
        isOpen={integrationSetupModal.isOpen}
        onClose={handleIntegrationSetupClose}
        onComplete={handleIntegrationSetupComplete}
        providerName={integrationSetupModal.providerName}
        channelType={integrationSetupModal.channelType}
      />
    </div>
  );
}
