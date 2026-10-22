import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Plus } from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface Connection {
  connection_id: string;
  provider_name: string;
  provider_display_name?: string;
  connection_name?: string;
  external_username?: string | null;
  connection_status: string;
}

interface CredentialSelectorProps {
  provider: string;
  integrationId?: string;
  agentId: string;
  connections: Connection[];
  connectingService: string | null;
  onPermissionsUpdated: () => void;
  onSwitchToSetup: () => void;
  renderCapabilitiesBadges?: (integrationId?: string) => React.ReactNode;
  defaultScopesForProvider: (provider: string) => string[];
}

export function CredentialSelector({
  provider,
  integrationId,
  agentId,
  connections,
  connectingService,
  onPermissionsUpdated,
  onSwitchToSetup,
  renderCapabilitiesBadges,
  defaultScopesForProvider
}: CredentialSelectorProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();

  // Filter connections based on provider type
  const isWebSearch = provider === 'web search' || provider === 'web_search' || provider.toLowerCase().includes('web search');
  const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
  
  // Email Relay removed - using direct provider matching now
  
  const creds = isWebSearch 
    ? connections.filter(c => webSearchProviders.includes(c.provider_name) && c.connection_status === 'active')
    : connections.filter(c => c.provider_name === provider && c.connection_status === 'active');

  const handleAuthorizeAgent = async (connection: Connection) => {
    try {
      const { error: grantError } = await supabase.rpc('grant_agent_integration_permission', {
        p_agent_id: agentId,
        p_connection_id: connection.connection_id,
        p_allowed_scopes: defaultScopesForProvider(connection.provider_name),
        p_permission_level: 'custom',
        p_user_id: user?.id
      });
      
      if (grantError) throw grantError;
      
      onPermissionsUpdated();
      toast.success('Agent authorized successfully');
    } catch (e) {
      console.error('Grant permission error', e);
      toast.error('Failed to authorize agent');
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <span>Select credential</span>
        </CardTitle>
        <CardDescription>Choose an existing credential or add a new one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Capabilities</div>
          {renderCapabilitiesBadges?.(integrationId)}
        </div>
        
        {creds.length === 0 && (
          <div className="text-sm text-muted-foreground">No saved credentials for this provider.</div>
        )}
        
        {creds.map((c) => (
          <div key={c.connection_id} className="flex items-center justify-between p-3 border rounded">
            <div className="text-sm">
              <div className="font-medium">{c.provider_display_name}</div>
              <div className="text-muted-foreground">{c.external_username || c.connection_name}</div>
            </div>
            <Button
              size="sm"
              disabled={connectingService === provider}
              onClick={() => handleAuthorizeAgent(c)}
            >
              Authorize Agent
            </Button>
          </div>
        ))}
        
        {/* Add new connection button */}
        <div className="flex items-center justify-between p-3 border border-dashed border-muted-foreground/30 rounded">
          <div className="text-sm">
            <div className="font-medium text-muted-foreground">Add new connection</div>
            <div className="text-muted-foreground text-xs">
              Create a new {isWebSearch ? 'web search' : provider} connection
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onSwitchToSetup}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

