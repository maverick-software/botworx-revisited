import React from 'react';
import { WebSearchSetupForm } from './WebSearchSetupForm';
import { DigitalOceanSetupForm } from './DigitalOceanSetupForm';

interface SearchProvider {
  id: string;
  name: string;
  setupUrl: string;
  rateLimit: string;
  description: string;
}

interface ToolSetupFormsProps {
  tool: { id: string; name: string };
  // Form state
  selectedProvider: string;
  apiKey: string;
  connectionName: string;
  error: string | null;
  connectingService: string | null;
  // Search providers data
  searchProviders: SearchProvider[];
  // Form handlers
  onProviderChange: (provider: string) => void;
  onApiKeyChange: (key: string) => void;
  onConnectionNameChange: (name: string) => void;
  // Setup handlers
  onWebSearchSetup: () => void;
  onDigitalOceanSetup: () => void;
}

export function ToolSetupForms({
  tool,
  selectedProvider,
  apiKey,
  connectionName,
  error,
  connectingService,
  searchProviders,
  onProviderChange,
  onApiKeyChange,
  onConnectionNameChange,
  onWebSearchSetup,
  onDigitalOceanSetup
}: ToolSetupFormsProps) {
  const isConnecting = connectingService === tool.id || connectingService === 'digitalocean';

  // Web Search setup
  if (tool.id === 'web_search') {
    return (
      <WebSearchSetupForm
        selectedProvider={selectedProvider}
        apiKey={apiKey}
        connectionName={connectionName}
        error={error}
        isConnecting={isConnecting}
        searchProviders={searchProviders}
        onProviderChange={onProviderChange}
        onApiKeyChange={onApiKeyChange}
        onConnectionNameChange={onConnectionNameChange}
        onConnect={onWebSearchSetup}
      />
    );
  }

  // DigitalOcean setup
  if (tool.id === 'digitalocean') {
    return (
      <DigitalOceanSetupForm
        apiKey={apiKey}
        connectionName={connectionName}
        error={error}
        isConnecting={isConnecting}
        onApiKeyChange={onApiKeyChange}
        onConnectionNameChange={onConnectionNameChange}
        onConnect={onDigitalOceanSetup}
      />
    );
  }

  // Default fallback (could add more tool types here)
  return (
    <div className="text-sm text-muted-foreground text-center py-4">
      Setup form not available for this tool type.
    </div>
  );
}

