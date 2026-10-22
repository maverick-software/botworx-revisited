import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Server, 
  ServerOff, 
  PlusCircle, 
  RefreshCw,
  Loader2,
  TestTube,
  Unplug,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { UserMCPService } from '../lib/services/userMCPService';
import { StatusSyncService } from '../lib/services/statusSyncService';
import { formatDistanceToNow } from 'date-fns';

// Types for MCP integration
interface EnhancedMCPServer {
  id: string;
  name: string;
  description?: string;
  serverType: string;
  transport: string;
  status: 'running' | 'stopped' | 'error' | 'deploying';
  capabilities?: string[];
  endpoint?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentMCPConnection {
  id: string;
  agentId: string;
  serverId: string;
  serverName: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  connectedAt: Date;
  lastUsed?: Date;
  config: {
    timeout: number;
    retryAttempts: number;
    enableLogging: boolean;
  };
}

interface ConnectionHealth {
  connectionId: string;
  serverName: string;
  status: 'healthy' | 'warning' | 'error';
  latency: number;
  lastCheck: Date;
}

interface AgentToolboxSectionProps {
  agentId: string;
}

// Status Badge Component
const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'connected':
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'deploying':
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'stopped':
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={`${getStatusColor(status)} ${size === 'sm' ? 'text-xs px-1 py-0' : ''}`}
    >
      {status}
    </Badge>
  );
};

