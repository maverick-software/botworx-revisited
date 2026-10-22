import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, 
  CheckCircle, 
  ExternalLink, 
  Loader2,
  Mail,
  Key,
  Globe,
  Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { 
  getIntegrationSetupComponent, 
  integrationSetupRegistry,
  type IntegrationSetupProps 
} from '@/integrations/_shared';

interface StandaloneIntegrationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (connection: any) => void;
  providerName: string; // e.g., 'microsoft-outlook', 'gmail', 'smtp'
  channelType?: 'email' | 'sms'; // Optional context for the setup
}

interface ProviderInfo {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  auth_type: 'oauth' | 'api_key';
  is_enabled: boolean;
}

/**
 * Standalone Integration Setup Modal for AgentChatPage
 * 
 * This modal allows users to set up integrations directly from the agent chat page
 * without being redirected to the IntegrationsPage. It uses the same registry system
 * but is completely independent.
 */
export function StandaloneIntegrationSetupModal({ 
  isOpen, 
  onClose, 
  onComplete, 
  providerName,
  channelType 
}: StandaloneIntegrationSetupModalProps) {
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Provider name mapping for the registry
  const getIntegrationName = (providerName: string): string => {
    const mapping: Record<string, string> = {
      'microsoft-outlook': 'Microsoft Outlook',
      'gmail': 'Gmail',
      'smtp': 'SMTP',
      'sendgrid': 'SendGrid',
      'mailgun': 'Mailgun',
      'discord': 'Discord',
      'digitalocean': 'DigitalOcean',
      'web-search': 'Web Search',
      'serper-api': 'Serper API',
      'serpapi': 'SerpAPI',
      'brave-search': 'Brave Search API',
      'microsoft-teams': 'Microsoft Teams',
      'microsoft-onedrive': 'Microsoft OneDrive',
      'pinecone': 'Pinecone',
      'getzep': 'GetZep',
      'mistral-ai': 'Mistral AI',
      'azure-document-intelligence': 'Azure Document Intelligence',
      'clicksend': 'ClickSend SMS'
    };
    
    return mapping[providerName] || providerName;
  };

  // Fetch provider information from database
  useEffect(() => {
    if (isOpen && providerName) {
      fetchProviderInfo();
    }
  }, [isOpen, providerName]);

  const fetchProviderInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch provider from service_providers table
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('*')
        .eq('name', providerName)
        .eq('is_enabled', true)
        .single();

      if (providerError) {
        throw new Error(`Provider not found: ${providerName}`);
      }

      setProvider(providerData);

      // Create integration object for the setup component
      const integrationName = getIntegrationName(providerName);
      const registryEntry = integrationSetupRegistry[integrationName];
      
      if (!registryEntry) {
        throw new Error(`No setup component available for ${integrationName}`);
      }

      const integrationObj = {
        id: providerData.id,
        name: integrationName,
        display_name: providerData.display_name,
        description: providerData.description || `Connect your ${providerData.display_name} account to expand your agent's capabilities.`,
        provider_name: providerName,
        auth_type: providerData.auth_type,
        capabilities: registryEntry.capabilities || [],
        defaultScopes: registryEntry.defaultScopes || []
      };

      setIntegration(integrationObj);
    } catch (err: any) {
      console.error('Error fetching provider info:', err);
      setError(err.message || 'Failed to load integration setup');
    } finally {
      setLoading(false);
    }
  };

  // Handle successful setup
  const handleSetupSuccess = (connection: {
    connection_id: string;
    connection_name: string;
    provider_name: string;
    external_username?: string;
    scopes_granted: string[];
  }) => {
    console.log('Integration setup successful:', connection);
    toast.success(`${integration?.display_name || providerName} connected successfully! 🎉`);
    onComplete(connection);
  };

  // Handle setup error
  const handleSetupError = (errorMessage: string) => {
    console.error('Integration setup error:', errorMessage);
    setError(errorMessage);
    toast.error(`Failed to setup ${integration?.display_name || providerName}`);
  };

  // Handle modal close
  const handleClose = () => {
    setError(null);
    onClose();
  };

  // Get icon for provider type
  const getProviderIcon = () => {
    if (channelType === 'email') return Mail;
    if (provider?.auth_type === 'api_key') return Key;
    if (provider?.auth_type === 'oauth') return ExternalLink;
    return Globe;
  };

  const ProviderIcon = getProviderIcon();

  // Don't render if not open or no provider
  if (!isOpen) return null;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      modal={true}
    >
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl font-semibold flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <ProviderIcon className="w-6 h-6 text-primary" />
            </div>
            Setup {provider?.display_name || providerName}
            {channelType && (
              <Badge variant="secondary" className="ml-2">
                {channelType.toUpperCase()}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {provider?.description || integration?.description || `Connect your ${provider?.display_name || providerName} account to expand your agent's capabilities.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading integration setup...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : integration ? (
            <SetupComponentRenderer
              integration={integration}
              user={user}
              supabase={supabase}
              onSuccess={handleSetupSuccess}
              onError={handleSetupError}
              onClose={handleClose}
            />
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Integration setup not available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Component that renders the appropriate setup component from the registry
 */
function SetupComponentRenderer({
  integration,
  user,
  supabase,
  onSuccess,
  onError,
  onClose
}: {
  integration: any;
  user: any;
  supabase: any;
  onSuccess: IntegrationSetupProps['onSuccess'];
  onError: IntegrationSetupProps['onError'];
  onClose: () => void;
}) {
  try {
    // Check if we have a registered setup component
    const registryEntry = integrationSetupRegistry[integration.name];
    if (!registryEntry) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No setup component available for {integration.name}
          </AlertDescription>
        </Alert>
      );
    }

    const SetupComponent = registryEntry.component;
    
    return (
      <SetupComponent
        integration={integration}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
        onError={onError}
        user={user}
        supabase={supabase}
      />
    );
  } catch (err: any) {
    console.error('Failed to load setup component:', err);
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load setup component for {integration.name}: {err.message}
        </AlertDescription>
      </Alert>
    );
  }
}
