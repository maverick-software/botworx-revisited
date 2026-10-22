import React from 'react';
import { Mail } from 'lucide-react';
import { ChannelSetupCard } from './ChannelSetupCard';

interface Integration {
  id: string;
  name: string;
  description?: string;
  status: string;
  display_order?: number;
}

interface ChannelService {
  id: string;
  name: string;
  description?: string;
  icon: React.ComponentType<any>;
  gradient: string;
  type: 'oauth' | 'api_key' | 'coming_soon';
}

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
  [key: string]: any;
}

interface AvailableChannelsListProps {
  integrations: Integration[];
  agentPermissions: AgentPermission[];
  connections: Connection[];
  setupService: string | null;
  selectingCredentialFor: string | null;
  connectingService: string | null;
  capabilitiesByIntegrationId?: Record<string, any>;
  onSetupClick: (serviceId: string) => void;
  onSelectCredentialClick: (serviceId: string) => void;
  onCancelSetup: () => void;
  renderSetupFlow?: (service: ChannelService) => React.ReactNode;
  renderCredentialSelector?: (serviceId: string) => React.ReactNode;
}

// Map DB integrations -> modal service definitions
function mapIntegrationToService(integration: Integration): ChannelService {
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
  } else if (lower.includes('smtp')) {
    id = 'smtp';
    gradient = 'from-green-500 to-emerald-500';
    type = 'api_key';
  }

  return {
    id,
    name: integration.name,
    description: integration.description,
    icon,
    gradient,
    type
  };
}

function providerNameForServiceId(serviceId: string): string {
  const result = (() => {
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
  })();
  
  console.log('[providerNameForServiceId] Input:', serviceId, 'Output:', result);
  return result;
}

export function AvailableChannelsList({
  integrations,
  agentPermissions,
  connections,
  setupService,
  selectingCredentialFor,
  connectingService,
  capabilitiesByIntegrationId,
  onSetupClick,
  onSelectCredentialClick,
  onCancelSetup,
  renderSetupFlow,
  renderCredentialSelector
}: AvailableChannelsListProps) {
  // Create channel services from integrations
  const channelServices = integrations
    .filter(i => i.status === 'available')
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name))
    .map(mapIntegrationToService);

  // Helper to get service status
  function getServiceStatus(serviceId: string): 'connected' | 'available' | 'coming_soon' {
    // Status should reflect whether this AGENT has the channel added (permission exists)
    const provider = providerNameForServiceId(serviceId);
    const exists = agentPermissions.some(p => p.provider_name === provider && p.is_active);
    if (exists) return 'connected';

    // Otherwise show available (both existing credentials and new connections are supported)
    return 'available';
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        Choose communication channels to connect to your agent:
      </div>
      
      <div className="space-y-3">
        {channelServices.map((service) => {
          const status = getServiceStatus(service.id);
          const isSetupMode = setupService === service.id;
          const isSelectingCredential = selectingCredentialFor === service.id;

          return (
            <ChannelSetupCard
              key={service.id}
              service={service}
              status={status}
              isSetupMode={isSetupMode}
              isSelectingCredential={isSelectingCredential}
              connectingService={connectingService}
              onSetupClick={onSetupClick}
              onSelectCredentialClick={onSelectCredentialClick}
              onCancelSetup={onCancelSetup}
              capabilitiesByIntegrationId={capabilitiesByIntegrationId}
              renderSetupFlow={renderSetupFlow}
              renderCredentialSelector={renderCredentialSelector}
            />
          );
        })}
      </div>
    </div>
  );
}
