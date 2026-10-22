import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/integrations/gmail';
import { useConnections, VaultService, useIntegrationsByClassification } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

// Imported extracted components
import { ConnectedChannelsList } from './ConnectedChannelsList';
import { AvailableChannelsList } from './AvailableChannelsList';
import { ChannelSetupForms } from './ChannelSetupForms';
import { ChannelPermissionsModal } from './ChannelPermissionsModal';
import { useChannelsModalState } from './useChannelsModalState';
import { useChannelPermissions } from './useChannelPermissions';

interface EnhancedChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function EnhancedChannelsModalRefactored({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: EnhancedChannelsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const vaultService = new VaultService(supabase);
  
  // Hooks for data fetching
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification('channel');
  
  // DEBUG: Log loaded integrations and connections
  useEffect(() => {
    console.log('[EnhancedChannelsModal] Loaded channel integrations:', integrations.map(i => ({ name: i.name, id: i.id, agent_classification: i.agent_classification })));
  }, [integrations]);
  
  useEffect(() => {
    console.log('[EnhancedChannelsModal] Loaded connections from useConnections hook:');
    console.log('Raw connections data:', connections);
    console.log('Mapped connections:', connections.map(c => ({ 
      connection_id: c.connection_id || c.id,
      provider_name: c.provider_name,
      provider_display_name: c.provider_display_name,
      connection_name: c.connection_name,
      external_username: c.external_username,
      connection_status: c.connection_status,
      credential_type: c.credential_type
    })));
    console.log('Gmail connection exists?', connections.some(c => c.provider_name === 'gmail'));
  }, [connections]);
  
  // Capabilities state - fetch from database instead of hardcoding
  const [capabilitiesByIntegrationId, setCapabilitiesByIntegrationId] = useState<Record<string, any[]>>({});
  
  // Custom hooks for state and permissions
  const modalState = useChannelsModalState();
  const { agentPermissions, fetchAgentPermissions } = useChannelPermissions(agentId);

  // Fetch capabilities from database
  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        if (!integrations || integrations.length === 0) return;
        
        const ids = integrations.map(i => i.id);
        const { data } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', ids)
          .order('display_order');
          
        const capabilitiesMap: Record<string, any[]> = {};
        (data || []).forEach((row: any) => {
          if (!capabilitiesMap[row.integration_id]) {
            capabilitiesMap[row.integration_id] = [];
          }
          capabilitiesMap[row.integration_id].push({
            capability_key: row.capability_key,
            display_label: row.display_label,
            display_order: row.display_order
          });
        });
        
        setCapabilitiesByIntegrationId(capabilitiesMap);
      } catch (error) {
        console.warn('Failed to load integration capabilities:', error);
      }
    };

    loadCapabilities();
  }, [integrations, supabase]);

  // Helper functions
  const providerNameForServiceId = (serviceId: string) => {
    switch (serviceId) {
      case 'gmail': return 'gmail';
      case 'sendgrid': return 'sendgrid';
      case 'mailgun': return 'mailgun';
      default: return serviceId;
    }
  };

  const defaultScopesForService = (serviceId: string): string[] => {
    if (serviceId === 'gmail') return [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ];
    if (serviceId === 'sendgrid') return ['sendgrid_send_email', 'sendgrid_email_templates', 'sendgrid_email_stats'];
    if (serviceId === 'mailgun') return ['mailgun_send_email', 'mailgun_email_templates', 'mailgun_email_stats', 'mailgun_email_validation', 'mailgun_suppression_management'];
    if (serviceId === 'smtp') return ['smtp_send_email', 'smtp_email_templates', 'smtp_email_stats'];
    return [];
  };

  // Handler functions
  const handleOAuthSetup = async (serviceId: string) => {
    if (serviceId === 'gmail') {
      modalState.setConnectingService(serviceId);
      try {
        console.log('Initiating Gmail OAuth flow');
        await gmailInitiateOAuth();
        
        await refetchConnections();
        await fetchAgentPermissions();
        
        toast.success('Gmail connected successfully! 🎉');
        modalState.setSaved(true);
        modalState.setSetupService(null);
        modalState.setActiveTab('connected');
      } catch (error: any) {
        console.error('OAuth setup error:', error);
        modalState.setError(error.message || 'Failed to connect OAuth service');
        toast.error('Failed to connect. Please try again.');
      } finally {
        modalState.setConnectingService(null);
      }
    } else {
      modalState.setConnectingService(null);
      modalState.setSetupService(null);
      toast.info(`${serviceId} integration coming soon! 🚀`);
      return;
    }
  };

  const handleSendGridSetup = async () => {
    if (!user) return;
    
    modalState.setConnectingService('sendgrid');
    modalState.setError(null);
    
    try {
      // Validate inputs
      if (!modalState.apiKey.trim()) {
        modalState.setError('API key is required');
        return;
      }
      if (!modalState.fromEmail.trim()) {
        modalState.setError('From email is required');
        return;
      }
      
      // Store API key in vault
      const vaultKeyId = await vaultService.createSecret(
        `sendgrid_api_key_${user.id}`,
        modalState.apiKey,
        'SendGrid API key'
      );
      
      // Resolve provider id and create connection record
      const { data: sgProvider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'sendgrid')
        .single();
      if (providerError || !sgProvider) throw providerError || new Error('SendGrid provider missing');

      const { error: connError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: sgProvider.id,
          connection_name: modalState.connectionName || 'SendGrid Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: vaultKeyId,
          external_username: modalState.fromEmail || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (connError) throw connError;
      
      await refetchConnections();
      
      toast.success('SendGrid connected successfully! 📧');
      modalState.setSaved(true);
      modalState.setSetupService(null);
      modalState.setActiveTab('connected');
      modalState.resetForm();
      
    } catch (error: any) {
      console.error('SendGrid setup error:', error);
      modalState.setError(error.message || 'Failed to connect SendGrid');
      toast.error('Failed to connect SendGrid. Please try again.');
    } finally {
      modalState.setConnectingService(null);
    }
  };

  const handleMailgunSetup = async () => {
    if (!user) return;
    modalState.setConnectingService('mailgun');
    modalState.setError(null);
    
    try {
      if (!modalState.apiKey.trim()) { 
        modalState.setError('API key is required'); 
        return; 
      }
      if (!modalState.mailgunDomain.trim()) { 
        modalState.setError('Domain is required'); 
        return; 
      }

      const { data: mgProvider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();
      if (providerError || !mgProvider) throw providerError || new Error('Mailgun provider missing');

      console.log('Securing Mailgun API key with vault encryption');
      const secretName = `mailgun_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        modalState.apiKey,
        `Mailgun API key for ${modalState.mailgunDomain} - Created: ${new Date().toISOString()}`
      );
      
      console.log(`✅ Mailgun API key securely stored in vault: ${vaultKeyId}`);

      const { error: connError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: mgProvider.id,
          connection_name: modalState.connectionName || 'Mailgun Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: vaultKeyId,
          external_username: modalState.mailgunDomain,
          created_at: new Date().toISOString()
        });
      
      if (connError) throw connError;

      await refetchConnections();
      toast.success('Mailgun connected successfully! 🚀');
      modalState.setSaved(true);
      modalState.setSetupService(null);
      modalState.setActiveTab('connected');
      modalState.resetForm();

    } catch (error: any) {
      console.error('Mailgun setup error:', error);
      modalState.setError(error.message || 'Failed to connect Mailgun');
      toast.error('Failed to connect Mailgun. Please try again.');
    } finally {
      modalState.setConnectingService(null);
    }
  };

  const handleSMTPSetup = async () => {
    if (!user) return;
    
    modalState.setConnectingService('smtp');
    modalState.setError(null);
    
    try {
      // Validate inputs
      if (!modalState.smtpHost.trim()) {
        modalState.setError('SMTP Host is required');
        return;
      }
      if (!modalState.smtpPort.trim()) {
        modalState.setError('SMTP Port is required');
        return;
      }
      if (!modalState.smtpUsername.trim()) {
        modalState.setError('Username is required');
        return;
      }
      if (!modalState.smtpPassword.trim()) {
        modalState.setError('Password is required');
        return;
      }
      if (!modalState.fromEmail.trim()) {
        modalState.setError('From email is required');
        return;
      }

      // Find SMTP provider
      const { data: smtpProvider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'smtp')
        .single();
      if (providerError || !smtpProvider) throw providerError || new Error('SMTP provider missing');

      // Store SMTP configuration in vault
      const smtpConfig = {
        host: modalState.smtpHost,
        port: parseInt(modalState.smtpPort),
        secure: modalState.smtpSecure === 'ssl',
        auth: {
          user: modalState.smtpUsername,
          pass: modalState.smtpPassword
        },
        tls: modalState.smtpSecure === 'tls' ? { rejectUnauthorized: false } : undefined,
        from_email: modalState.fromEmail,
        from_name: modalState.fromName || undefined
      };

      console.log('Securing SMTP configuration with vault encryption');
      const secretName = `smtp_config_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        smtpConfig,
        `SMTP server configuration for ${modalState.smtpHost}:${modalState.smtpPort} - Created: ${new Date().toISOString()}`
      );

      // Save connection record
      const { data: credential, error: credError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: smtpProvider.id,
          external_user_id: user.id, // Required field
          external_username: modalState.smtpUsername,
          connection_name: modalState.connectionName || 'SMTP.com',
          vault_access_token_id: vaultKeyId, // ✅ Fixed: use correct column name
          connection_status: 'active',
          credential_type: 'api_key'
        })
        .select()
        .single();
      if (credError || !credential) throw credError || new Error('Failed to save SMTP credential');

      await refetchConnections();
      await refetchIntegrationPermissions();
      
      toast.success('SMTP server connected successfully! 🚀');
      modalState.setSaved(true);
      modalState.setSetupService(null);
      modalState.setActiveTab('connected');
      modalState.resetForm();

    } catch (error: any) {
      console.error('SMTP setup error:', error);
      modalState.setError(error.message || 'Failed to setup SMTP server');
      toast.error('Failed to connect SMTP server. Please try again.');
    } finally {
      modalState.setConnectingService(null);
    }
  };

  const handleModifyPermissions = (connection: any) => {
    modalState.setEditingPermission(connection);
    modalState.setSelectedScopes(connection.allowed_scopes || defaultScopesForService(connection.provider_name));
    modalState.setShowPermissionsModal(true);
  };

  const renderCredentialSelector = (serviceId: string) => {
    const provider = providerNameForServiceId(serviceId);
    
    // DEBUG: Log credential selection process
    console.log('[renderCredentialSelector] Service:', serviceId, 'Provider:', provider);
    console.log('[renderCredentialSelector] All connections:', connections.map(c => ({ 
      provider_name: c.provider_name, 
      connection_name: c.connection_name,
      connection_status: c.connection_status,
      connection_id: c.connection_id || c.id,
      external_username: c.external_username
    })));
    
    // Database-driven credential filtering - no special cases
    const creds = connections.filter(c => c.provider_name === provider && c.connection_status === 'active');
    
    console.log('[renderCredentialSelector] Filtered credentials for', serviceId, ':', creds);
    
    if (creds.length === 0) {
      return (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground text-center py-4">
            No saved credentials for this service.
          </div>
          
          {/* Add new credential button */}
          <div className="pt-2 border-t">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                console.log('[renderCredentialSelector] No existing credentials, redirecting to setup for', serviceId);
                modalState.setSelectingCredentialFor(null);
                modalState.setSetupService(serviceId);
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> 
              Add new credential
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {creds.map((c) => {
          // Use same data structure as working Credentials page
          const connectionId = c.connection_id || c.id;
          
          // Use database-driven display name - no special cases
          const displayName = c.provider_display_name || c.provider_name;
            
          return (
            <div key={connectionId} className="flex items-center justify-between p-3 border rounded">
              <div className="text-sm">
                <div className="font-medium">{displayName}</div>
                <div className="text-muted-foreground">{c.external_username || c.connection_name}</div>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    modalState.setConnectingService(serviceId);
                    
                    // Use database-driven scopes - no special cases
                    const scopes = defaultScopesForService(serviceId);
                    
                    const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
                      p_agent_id: agentId,
                      p_connection_id: connectionId,
                      p_allowed_scopes: scopes,
                      p_permission_level: 'custom',
                      p_user_id: user?.id
                    });
                    if (grantError) throw grantError;
                    await fetchAgentPermissions();
                    modalState.setSelectingCredentialFor(null);
                    modalState.setActiveTab('connected');
                  } catch (e) {
                    console.error('Grant permission error', e);
                    toast.error('Failed to authorize agent');
                  } finally {
                    modalState.setConnectingService(null);
                  }
              }}
            >
              Authorize Agent
            </Button>
          </div>
          );
        })}
        
        {/* Add new credential button */}
        <div className="pt-2 border-t">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              modalState.setSelectingCredentialFor(null);
              modalState.setSetupService(serviceId);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> 
            Add new credential
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            💬 Channels
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect communication channels and manage permissions for your agent.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          <Tabs value={modalState.activeTab} onValueChange={modalState.setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connected">Connected Channels</TabsTrigger>
              <TabsTrigger value="available">Add New Channel</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                <ConnectedChannelsList
                  agentPermissions={agentPermissions}
                  integrations={integrations}
                  capabilitiesByIntegrationId={capabilitiesByIntegrationId}
                  onModifyPermissions={handleModifyPermissions}
                  onRemoveSuccess={fetchAgentPermissions}
                  onAddChannel={() => modalState.setActiveTab('available')}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                <AvailableChannelsList
                  integrations={integrations}
                  agentPermissions={agentPermissions}
                  connections={connections}
                  setupService={modalState.setupService}
                  selectingCredentialFor={modalState.selectingCredentialFor}
                  connectingService={modalState.connectingService}
                  capabilitiesByIntegrationId={capabilitiesByIntegrationId}
                  onSetupClick={modalState.setSetupService}
                  onSelectCredentialClick={modalState.setSelectingCredentialFor}
                  onCancelSetup={() => {
                    modalState.setSetupService(null);
                    modalState.setSelectingCredentialFor(null);
                  }}
                  renderSetupFlow={(service) => (
                    <ChannelSetupForms
                      service={service}
                      connectingService={modalState.connectingService}
                      connectionName={modalState.connectionName}
                      apiKey={modalState.apiKey}
                      fromEmail={modalState.fromEmail}
                      fromName={modalState.fromName}
                      mailgunDomain={modalState.mailgunDomain}
                      smtpHost={modalState.smtpHost}
                      smtpPort={modalState.smtpPort}
                      smtpSecure={modalState.smtpSecure}
                      smtpUsername={modalState.smtpUsername}
                      smtpPassword={modalState.smtpPassword}
                      error={modalState.error}
                      onConnectionNameChange={modalState.setConnectionName}
                      onApiKeyChange={modalState.setApiKey}
                      onFromEmailChange={modalState.setFromEmail}
                      onFromNameChange={modalState.setFromName}
                      onMailgunDomainChange={modalState.setMailgunDomain}
                      onSMTPHostChange={modalState.setSMTPHost}
                      onSMTPPortChange={modalState.setSMTPPort}
                      onSMTPSecureChange={modalState.setSMTPSecure}
                      onSMTPUsernameChange={modalState.setSMTPUsername}
                      onSMTPPasswordChange={modalState.setSMTPPassword}
                      onOAuthSetup={handleOAuthSetup}
                      onSendGridSetup={handleSendGridSetup}
                      onMailgunSetup={handleMailgunSetup}
                      onSMTPSetup={handleSMTPSetup}
                      onSetupService={modalState.setSetupService}
                      onSetupCancel={() => modalState.setSetupService(null)}
                    />
                  )}
                  renderCredentialSelector={renderCredentialSelector}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Permission Management Modal */}
      <ChannelPermissionsModal
        isOpen={modalState.showPermissionsModal}
        onClose={() => modalState.setShowPermissionsModal(false)}
        agentId={agentId}
        editingPermission={modalState.editingPermission}
        onPermissionUpdated={fetchAgentPermissions}
      />
    </Dialog>
  );
}
