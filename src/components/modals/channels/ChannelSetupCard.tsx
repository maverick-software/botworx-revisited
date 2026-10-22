import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail } from 'lucide-react';

type ServiceType = 'oauth' | 'api_key' | 'coming_soon';

interface ChannelService {
  id: string;
  name: string;
  description?: string;
  icon: React.ComponentType<any>;
  gradient: string;
  type: ServiceType;
}

interface ChannelSetupCardProps {
  service: ChannelService;
  status: 'connected' | 'available' | 'coming_soon';
  isSetupMode: boolean;
  isSelectingCredential: boolean;
  connectingService: string | null;
  onSetupClick: (serviceId: string) => void;
  onSelectCredentialClick: (serviceId: string) => void;
  onCancelSetup: () => void;
  capabilitiesByIntegrationId?: Record<string, any>;
  renderSetupFlow?: (service: ChannelService) => React.ReactNode;
  renderCredentialSelector?: (serviceId: string) => React.ReactNode;
}

function StatusBadge({ status }: { status: 'connected' | 'available' | 'coming_soon' }) {
  if (status === 'connected') {
    return <Badge variant="outline" className="border-green-500 text-green-700">Connected</Badge>;
  }
  if (status === 'coming_soon') {
    return <Badge variant="outline" className="border-amber-500 text-amber-700">Coming Soon</Badge>;
  }
  return <Badge variant="outline">Available</Badge>;
}

export function ChannelSetupCard({
  service,
  status,
  isSetupMode,
  isSelectingCredential,
  connectingService,
  onSetupClick,
  onSelectCredentialClick,
  onCancelSetup,
  renderSetupFlow,
  renderCredentialSelector,
}: ChannelSetupCardProps) {
  const Icon = service.icon || Mail;
  const isConnecting = connectingService === service.id;
  const disabled = status === 'coming_soon' || isConnecting;

  if (isSetupMode) {
    return (
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              <CardDescription>Setting up connection…</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancelSetup}>Cancel</Button>
        </CardHeader>
        <CardContent>
          {renderSetupFlow ? renderSetupFlow(service) : (
            <div className="text-sm text-muted-foreground">Setup form is not available.</div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (isSelectingCredential) {
    return (
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">{service.name}</CardTitle>
              <CardDescription>Select an existing credential</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancelSetup}>Cancel</Button>
        </CardHeader>
        <CardContent>
          {renderCredentialSelector ? renderCredentialSelector(service.id) : (
            <div className="text-sm text-muted-foreground">No credential selector provided.</div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${service.gradient} flex items-center justify-center`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span>{service.name}</span>
            </CardTitle>
            {service.description ? (
              <CardDescription>{service.description}</CardDescription>
            ) : null}
          </div>
        </div>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Button
          onClick={() => onSelectCredentialClick(service.id)}
          disabled={disabled}
        >
          {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Select credential
        </Button>
        <Button
          variant="outline"
          onClick={() => onSetupClick(service.id)}
          disabled={disabled}
        >
          Add new credential
        </Button>
      </CardContent>
    </Card>
  );
}


