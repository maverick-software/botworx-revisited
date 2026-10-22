import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Plus, Search } from 'lucide-react';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface Connection {
  connection_id: string;
  provider_name: string;
  connection_status: string;
  external_username?: string | null;
}

interface AvailableToolsListProps {
  integrations: any[];
  agentPermissions: AgentPermission[];
  connections: Connection[];
  setupService: string | null;
  selectingCredentialFor: string | null;
  onSetupClick: (provider: string) => void;
  onSelectCredentialClick: (provider: string) => void;
  onCancelSetup: () => void;
  renderCapabilitiesBadges?: (integrationId?: string) => React.ReactNode;
  renderSetupFlow?: (integration: any) => React.ReactNode;
  renderCredentialSelector?: (provider: string, integrationId?: string) => React.ReactNode;
}

export function AvailableToolsList({
  integrations,
  agentPermissions,
  connections,
  setupService,
  selectingCredentialFor,
  onSetupClick,
  onSelectCredentialClick,
  onCancelSetup,
  renderCapabilitiesBadges,
  renderSetupFlow,
  renderCredentialSelector
}: AvailableToolsListProps) {

  // Helper function to determine tool status
  const getToolStatus = (providerName: string) => {
    // For unified Web Search, check if any web search provider is connected
    if (providerName === 'web search' || providerName === 'web_search') {
      const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
      const hasWebSearchPermission = agentPermissions.some(p => 
        webSearchProviders.includes(p.provider_name) && p.is_active
      );
      if (hasWebSearchPermission) return 'connected';
      
      const hasWebSearchCredential = connections.some(c => 
        webSearchProviders.includes(c.provider_name) && c.connection_status === 'active'
      );
      return hasWebSearchCredential ? 'available' : 'available';
    }
    
    // Email Relay removed - using direct provider-integration matching now
    
    // For other providers, check normally
    const exists = agentPermissions.some(p => p.provider_name === providerName && p.is_active);
    if (exists) return 'connected';
    const hasCredential = connections.some(c => c.provider_name === providerName && c.connection_status === 'active');
    return hasCredential ? 'available' : 'available';
  };

  const handleConnectClick = (integration: any) => {
    const provider = integration.name.toLowerCase();

    // For Web Search integration, check existing connections first
    if (provider === 'web search' || provider === 'web_search' || integration.name.toLowerCase() === 'web search') {
      const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
      const existingWebSearchConnections = connections.filter(c => 
        webSearchProviders.includes(c.provider_name) && c.connection_status === 'active'
      );
      
      if (existingWebSearchConnections.length > 0) {
        onSelectCredentialClick(provider);
      } else {
        onSetupClick(provider);
      }
    } else if (provider === 'digitalocean' || integration.name.toLowerCase() === 'digitalocean') {
      // For DigitalOcean, check existing connections first
      const existingDigitalOceanConnections = connections.filter(c => 
        c.provider_name === 'digitalocean' && c.connection_status === 'active'
      );
      
      if (existingDigitalOceanConnections.length > 0) {
        onSelectCredentialClick(provider);
      } else {
        onSetupClick(provider);
      }
    } else {
      // For other integrations, use credential selection
      onSelectCredentialClick(provider);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        Choose tools to enhance your agent's capabilities:
      </div>
      <div className="space-y-3">
        {integrations.map((integration: any) => {
          const provider = integration.name.toLowerCase();
          const status = getToolStatus(provider);
          const isConnected = status === 'connected';
          const isSetupMode = setupService === provider;
          const isSelecting = selectingCredentialFor === provider;
          
          // Setup mode for Web Search
          if (isSetupMode && (provider === 'web search' || provider === 'web_search' || integration.name.toLowerCase() === 'web search')) {
            return (
              <div key={integration.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{integration.name}</h4>
                      <Badge variant="outline" className="text-xs">Setting up...</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onCancelSetup}>
                    Cancel
                  </Button>
                </div>
                {renderSetupFlow?.(integration)}
              </div>
            );
          }

          // Setup mode for DigitalOcean
          if (isSetupMode && (provider === 'digitalocean' || integration.name.toLowerCase() === 'digitalocean')) {
            return (
              <div key={integration.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{integration.name}</h4>
                      <Badge variant="outline" className="text-xs">Setting up...</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onCancelSetup}>
                    Cancel
                  </Button>
                </div>
                {renderSetupFlow?.(integration)}
              </div>
            );
          }

          // Credential selection mode
          if (isSelecting) {
            return (
              <div key={integration.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <Search className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium">{integration.name}</h3>
                      <p className="text-sm text-muted-foreground">Choose credential</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onCancelSetup}>
                    Cancel
                  </Button>
                </div>
                {renderCredentialSelector?.(provider, integration.id)}
              </div>
            );
          }

          // Default integration display
          return (
            <div 
              key={integration.id} 
              className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                isConnected 
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' 
                  : 'border-border hover:bg-accent/50'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="font-medium">{integration.name}</h4>
                  {isConnected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                {renderCapabilitiesBadges?.(integration.id)}
              </div>
              <div className="flex items-center space-x-2 ml-4">
                {isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Button
                    onClick={() => handleConnectClick(integration)}
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Connect
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

