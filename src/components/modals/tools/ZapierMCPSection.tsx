import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';

interface ZapierToolsListProps {
  agentId: string;
  connectionId: string;
  onToolsUpdate: (count: number) => void;
}

function ZapierToolsList({ agentId, connectionId, onToolsUpdate }: ZapierToolsListProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [tools, setTools] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadTools = async () => {
    if (!user?.id || !connectionId) return;

    try {
      setLoading(true);
      setError(null);
      
      const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
      const manager = new ZapierMCPManager(supabase, user.id);
      
      const tools = await manager.getConnectionTools(connectionId);
      setTools(tools);
      onToolsUpdate(tools.length);
    } catch (err: any) {
      console.error('Failed to load Zapier tools:', err);
      setError(err.message || 'Failed to load tools');
      setTools([]);
      onToolsUpdate(0);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadTools();
  }, [connectionId, user?.id]);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading tools...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">Error: {error}</div>;
  }

  if (tools.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No tools available</div>;
  }

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">Available Tools ({tools.length})</h4>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {tools.map((tool, index) => (
          <div key={index} className="text-xs p-2 bg-muted/50 rounded border">
            <div className="font-mono">{tool.tool_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ZapierMCPSectionProps {
  zapierConnection: any;
  zapierToolsCount: number;
  zapierToolsRefreshKey: number;
  agentId: string;
  onShowZapierModal: () => void;
  onZapierConnectionChange: (connection: any) => void;
  onZapierToolsCountChange: (count: number) => void;
  onZapierRefreshKeyChange: (key: number) => void;
}

export function ZapierMCPSection({
  zapierConnection,
  zapierToolsCount,
  zapierToolsRefreshKey,
  agentId,
  onShowZapierModal,
  onZapierConnectionChange,
  onZapierToolsCountChange,
  onZapierRefreshKeyChange
}: ZapierMCPSectionProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();

  const handleRefreshTools = async () => {
    if (!user?.id || !zapierConnection) return;
    
    try {
      const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
      const manager = new ZapierMCPManager(supabase, user.id);
      await manager.refreshConnectionTools(zapierConnection.id);
      
      onZapierRefreshKeyChange(zapierToolsRefreshKey + 1);
      toast.success('Tools refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh tools:', error);
      toast.error('Failed to refresh tools');
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id || !zapierConnection || !confirm('Are you sure you want to disconnect from the Zapier MCP server?')) {
      return;
    }
    
    try {
      const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
      const manager = new ZapierMCPManager(supabase, user.id);
      await manager.deleteConnection(zapierConnection.id);
      
      onZapierConnectionChange(null);
      onZapierToolsCountChange(0);
      toast.success('Disconnected from Zapier MCP server');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('Failed to disconnect');
    }
  };

  if (!zapierConnection) {
    return (
      <div className="text-center py-12">
        <Zap className="w-16 h-16 mx-auto mb-4 text-orange-500" />
        <h3 className="text-lg font-semibold mb-2">MCP Server</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Connect this agent to an MCP server to access automation tools and workflows.
        </p>
        <Button
          onClick={onShowZapierModal}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Zap className="w-4 h-4 mr-2" />
          Connect MCP Server
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-medium">MCP Server Connected</h3>
            <p className="text-sm text-muted-foreground">
              {zapierToolsCount} tools available
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={zapierConnection.is_active ? "default" : "secondary"}>
            {zapierConnection.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshTools}
            title="Refresh Tools"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            title="Disconnect"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Available Tools */}
      <ZapierToolsList 
        key={zapierToolsRefreshKey}
        agentId={agentId}
        connectionId={zapierConnection.id}
        onToolsUpdate={onZapierToolsCountChange}
      />
    </>
  );
}

