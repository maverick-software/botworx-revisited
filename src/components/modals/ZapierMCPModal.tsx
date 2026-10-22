import React, { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Check, 
  AlertCircle,
  ExternalLink,
  Plus,
  Zap,
  Settings,
  Trash2,
  RefreshCw,
  TestTube,
  Globe,
  CheckCircle,
  XCircle,
  Wrench,
  Link
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { ZapierMCPManager, AgentMCPConnection, ZapierMCPConnectionTest, MCPToolCache } from '@/lib/mcp/zapier-mcp-manager';
import { toast } from 'react-hot-toast';

interface ZapierMCPModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
}

export function ZapierMCPModal({
  isOpen,
  onClose,
  agentId,
  agentData
}: ZapierMCPModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  
  // State
  const [connection, setConnection] = useState<AgentMCPConnection | null>(null);
  const [tools, setTools] = useState<MCPToolCache[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [testResult, setTestResult] = useState<ZapierMCPConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  
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
    if (isOpen && manager && agentId) {
      loadConnectionAndTools();
    }
  }, [isOpen, manager, agentId]);

  const loadConnectionAndTools = async () => {
    if (!manager) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get the agent's MCP connections (should be only one)
      const connections = await manager.getAgentConnections(agentId);
      const agentConnection = connections.length > 0 ? connections[0] : null;
      setConnection(agentConnection);
      
      // If there's a connection, load its tools
      if (agentConnection) {
        const connectionTools = await manager.getConnectionTools(agentConnection.id);
        setTools(connectionTools);
      } else {
        setTools([]);
        setShowConnectForm(true); // Show connect form if no connection exists
      }
    } catch (err) {
      console.error('Failed to load MCP connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load connection');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!manager || !serverUrl.trim()) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await manager.testConnection(serverUrl.trim());
      setTestResult(result);
      
      if (result.success) {
        toast.success(`Connection successful! Found ${result.toolCount} tools.`);
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Test failed'
      });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!manager || !serverUrl.trim()) return;
    
    setSaving(true);
    
    try {
      // Generate a unique connection name if one already exists
      let connectionName = 'My Zapier Connection';
      
      // Check if this agent already has a connection with this name
      const existingConnections = await manager.getAgentConnections(agentId);
      const existingNames = existingConnections.map(c => c.connection_name);
      
      // If the default name exists, append a number
      if (existingNames.includes(connectionName)) {
        let counter = 2;
        while (existingNames.includes(`${connectionName} ${counter}`)) {
          counter++;
        }
        connectionName = `${connectionName} ${counter}`;
      }
      
      await manager.createConnection(
        agentId,
        connectionName,
        serverUrl.trim()
      );
      
      toast.success('Zapier MCP server connected successfully!');
      
      // Reset form
      setServerUrl('');
      setTestResult(null);
      setShowConnectForm(false);
      
      // Reload connection and tools
      await loadConnectionAndTools();
    } catch (err) {
      console.error('Failed to save connection:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setSaving(false);
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
    } catch (err) {
      console.error('Failed to disconnect:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const handleRefreshTools = async () => {
    if (!manager || !connection) return;
    
    try {
      await manager.refreshConnectionTools(connection.id);
      toast.success('Tools refreshed successfully');
      await loadConnectionAndTools();
    } catch (err) {
      console.error('Failed to refresh tools:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to refresh tools');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            MCP Server Connection
          </DialogTitle>
          <DialogDescription>
            Connect {agentData?.name || 'this agent'} to an MCP server to access automation tools and integrations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : connection ? (
            // Connected State - Show connection info and tools
            <div className="space-y-6">
              {/* Connection Status */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Link className="w-4 h-4 text-green-500" />
                        <h3 className="font-medium">Connected to MCP Server</h3>
                        <Badge variant={connection.is_active ? "default" : "secondary"}>
                          {connection.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {connection.server_url}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Connected: {new Date(connection.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRefreshTools}
                        title="Refresh Tools"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDisconnect}
                        title="Disconnect"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Available Tools */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-blue-500" />
                    Available Tools ({tools.length})
                  </CardTitle>
                  <CardDescription>
                    These tools are available to {agentData?.name || 'this agent'} from the connected MCP server.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tools.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No tools discovered yet.</p>
                      <p className="text-sm">Try refreshing to discover available tools.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tools.map((tool) => (
                        <div key={tool.id} className="border border-border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{tool.tool_name}</h4>
                            <Badge variant="outline" className="text-xs">
                              MCP Tool
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {tool.tool_schema.description || 'No description available'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last updated: {new Date(tool.last_updated).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : showConnectForm ? (
            // Connect Form
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connect to MCP Server</CardTitle>
                <CardDescription>
                  Enter your MCP server URL to connect and discover available tools (works with Zapier, Retell AI, Anthropic, and any MCP-compliant server).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serverUrl">MCP Server URL</Label>
                  <Input
                    id="serverUrl"
                    placeholder="https://mcp.zapier.com/api/mcp/s/your-unique-id/mcp"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                  />
                </div>

                {/* Test Connection */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={!serverUrl.trim() || testing}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>

                {/* Test Result */}
                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {testResult.success ? (
                        <>
                          Connection successful! Found {testResult.toolCount} tools.
                          {testResult.tools && testResult.tools.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium">Sample tools:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {testResult.tools.slice(0, 3).map((tool, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tool.name}
                                  </Badge>
                                ))}
                                {testResult.tools.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{testResult.tools.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        `Connection failed: ${testResult.error}`
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleSaveConnection}
                    disabled={!serverUrl.trim() || !testResult?.success || saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Connect Server
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowConnectForm(false);
                      setServerUrl('');
                      setTestResult(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // No Connection State
            <div className="text-center py-12">
              <Zap className="w-16 h-16 mx-auto mb-4 text-orange-500 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No MCP Server Connected</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Connect {agentData?.name || 'this agent'} to its unique Zapier MCP server to access automation tools.
              </p>
              <Button
                onClick={() => setShowConnectForm(true)}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Link className="w-4 h-4 mr-2" />
                Connect MCP Server
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