// Server Card Component
const ServerCard: React.FC<{ 
  server: EnhancedMCPServer; 
  onConnect: () => void;
}> = ({ server, onConnect }) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium">{server.name}</h4>
              <StatusBadge status={server.status} />
              <Badge variant="outline">{server.serverType}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {server.description || 'No description available'}
            </p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>Transport: {server.transport}</span>
              <span>•</span>
              <span>Capabilities: {server.capabilities?.length || 0}</span>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={onConnect}
            disabled={server.status !== 'running'}
          >
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Connection Card Component
const ConnectionCard: React.FC<{
  connection: AgentMCPConnection;
  onDisconnect: () => void;
  onTest: () => void;
}> = ({ connection, onDisconnect, onTest }) => {
  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{connection.serverName}</h4>
              <StatusBadge status={connection.status} size="sm" />
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span>Connected: {formatDistanceToNow(connection.connectedAt)} ago</span>
              {connection.lastUsed && (
                <>
                  <span>•</span>
                  <span>Last used: {formatDistanceToNow(connection.lastUsed)} ago</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onTest}>
              <TestTube className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={onDisconnect}>
              <Unplug className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// MCP Server Discovery Component
const MCPServerDiscovery: React.FC<{ 
  agentId: string; 
  onConnect: (serverId: string, serverName: string) => void;
}> = ({ agentId, onConnect }) => {
  const [availableServers, setAvailableServers] = useState<EnhancedMCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const userMCPService = new UserMCPService();

  useEffect(() => {
    loadAvailableServers();
  }, []);

  const loadAvailableServers = async () => {
    try {
      setLoading(true);
      // Get servers available for user connections
      const servers = await userMCPService.getAvailableServers();
      setAvailableServers(servers);
    } catch (error) {
      console.error('Failed to load available servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredServers = availableServers.filter(server =>
    server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    server.serverType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Available MCP Servers</h3>
        <Button variant="outline" size="sm" onClick={loadAvailableServers}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Input
        placeholder="Search servers..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="text-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading available servers...</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredServers.map(server => (
            <ServerCard 
              key={server.id} 
              server={server} 
              onConnect={() => onConnect(server.id, server.name)}
            />
          ))}
          {filteredServers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No MCP servers available for connection
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Agent MCP Connections Manager
const AgentMCPConnections: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [connections, setConnections] = useState<AgentMCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const userMCPService = new UserMCPService();
  const statusSyncService = new StatusSyncService();

  useEffect(() => {
    loadAgentConnections();
    
    // Real-time connection updates
    const subscription = statusSyncService.subscribe(
      `agent:${agentId}:connections`,
      (updates) => {
        setConnections(updates);
      }
    );

    return () => subscription.unsubscribe();
  }, [agentId]);

  const loadAgentConnections = async () => {
    try {
      setLoading(true);
      const agentConnections = await userMCPService.getAgentConnections(agentId);
      setConnections(agentConnections);
    } catch (error) {
      console.error('Failed to load agent connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await userMCPService.disconnectAgent(agentId, connectionId);
      await loadAgentConnections(); // Refresh connections
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleTestConnection = async (connectionId: string) => {
    try {
      const result = await userMCPService.testConnection(connectionId);
      // Show test result to user
      console.log('Connection test result:', result);
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active MCP Connections</h3>
        <Badge variant="outline">
          {connections.length} connected
        </Badge>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No MCP servers connected</p>
          <p className="text-xs">Connect to MCP servers to enhance your agent's capabilities</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map(connection => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onDisconnect={() => handleDisconnect(connection.id)}
              onTest={() => handleTestConnection(connection.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// MCP Connection Wizard
const MCPConnectionWizard: React.FC<{
  agentId: string;
  serverId: string;
  serverName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ agentId, serverId, serverName, isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'configure' | 'test' | 'confirm'>('configure');
  const [config, setConfig] = useState({
    timeout: 30000,
    retryAttempts: 3,
    enableLogging: false
  });
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const userMCPService = new UserMCPService();

  const handleTest = async () => {
    try {
      setLoading(true);
      setStep('test');
      
      const result = await userMCPService.testServerConnection(serverId, config);
      setTestResult(result);
      
      if (result.success) {
        setStep('confirm');
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      
      await userMCPService.connectAgent(agentId, serverId, config);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to connect agent:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to {serverName}</DialogTitle>
        </DialogHeader>

        {step === 'configure' && (
          <div className="space-y-4">
            <div>
              <Label>Connection Timeout (ms)</Label>
              <Input
                type="number"
                value={config.timeout}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  timeout: parseInt(e.target.value) 
                }))}
              />
            </div>
            <div>
              <Label>Retry Attempts</Label>
              <Input
                type="number"
                value={config.retryAttempts}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  retryAttempts: parseInt(e.target.value) 
                }))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={config.enableLogging}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  enableLogging: e.target.checked 
                }))}
              />
              <Label>Enable debug logging</Label>
            </div>
            <Button onClick={handleTest} disabled={loading} className="w-full">
              Test Connection
            </Button>
          </div>
        )}

        {step === 'test' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Testing connection to {serverName}...</p>
          </div>
        )}

        {step === 'confirm' && testResult && (
          <div className="space-y-4">
            {testResult.success ? (
              <div className="text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold">Connection Test Successful</h3>
                <p className="text-sm text-muted-foreground">
                  Latency: {testResult.latency}ms
                </p>
                {testResult.capabilities && (
                  <div className="mt-4">
                    <Label>Available Capabilities:</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {testResult.capabilities.map((cap: string, index: number) => (
                        <Badge key={index} variant="outline">{cap}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <h3 className="font-semibold">Connection Test Failed</h3>
                <p className="text-sm text-muted-foreground">
                  {testResult.error}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              {testResult.success && (
                <Button onClick={handleConnect} disabled={loading} className="flex-1">
                  Connect Agent
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Connection Health Monitor
const ConnectionHealthMonitor: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [healthData, setHealthData] = useState<ConnectionHealth[]>([]);
  const userMCPService = new UserMCPService();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const health = await userMCPService.getConnectionHealth(agentId);
        setHealthData(health);
      } catch (error) {
        console.error('Failed to fetch connection health:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [agentId]);

  if (healthData.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Connection Health
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {healthData.map(health => (
          <Card key={health.connectionId} className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium truncate">{health.serverName}</span>
              <div className="flex items-center gap-1">
                <div 
                  className={`w-2 h-2 rounded-full ${
                    health.status === 'healthy' ? 'bg-green-500' :
                    health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} 
                />
                <span className="text-xs text-muted-foreground">
                  {health.latency}ms
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Main Component
const AgentToolboxSection: React.FC<AgentToolboxSectionProps> = ({ agentId }) => {
  const [mcpConnectionWizardOpen, setMcpConnectionWizardOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<{ id: string; name: string } | null>(null);

  const handleMCPConnect = (serverId: string, serverName: string) => {
    setSelectedServer({ id: serverId, name: serverName });
    setMcpConnectionWizardOpen(true);
  };

  const handleConnectionSuccess = () => {
    // Refresh connections - handled by real-time updates
    console.log('MCP connection successful');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Agent Toolbox & MCP Connections</h2>
        <p className="text-sm text-muted-foreground">
          Connect your agent to MCP servers to extend its capabilities with additional tools and services.
        </p>
      </div>

      {/* MCP Integration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            MCP Server Connections
          </CardTitle>
          <CardDescription>
            Connect your agent to MCP servers to extend its capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="connections" className="space-y-4">
            <TabsList>
              <TabsTrigger value="connections">Active Connections</TabsTrigger>
              <TabsTrigger value="discover">Discover Servers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connections">
              <AgentMCPConnections agentId={agentId} />
              <ConnectionHealthMonitor agentId={agentId} />
            </TabsContent>
            
            <TabsContent value="discover">
              <MCPServerDiscovery 
                agentId={agentId}
                onConnect={handleMCPConnect}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Connection Wizard */}
      {selectedServer && (
        <MCPConnectionWizard
          agentId={agentId}
          serverId={selectedServer.id}
          serverName={selectedServer.name}
          isOpen={mcpConnectionWizardOpen}
          onClose={() => {
            setMcpConnectionWizardOpen(false);
            setSelectedServer(null);
          }}
          onSuccess={handleConnectionSuccess}
        />
      )}

      {/* Legacy Developer Note */}
      <div className="mt-6 p-4 border rounded-lg bg-secondary/50">
        <h2 className="text-lg font-semibold">Integration Complete</h2>
        <p className="text-sm text-muted-foreground">
          This component now integrates with the new MCP-DTMA infrastructure:
          • Server discovery and connection management
          • Real-time status monitoring and health checks
          • Connection wizard with testing capabilities
          • Integration with UserMCPService and StatusSyncService
        </p>
      </div>
    </div>
  );
};

export default AgentToolboxSection; 