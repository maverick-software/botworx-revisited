import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  Trash2, 
  Plus, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink,
  Settings
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { ZapierMCPModal } from '../ZapierMCPModal';
import { ZapierMCPManager, AgentMCPConnection, MCPToolCache } from '@/lib/mcp/zapier-mcp-manager';
import { toast } from 'react-hot-toast';
import { MCPIcon } from '@/components/ui/mcp-icon';

interface ZapierMCPTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

export function ZapierMCPTab({ agentId, agentData, onAgentUpdated }: ZapierMCPTabProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  
  // State
  const [connection, setConnection] = useState<AgentMCPConnection | null>(null);
  const [tools, setTools] = useState<MCPToolCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showZapierModal, setShowZapierModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Manager instance
  const [manager, setManager] = useState<ZapierMCPManager | null>(null);

  // Initialize manager
  useEffect(() => {
    if (user?.id) {
      setManager(new ZapierMCPManager(supabase, user.id));
    }
  }, [user?.id, supabase]);

  // Load connection and tools
  useEffect(() => {
    if (manager && agentId) {
      loadConnectionAndTools();
    }
  }, [manager, agentId]);

  const loadConnectionAndTools = async () => {
    if (!manager) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get agent connections (filter for Zapier type only)
      const connections = await manager.getAgentConnections(agentId);
      const zapierConnections = connections.filter(c => c.connection_type === 'zapier');
      
      // Prefer active connection, otherwise get the most recent one
      const activeConnection = zapierConnections.find(c => c.is_active) || 
                              zapierConnections.sort((a, b) => 
                                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                              )[0] || null;
      setConnection(activeConnection);
      
      // Get tools if connection exists
      if (activeConnection) {
        const connectionTools = await manager.getConnectionTools(activeConnection.id);
        setTools(connectionTools);
      } else {
        setTools([]);
      }
    } catch (err: any) {
      console.error('Failed to load Zapier MCP data:', err);
      setError(err.message || 'Failed to load MCP connection data');
      setConnection(null);
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshTools = async () => {
    if (!manager || !connection) return;
    
    try {
      setRefreshing(true);
      await manager.refreshConnectionTools(connection.id);
      await loadConnectionAndTools();
      toast.success('Tools refreshed successfully');
    } catch (err: any) {
      console.error('Failed to refresh tools:', err);
      toast.error(err.message || 'Failed to refresh tools');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!manager || !connection) return;
    
    if (!confirm('Are you sure you want to disconnect from the Zapier MCP server? This will remove all associated tools.')) {
      return;
    }
    
    try {
      await manager.deleteConnection(connection.id);
      toast.success('Disconnected from Zapier MCP server');
      await loadConnectionAndTools();
    } catch (err: any) {
      console.error('Failed to disconnect:', err);
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  const handleModalClose = () => {
    setShowZapierModal(false);
    // Refresh connection data when modal closes
    setTimeout(() => {
      loadConnectionAndTools();
    }, 100);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Zapier MCP Integration</h3>
          <p className="text-sm text-muted-foreground">
            Connect to Zapier MCP servers for automation tools and workflows.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading MCP connection...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Zapier MCP Integration</h3>
          <p className="text-sm text-muted-foreground">
            Connect to Zapier MCP servers for automation tools and workflows.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <Button onClick={loadConnectionAndTools} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">MCP Server Integration</h3>
        <p className="text-sm text-muted-foreground">
          Connect to any MCP-compliant server for automation tools and workflows.
        </p>
      </div>

      {!connection ? (
        // No Connection State
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MCPIcon size={20} />
              MCP Server
            </CardTitle>
            <CardDescription>
              Connect this agent to any MCP server (Zapier, Retell AI, Anthropic, etc.) to access tools and workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <MCPIcon size={32} />
              </div>
              <h4 className="font-medium mb-2">No MCP Server Connected</h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Connect to an MCP server to enable this agent to use automation tools and access integrations.
              </p>
              <Button
                onClick={() => setShowZapierModal(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect MCP Server
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // Connected State
        <div className="space-y-4">
          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  MCP Server Connected
                </div>
                <Badge variant={connection.is_active ? "default" : "secondary"}>
                  {connection.is_active ? "Active" : "Inactive"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Connected to: {connection.connection_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Connection Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <h5 className="font-medium text-sm mb-1">Server URL</h5>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground font-mono">
                        ••••••••••••••••••••
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        🔒 <span>Encrypted</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm mb-1">Tools Available</h5>
                    <p className="text-sm text-muted-foreground">
                      {tools.length} tools discovered
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshTools}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh Tools
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowZapierModal(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Tools Card */}
          {tools.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MCPIcon size={20} />
                  Available Tools ({tools.length})
                </CardTitle>
                <CardDescription>
                  Tools discovered from the connected MCP server
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {tools.map((tool, index) => (
                    <div 
                      key={tool.id || index} 
                      className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm truncate">
                          {tool.tool_name}
                        </h5>
                        {tool.openai_schema?.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {tool.openai_schema.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2 text-xs">
                        MCP
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Tools Found */}
          {tools.length === 0 && connection && (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h4 className="font-medium mb-2">No Tools Found</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  The connected MCP server doesn't have any tools available, or they haven't been discovered yet.
                </p>
                <Button
                  variant="outline"
                  onClick={handleRefreshTools}
                  disabled={refreshing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Tools
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Zapier MCP Modal */}
      <ZapierMCPModal
        isOpen={showZapierModal}
        onClose={handleModalClose}
        agentId={agentId}
        agentData={agentData}
      />
    </div>
  );
}
