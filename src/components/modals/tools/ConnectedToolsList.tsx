import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Plus, Search, Mail } from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ConnectedToolsListProps {
  agentPermissions: AgentPermission[];
  onSwitchToAvailable: () => void;
  onPermissionsUpdated: () => void;
  renderCapabilitiesBadges?: (integrationId?: string) => React.ReactNode;
  TOOL_INTEGRATIONS: any[];
  SEARCH_PROVIDERS: any[];
}

const EMAIL_PROVIDER_NAMES = {
  'smtp': 'SMTP Server',
  'sendgrid': 'SendGrid',
  'mailgun': 'Mailgun'
} as const;

export function ConnectedToolsList({
  agentPermissions,
  onSwitchToAvailable,
  onPermissionsUpdated,
  renderCapabilitiesBadges,
  TOOL_INTEGRATIONS,
  SEARCH_PROVIDERS
}: ConnectedToolsListProps) {
  const supabase = useSupabaseClient();
  const toolConnections = agentPermissions.filter(p => p.is_active);

  // Empty state
  if (toolConnections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Settings className="h-12 w-12 text-muted-foreground opacity-50" />
        <div className="text-center">
          <p className="text-muted-foreground font-medium">No tools connected</p>
          <p className="text-sm text-muted-foreground mt-1">Add a tool to get started</p>
        </div>
        <Button onClick={onSwitchToAvailable} className="mt-4">
          <Plus className="h-4 w-4 mr-2" />
          Add Tool
        </Button>
      </div>
    );
  }

  // Helper function to handle tool removal
  const handleRemoveTools = async (connections: AgentPermission[], toolName: string) => {
    if (!confirm(`Remove all ${toolName} from this agent?`)) return;
    
    try {
      for (const connection of connections) {
        const { error } = await supabase.rpc('revoke_agent_integration_permission', { 
          p_permission_id: connection.id 
        });
        if (error) throw error;
      }
      onPermissionsUpdated();
      toast.success(`${toolName} removed from agent`);
    } catch (e: any) {
      console.error(`Remove ${toolName} error`, e);
      toast.error(`Failed to remove ${toolName}`);
    }
  };

  const handleRemoveSingleTool = async (connection: AgentPermission, toolName: string) => {
    if (!confirm(`Remove ${toolName} from this agent?`)) return;
    
    try {
      const { error } = await supabase.rpc('revoke_agent_integration_permission', { 
        p_permission_id: connection.id 
      });
      if (error) throw error;
      onPermissionsUpdated();
      toast.success(`${toolName} removed from agent`);
    } catch (e: any) {
      console.error('Remove tool error', e);
      toast.error(`Failed to remove ${toolName}`);
    }
  };

  // Group connections by type
  const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
  const webSearchConnections = toolConnections.filter(c => 
    webSearchProviders.includes(c.provider_name)
  );
  
  // Email Relay removed - using individual provider entries now
  
  const otherConnections = toolConnections.filter(c => 
    !webSearchProviders.includes(c.provider_name)
  );

  const items = [];

  // Web Search unified entry
  if (webSearchConnections.length > 0) {
    const webSearchIntegration = TOOL_INTEGRATIONS.find(i => i.name.toLowerCase() === 'web search');
    const providerNames = webSearchConnections.map(c => {
      const provider = SEARCH_PROVIDERS.find(p => p.id === c.provider_name);
      return provider?.name || c.provider_name;
    }).join(', ');

    items.push(
      <div
        key="web_search_unified"
        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Search className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium">Web Search</h3>
            <p className="text-sm text-muted-foreground">
              Using: {providerNames}
            </p>
            {renderCapabilitiesBadges?.(webSearchIntegration?.id)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            Connected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500"
            onClick={() => handleRemoveTools(webSearchConnections, 'Web Search providers')}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  // Email Relay removed - using individual provider entries now

  // Individual tools
  otherConnections.forEach((connection) => {
    const matched = TOOL_INTEGRATIONS.find(i => 
      i.name.toLowerCase().includes((connection as any).provider_name?.toLowerCase() || '')
    );
    
    items.push(
      <div
        key={connection.id}
        className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium">{matched?.name || connection.provider_name}</h3>
            <p className="text-sm text-muted-foreground">
              {(connection as any).external_username || 'Authorized'}
            </p>
            {renderCapabilitiesBadges?.(matched?.id)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
            Connected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500"
            onClick={() => handleRemoveSingleTool(
              connection, 
              matched?.name || connection.provider_name
            )}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Button onClick={onSwitchToAvailable} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Tool
        </Button>
      </div>
      
      {items}
    </div>
  );
}

