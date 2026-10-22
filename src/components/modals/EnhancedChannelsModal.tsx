import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  MessageSquare,
  Mail,
  Shield,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Settings,
  Key
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useGmailConnection } from '@/integrations/gmail';
import { useConnections, VaultService, useIntegrationsByClassification, useAgentIntegrationPermissions } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface EnhancedChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

export function EnhancedChannelsModal({
  isOpen,
  onClose,
  agentId
}: EnhancedChannelsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const vaultService = new VaultService(supabase);
  const { initiateOAuth: gmailInitiateOAuth } = useGmailConnection();
  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification('channel');
  
  // UI state
  const [activeTab, setActiveTab] = useState('connected');
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const [setupService, setSetupService] = useState<string | null>(null);
  const [selectingCredentialFor, setSelectingCredentialFor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editingPermission, setEditingPermission] = useState<AgentPermission | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  
  // Setup form state
  const [connectionName, setConnectionName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [mailgunDomain, setMailgunDomain] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState('tls');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Agent-level permissions (channels added to this agent)
  type AgentPermission = {
    id: string;
    connection_id: string;
    provider_name: string;
    external_username?: string | null;
    is_active: boolean;
    allowed_scopes?: string[];
  };
  const [agentPermissions, setAgentPermissions] = useState<AgentPermission[]>([]);

  // Static capability catalog per provider for display
  const CAPABILITIES: Record<string, { id: string; label: string }[]> = {
    gmail: [
      { id: 'send_email', label: 'Send Email' },
      { id: 'read_emails', label: 'Read Emails' },
      { id: 'modify_emails', label: 'Modify Labels' }
    ],
    sendgrid: [
      { id: 'send_email', label: 'Send Email' },
      { id: 'inbound', label: 'Inbound Routing' },
      { id: 'templates', label: 'Templates' },
      { id: 'analytics', label: 'Analytics' }
    ],
    mailgun: [
      { id: 'send_email', label: 'Send Email' },
      { id: 'validate', label: 'Validate Email' },
      { id: 'stats', label: 'Stats' },
      { id: 'suppressions', label: 'Suppressions' }
    ]
  };

  // DB-driven capabilities for channels
  type CapabilityRow = { capability_key: string; display_label: string; display_order: number };
  const [capabilitiesByIntegrationId, setCapabilitiesByIntegrationId] = useState<Record<string, CapabilityRow[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const ids = integrations.map(i => i.id);
        if (!ids.length) return;
        const { data } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', ids)
          .order('display_order');
        const map: Record<string, CapabilityRow[]> = {};
        (data || []).forEach((row: any) => {
          if (!map[row.integration_id]) map[row.integration_id] = [];
          map[row.integration_id].push({ capability_key: row.capability_key, display_label: row.display_label, display_order: row.display_order ?? 0 });
        });
        setCapabilitiesByIntegrationId(map);
      } catch {}
    })();
  }, [integrations, supabase]);

  // Use the new hook to fetch agent permissions
  const { permissions: integrationPermissions, refetch: refetchIntegrationPermissions } = useAgentIntegrationPermissions(agentId);

  useEffect(() => {
    // Map integration permissions to the format expected by this component
    const mappedPermissions = integrationPermissions.map(perm => ({
      id: perm.permission_id,
      connection_id: perm.connection_id,
      provider_name: perm.provider_name,
      external_username: perm.external_username,
      is_active: perm.is_active,
      allowed_scopes: perm.allowed_scopes || []
    }));
    setAgentPermissions(mappedPermissions);
  }, [integrationPermissions]);

  // Map DB integrations -> modal service definitions
  const mapIntegrationToService = (integration: { name: string; description?: string }) => {
    const lower = integration.name.toLowerCase();
    const icon = Mail; // default mail icon for channels
    let id = lower;
    let gradient = 'from-zinc-500 to-zinc-600';
    let type: 'oauth' | 'api_key' | 'coming_soon' = 'coming_soon';

    if (lower.includes('gmail')) {
      id = 'gmail';
      gradient = 'from-red-500 to-orange-500';
      type = 'oauth';
    } else if (lower.includes('sendgrid')) {
      id = 'sendgrid';
      gradient = 'from-blue-500 to-indigo-500';
      type = 'api_key';
    } else if (lower.includes('mailgun')) {
      id = 'mailgun';
      gradient = 'from-rose-500 to-pink-500';
      type = 'api_key';
    } else if (lower.includes('discord')) {
      id = 'discord';
      gradient = 'from-indigo-500 to-purple-500';
      type = 'oauth';
    } else if (lower.includes('slack')) {
      id = 'slack';
      gradient = 'from-green-500 to-teal-500';
      type = 'coming_soon';
    } else if (lower.includes('smtp')) {
      id = 'smtp';
      gradient = 'from-green-500 to-emerald-500';
      type = 'api_key';
    }

    return {
      id,
      name: integration.name,
      description: integration.description || '',
      icon,
      type,
      gradient
    } as const;
  };

  const renderCapabilitiesBadges = (provider: string, integrationId?: string) => {
    const dbCaps = integrationId ? (capabilitiesByIntegrationId as any)?.[integrationId] : null;
    const caps = dbCaps && dbCaps.length ? dbCaps.map((c: any) => ({ key: c.capability_key, label: c.display_label })) : (CAPABILITIES[provider?.toLowerCase()] || []);
    if (!caps || caps.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {caps.map((c: any) => (
          <Badge key={c.key || c.id} variant="secondary" className="text-xs">
            {c.label}
          </Badge>
        ))}
      </div>
    );
  };

  const handleMailgunSetup = async () => {
    if (!user) return;
    setConnectingService('mailgun');
    setError(null);
    try {
      if (!apiKey.trim()) { setError('API key is required'); return; }
      if (!mailgunDomain.trim()) { setError('Domain is required'); return; }

      const { data: mgProvider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();
      if (providerError || !mgProvider) throw providerError || new Error('Mailgun provider missing');

      // ✅ SECURE: Store API key in vault properly
      console.log('Securing Mailgun API key with vault encryption');
      const vaultService = new VaultService(supabase);
      const secretName = `mailgun_api_key_${user.id}_${Date.now()}`;
      const vaultKeyId = await vaultService.createSecret(
        secretName,
        apiKey,
        `Mailgun API key for ${mailgunDomain} - Created: ${new Date().toISOString()}`
      );
      
      console.log(`✅ Mailgun API key securely stored in vault: ${vaultKeyId}`);

      const { data: conn, error: connError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: mgProvider.id,
          connection_name: connectionName || 'Mailgun Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: vaultKeyId, // ✅ Now stores vault UUID, not plain text
          external_username: mailgunDomain,
          scopes_granted: ['send_email'], // ✅ Grant email sending permissions
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (connError) throw connError;

      // Optional: upsert configuration record if table exists
      await supabase
        .from('mailgun_configurations')
        .upsert({
          user_id: user.id,
          user_oauth_connection_id: conn.id,
          domain: mailgunDomain,
          region: 'us',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      await refetchConnections();
      setSaved(true);
      setSetupService(null);
      setActiveTab('connected');
      setApiKey('');
      setMailgunDomain('');
      setConnectionName('');
    } catch (e: any) {
      console.error('Mailgun setup error:', e);
      setError(e?.message || 'Failed to connect Mailgun');
    } finally {
      setConnectingService(null);
    }
  };

  const CHANNEL_SERVICES = integrations
    .filter(i => i.status === 'available')
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name))
    .map(mapIntegrationToService);

  const providerNameForServiceId = (serviceId: string) => {
    switch (serviceId) {
      case 'gmail':
        return 'gmail';
      case 'sendgrid':
        return 'sendgrid';
      case 'mailgun':
        return 'mailgun';
      default:
        return serviceId;
    }
  };

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleOAuthSetup = async (serviceId: string) => {
    if (serviceId === 'gmail') {
      setConnectingService(serviceId);
      try {
        console.log('Initiating Gmail OAuth flow');
        await gmailInitiateOAuth();
        
        // Refresh connections to get the latest data and force UI update from authoritative RPC
        await refetchConnections();
        // Also refresh agent permissions list so connected badge updates immediately
        await refetchIntegrationPermissions();
        
        toast.success('Gmail connected successfully! 🎉');
        setSaved(true);
        setSetupService(null);
        
        // Switch to connected tab to show the new connection
        setActiveTab('connected');
        
      } catch (error: any) {
        console.error('OAuth flow error:', error);
        if (!error.message?.includes('cancelled')) {
          toast.error('Failed to connect Gmail');
        }
      } finally {
        setConnectingService(null);
      }
    } else if (serviceId === 'discord') {
      // For Discord, show setup instructions
      setSetupService('discord');
      toast('Discord setup requires additional configuration. Please follow the setup form below.');
    } else {
      toast(`${serviceId} integration coming soon! 🚀`);
      return;
    }
  };

  const handleSendGridSetup = async () => {
    if (!user) return;
    
    setConnectingService('sendgrid');
    setError(null);
    
    try {
      // Validate inputs
      if (!apiKey.trim()) {
        setError('API key is required');
        return;
      }
      if (!fromEmail.trim()) {
        setError('From email is required');
        return;
      }
      
      // Store API key in vault
      const vaultKeyId = await vaultService.createSecret(
        `sendgrid_api_key_${user.id}`,
        apiKey,
        'SendGrid API key'
      );
      
      // Create or update SendGrid configuration
      const { error: configError } = await supabase
        .from('sendgrid_configurations')
        .upsert({
          user_id: user.id,
          api_key_vault_id: vaultKeyId, // Store vault reference, not raw key
          from_email: fromEmail,
          from_name: fromName || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      
      if (configError) throw configError;
      
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
          connection_name: connectionName || 'SendGrid Connection',
          credential_type: 'api_key',
          connection_status: 'active',
          vault_access_token_id: apiKey, // TODO: replace with Vault ID
          external_username: fromEmail || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (connError) throw connError;
      
      // Refresh connections
      await refetchConnections();
      
      toast.success('SendGrid connected successfully! 📧');
      setSaved(true);
      setSetupService(null);
      setActiveTab('connected');
      
      // Reset form
      setApiKey('');
      setFromEmail('');
      setFromName('');
      setConnectionName('');
      
    } catch (error: any) {
      console.error('SendGrid setup error:', error);
      setError(error.message || 'Failed to connect SendGrid');
    } finally {
      setConnectingService(null);
    }
  };

  const getServiceStatus = (serviceId: string) => {
    // Status should reflect whether this AGENT has the channel added (permission exists)
    const provider = providerNameForServiceId(serviceId);
    const exists = agentPermissions.some(p => p.provider_name === provider && p.is_active);
    if (exists) return 'connected';

    // Otherwise show available if user has a credential for this provider
    const hasCredential = connections.some(c => c.provider_name === provider && c.connection_status === 'active');
    return hasCredential ? 'available' : 'available';
  };

  const renderConnectedChannels = () => {
    // Show channels added to the AGENT (not just user-level credentials)
    // Only show permissions for integrations that are classified as 'channel'
    const channelConnections = agentPermissions.filter(p => {
      if (!p.is_active) return false;
      
      // Check if this permission is for a channel-classified integration
      const providerName = (p as any).provider_name;
      const matchedIntegration = integrations.find(i => 
        i.name.toLowerCase().includes(providerName?.toLowerCase() || '') ||
        providerName === 'gmail' && i.name.toLowerCase() === 'gmail' ||
        providerName === 'sendgrid' && i.name.toLowerCase().includes('sendgrid') ||
        providerName === 'mailgun' && i.name.toLowerCase().includes('mailgun') ||
        providerName === 'smtp' && i.name.toLowerCase().includes('smtp')
      );
      
      return !!matchedIntegration;
    });

    if (channelConnections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Settings className="h-12 w-12 text-muted-foreground opacity-50" />
          <div className="text-center">
            <p className="text-muted-foreground font-medium">No channels connected</p>
            <p className="text-sm text-muted-foreground mt-1">Add a channel to get started</p>
          </div>
          <Button
            onClick={() => setActiveTab('available')}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setActiveTab('available')}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
          </Button>
        </div>
        
        {channelConnections.map((connection) => {
          const providerName = (connection as any).provider_name;
          
          // Find the matching channel integration for proper display info
          const matchedIntegration = integrations.find(i => 
            i.name.toLowerCase().includes(providerName?.toLowerCase() || '') ||
            providerName === 'gmail' && i.name.toLowerCase() === 'gmail' ||
            providerName === 'sendgrid' && i.name.toLowerCase().includes('sendgrid') ||
            providerName === 'mailgun' && i.name.toLowerCase().includes('mailgun') ||
            providerName === 'smtp' && i.name.toLowerCase().includes('smtp')
          );
          
          // Use integration info or fallback to provider name
          const integrationService = matchedIntegration ? mapIntegrationToService(matchedIntegration) : null;
          
          const name = integrationService?.name || matchedIntegration?.name || providerName;
          const gradient = integrationService?.gradient || 'from-zinc-500 to-zinc-600';
          
          return (
            <div
              key={connection.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">{name}</h3>
                   <p className="text-sm text-muted-foreground">
                    {(connection as any).external_username || 'Authorized'}
                   </p>
                  {renderCapabilitiesBadges(providerName, matched?.id)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Connected</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPermission(connection);
                    setSelectedScopes(connection.allowed_scopes || defaultScopesForService(providerName));
                    setShowPermissionsModal(true);
                  }}
                >
                  Modify Permissions
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500"
                  onClick={async () => {
                    try {
                      const { error } = await supabase.rpc('revoke_agent_integration_permission', { p_permission_id: connection.id });
                      if (error) throw error;
                      await refetchIntegrationPermissions();
                      toast.success('Channel removed from agent');
                    } catch (e: any) {
                      console.error('Revoke permission error', e);
                      toast.error('Failed to remove channel');
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSetupFlow = (service: any) => {
    if (service.id === 'discord') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-indigo-500" />
              <span>Discord Bot Setup</span>
            </CardTitle>
            <CardDescription>
              Discord integration requires creating a Discord application and bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Discord integration is available but requires manual setup:</strong></p>
                  <p>1. Create a Discord Application at <Button variant="link" className="p-0 h-auto" asChild>
                    <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">
                      Discord Developer Portal <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button></p>
                  <p>2. Create a bot and get your bot token</p>
                  <p>3. Configure the bot in your agent settings</p>
                </div>
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground">
              For now, Discord integration is available through the main agent settings page. 
              We're working on streamlining this setup process.
            </div>

            <Button
              onClick={() => {
                toast('Please configure Discord through the agent edit page for now.');
                setSetupService(null);
              }}
              variant="outline"
              className="w-full"
            >
              Configure in Agent Settings
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (service.type === 'oauth') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span>OAuth 2.0 Authentication</span>
            </CardTitle>
            <CardDescription>
              Secure authentication flow to connect your {service.name} account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="connection_name">
                Connection Name (Optional)
              </Label>
              <Input
                id="connection_name"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder={`My ${service.name} Connection`}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Give this connection a name to identify it later
              </p>
            </div>

            <Button
              onClick={() => handleOAuthSetup(service.id)}
              disabled={connectingService === service.id}
              className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
            >
              {connectingService === service.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Connect with {service.name}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (service.type === 'api_key' && service.id === 'sendgrid') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-blue-500" />
              <span>SendGrid API Configuration</span>
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
              <Label htmlFor="api_key">
                SendGrid API Key <span className="text-red-500">*</span>
              </Label>
              <Input
                id="api_key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="SG.xxxxxxxxxxxxxxxxxxxxxx"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your SendGrid API key with mail.send permissions
              </p>
            </div>

            <div>
              <Label htmlFor="from_email">
                From Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="from_email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@yourdomain.com"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The email address that will appear as the sender
              </p>
            </div>

            <div>
              <Label htmlFor="from_name">
                From Name (Optional)
              </Label>
              <Input
                id="from_name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Company Name"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The name that will appear as the sender
              </p>
            </div>

            <div>
              <Label htmlFor="connection_name_sg">
                Connection Name (Optional)
              </Label>
              <Input
                id="connection_name_sg"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="My SendGrid Connection"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Give this connection a name to identify it later
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
              disabled={connectingService === 'sendgrid'}
              className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
            >
              {connectingService === 'sendgrid' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
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
      );
    }

    if (service.type === 'api_key' && service.id === 'email_relay') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-purple-500" />
              <span>Email Relay Configuration</span>
            </CardTitle>
            <CardDescription>
              Choose your preferred email service provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="justify-start h-auto p-4"
                onClick={() => setSetupService('smtp')}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">SMTP Server</div>
                    <div className="text-sm text-muted-foreground">Use your own SMTP server</div>
                  </div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-auto p-4"
                onClick={() => setSetupService('sendgrid')}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">SendGrid</div>
                    <div className="text-sm text-muted-foreground">High-deliverability email service</div>
                  </div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="justify-start h-auto p-4"
                onClick={() => setSetupService('mailgun')}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                    <Mail className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Mailgun</div>
                    <div className="text-sm text-muted-foreground">Powerful email service with validation</div>
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (service.type === 'api_key' && service.id === 'smtp') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-gray-500" />
              <span>SMTP Server Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure your SMTP server settings
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
              <Label htmlFor="smtp_host">SMTP Host <span className="text-red-500">*</span></Label>
              <Input 
                id="smtp_host" 
                type="text" 
                value={smtpHost} 
                onChange={(e) => setSmtpHost(e.target.value)} 
                placeholder="smtp.gmail.com" 
                className="mt-1" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="smtp_port">Port <span className="text-red-500">*</span></Label>
                <Input 
                  id="smtp_port" 
                  type="number" 
                  value={smtpPort} 
                  onChange={(e) => setSmtpPort(e.target.value)} 
                  placeholder="587" 
                  className="mt-1" 
                />
              </div>
              <div>
                <Label htmlFor="smtp_secure">Security</Label>
                <select 
                  id="smtp_secure"
                  value={smtpSecure} 
                  onChange={(e) => setSmtpSecure(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="smtp_username">Username <span className="text-red-500">*</span></Label>
              <Input 
                id="smtp_username" 
                type="text" 
                value={smtpUsername} 
                onChange={(e) => setSmtpUsername(e.target.value)} 
                placeholder="your-email@domain.com" 
                className="mt-1" 
              />
            </div>

            <div>
              <Label htmlFor="smtp_password">Password <span className="text-red-500">*</span></Label>
              <Input 
                id="smtp_password" 
                type="password" 
                value={smtpPassword} 
                onChange={(e) => setSmtpPassword(e.target.value)} 
                placeholder="your-app-password" 
                className="mt-1" 
              />
            </div>

            <div>
              <Label htmlFor="smtp_from_email">From Email <span className="text-red-500">*</span></Label>
              <Input 
                id="smtp_from_email" 
                type="email" 
                value={fromEmail} 
                onChange={(e) => setFromEmail(e.target.value)} 
                placeholder="noreply@yourdomain.com" 
                className="mt-1" 
              />
            </div>

            <Button
              onClick={handleSMTPSetup}
              disabled={connectingService === 'smtp'}
              className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:opacity-90 text-white"
            >
              {connectingService === 'smtp' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect SMTP
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (service.type === 'api_key' && service.id === 'mailgun') {
      return (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5 text-pink-500" />
              <span>Mailgun API Configuration</span>
            </CardTitle>
            <CardDescription>
              Configure your Mailgun API key and domain
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
              <Label htmlFor="mg_domain">Mailgun Domain <span className="text-red-500">*</span></Label>
              <Input id="mg_domain" value={mailgunDomain} onChange={(e) => setMailgunDomain(e.target.value)} placeholder="mail.yourdomain.com" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mg_api_key">Mailgun API Key <span className="text-red-500">*</span></Label>
              <Input id="mg_api_key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="key-xxxxxxxxxxxxxxxxxxxx" className="mt-1" />
            </div>
            <Button
              onClick={handleMailgunSetup}
              disabled={connectingService === 'mailgun'}
              className={`w-full bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
            >
              {connectingService === 'mailgun' ? (
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
      );
    }

    return null;
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

  const renderCredentialSelector = (service: any) => {
    const provider = providerNameForServiceId(service.id);
    const creds = connections.filter(c => c.provider_name === provider && c.connection_status === 'active');
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span>Select credential for {service.name}</span>
          </CardTitle>
          <CardDescription>Choose an existing credential or add a new one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Capabilities</div>
            {renderCapabilitiesBadges(provider, (service as any).integrationId)}
          </div>
          {creds.length === 0 && (
            <div className="text-sm text-muted-foreground">No saved credentials for {service.name}.</div>
          )}
          {creds.map((c) => (
            <div key={c.connection_id} className="flex items-center justify-between p-3 border rounded">
              <div className="text-sm">
                <div className="font-medium">{c.provider_display_name}</div>
                <div className="text-muted-foreground">{c.external_username || c.connection_name}</div>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    setConnectingService(service.id);
                    const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
                      p_agent_id: agentId,
                      p_connection_id: c.connection_id,
                      p_allowed_scopes: defaultScopesForService(service.id),
                      p_permission_level: 'custom',
                      p_user_id: user?.id
                    });
                    if (grantError) throw grantError;
                    await refetchIntegrationPermissions();
                    setSelectingCredentialFor(null);
                    setActiveTab('connected');
                  } catch (e) {
                    console.error('Grant permission error', e);
                    toast.error('Failed to authorize agent');
                  } finally {
                    setConnectingService(null);
                  }
                }}
              >
                Authorize Agent
              </Button>
            </div>
          ))}
          <div className="pt-2">
            <Button variant="outline" onClick={() => setSetupService(service.id)}>
              <Plus className="h-4 w-4 mr-2" /> Add new credential
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAvailableServices = () => {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Choose communication channels to connect to your agent:
        </div>
        
        <div className="space-y-3">
          {CHANNEL_SERVICES.map((service) => {
            const Icon = service.icon;
            const status = getServiceStatus(service.id);
            const isConnected = status === 'connected';
            const isSetupMode = setupService === service.id;
            const isSelectingCredential = selectingCredentialFor === service.id;
            
            if (isSetupMode) {
              return (
                <div key={service.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">Setting up connection...</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSetupService(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                  {renderSetupFlow(service)}
                </div>
              );
            }
            if (isSelectingCredential) {
              return (
                <div key={service.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">Choose credential</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectingCredentialFor(null)}>Cancel</Button>
                  </div>
                  {renderCredentialSelector(service)}
                </div>
              );
            }
            
            return (
              <div
                key={service.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  isConnected
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                    : 'border-border hover:border-border hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium">{service.name}</h3>
                      {isConnected && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                          Connected
                        </Badge>
                      )}
                      {service.type === 'coming_soon' && (
                        <Badge variant="outline" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{service.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : service.type === 'coming_soon' ? (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Button
                      onClick={() => setSelectingCredentialFor(service.id)}
                      size="sm"
                      className={`bg-gradient-to-r ${service.gradient} hover:opacity-90 text-white`}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Channel
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="connected">Connected Channels</TabsTrigger>
              <TabsTrigger value="available">Add New Channel</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                {renderConnectedChannels()}
              </div>
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                {renderAvailableServices()}
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
      {/* Permissions Modal */}
      <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Modify Permissions
            </DialogTitle>
            <DialogDescription>
              Choose what this agent can do with {(editingPermission as any)?.external_username || (editingPermission as any)?.provider_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const provider = (editingPermission as any)?.provider_name?.toLowerCase() || '';
              if (provider === 'gmail') {
                return (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.send')} onChange={(e)=>{
                        setSelectedScopes(prev => e.target.checked ? [...prev, 'https://www.googleapis.com/auth/gmail.send'] : prev.filter(s=>s!=='https://www.googleapis.com/auth/gmail.send'));
                      }} />
                      Send Email
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')} onChange={(e)=>{
                        setSelectedScopes(prev => e.target.checked ? [...prev, 'https://www.googleapis.com/auth/gmail.readonly'] : prev.filter(s=>s!=='https://www.googleapis.com/auth/gmail.readonly'));
                      }} />
                      Read/Search Emails
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedScopes.includes('https://www.googleapis.com/auth/gmail.modify')} onChange={(e)=>{
                        setSelectedScopes(prev => e.target.checked ? [...prev, 'https://www.googleapis.com/auth/gmail.modify'] : prev.filter(s=>s!=='https://www.googleapis.com/auth/gmail.modify'));
                      }} />
                      Email Actions (modify)
                    </label>
                  </div>
                );
              }
              if (provider === 'mailgun') {
                const opts = ['send_email','validate','stats','suppressions'];
                return (
                  <div className="space-y-2">
                    {opts.map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedScopes.includes(opt)} onChange={(e)=>{
                          setSelectedScopes(prev => e.target.checked ? [...prev, opt] : prev.filter(s=>s!==opt));
                        }} />
                        {opt.replace('_',' ')}
                      </label>
                    ))}
                  </div>
                );
              }
              if (provider === 'sendgrid') {
                return (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedScopes.includes('send_email')} onChange={(e)=>{
                      setSelectedScopes(prev => e.target.checked ? [...prev, 'send_email'] : prev.filter(s=>s!=='send_email'));
                    }} />
                    Send Email
                  </label>
                );
              }
              return null;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setShowPermissionsModal(false)}>Cancel</Button>
            <Button onClick={async ()=>{
              try {
                if (!editingPermission) return;
                const { error } = await supabase.rpc('grant_agent_integration_permission', {
                  p_agent_id: agentId,
                  p_connection_id: editingPermission.connection_id,
                  p_allowed_scopes: selectedScopes,
                  p_permission_level: 'custom',
                  p_user_id: user?.id
                });
                if (error) throw error;
                await refetchIntegrationPermissions();
                setShowPermissionsModal(false);
                toast.success('Permissions updated');
              } catch(e:any) {
                console.error('Update permissions error', e);
                toast.error('Failed to update permissions');
              }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}