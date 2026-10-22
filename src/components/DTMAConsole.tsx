import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Network, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Terminal, 
  RefreshCw, 
  Power,
  AlertTriangle,
  Server,
  Container,
  PlayCircle,
  StopCircle,
  RotateCcw
} from 'lucide-react';
import HealthMonitor from './HealthMonitor';

interface DTMAConsoleProps {
  toolboxId: string;
  dropletIp: string;
}

interface DTMAStatus {
  status: string;
  timestamp: string;
  version: string;
  service: string;
  environment: {
    hasAuthToken: boolean;
    hasApiKey: boolean;
    hasApiBaseUrl: boolean;
    port: string;
  };
  tool_instances?: Array<{
    account_tool_instance_id: string | null;
    instance_name_on_toolbox: string;
    container_id: string;
    status: string;
    image: string;
    ports: Array<{
      ip?: string;
      private_port: number;
      public_port?: number;
      type: string;
    }>;
    created: number;
  }>;
}

interface SystemMetrics {
  cpu_load_percent: number;
  memory: {
    total_bytes: number;
    active_bytes: number;
    free_bytes: number;
    used_bytes: number;
  };
  disk: {
    mount: string;
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
  };
}

export const DTMAConsole: React.FC<DTMAConsoleProps> = ({ toolboxId, dropletIp }) => {
  const [dtmaStatus, setDtmaStatus] = useState<DTMAStatus | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Check DTMA connectivity and status
  const checkDTMAStatus = useCallback(async () => {
    setIsLoading(true);
    setConnectionError(null);
    
    try {
      // Call our Supabase Edge Function to check DTMA status
      const { data, error } = await supabase.functions.invoke('toolbox-dtma-console', {
        body: { toolboxId, action: 'status' }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        setDtmaStatus(data.dtma_status);
        setSystemMetrics(data.system_metrics);
        setConnectionError(null);
      } else {
        setConnectionError(data.error || 'Failed to connect to DTMA');
      }
      
      setLastChecked(new Date());
    } catch (error) {
      console.error('DTMA status check failed:', error);
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      setDtmaStatus(null);
      setSystemMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [toolboxId]);

  // Redeploy DTMA service
  const redeployDTMA = async () => {
    setIsRedeploying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('toolbox-dtma-console', {
        body: { toolboxId, action: 'redeploy' }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        // Add success log
        setLogs(prev => [...prev, `${new Date().toISOString()}: DTMA redeployment initiated successfully`]);
        
        // Wait a bit then check status
        setTimeout(() => {
          checkDTMAStatus();
        }, 5000);
      } else {
        throw new Error(data.error || 'Redeployment failed');
      }
    } catch (error) {
      console.error('DTMA redeployment failed:', error);
      setLogs(prev => [...prev, `${new Date().toISOString()}: ERROR - ${error instanceof Error ? error.message : 'Redeployment failed'}`]);
    } finally {
      setIsRedeploying(false);
    }
  };

  // Restart DTMA service
  const restartDTMA = async () => {
    setIsRedeploying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('toolbox-dtma-console', {
        body: { toolboxId, action: 'restart' }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        setLogs(prev => [...prev, `${new Date().toISOString()}: DTMA restart initiated successfully`]);
        
        // Wait a bit then check status
        setTimeout(() => {
          checkDTMAStatus();
        }, 3000);
      } else {
        throw new Error(data.error || 'Restart failed');
      }
    } catch (error) {
      console.error('DTMA restart failed:', error);
      setLogs(prev => [...prev, `${new Date().toISOString()}: ERROR - ${error instanceof Error ? error.message : 'Restart failed'}`]);
    } finally {
      setIsRedeploying(false);
    }
  };

  // Initial load
  useEffect(() => {
    checkDTMAStatus();
  }, [checkDTMAStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkDTMAStatus, 30000);
    return () => clearInterval(interval);
  }, [checkDTMAStatus]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'running':
        return 'bg-green-500';
      case 'stopped':
      case 'exited':
        return 'bg-red-500';
      case 'starting':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy':
      case 'running':
        return <CheckCircle className="h-4 w-4" />;
      case 'stopped':
      case 'exited':
        return <XCircle className="h-4 w-4" />;
      case 'starting':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Terminal className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold">DTMA Console</h2>
          <Badge variant="outline" className="text-xs">
            {dropletIp}:30000
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          {lastChecked && (
            <span className="text-sm text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={checkDTMAStatus}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Error */}
      {connectionError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-700">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Connection Failed</span>
            </div>
            <p className="text-sm text-red-600 mt-2">{connectionError}</p>
            <div className="mt-4 space-x-2">
              <Button
                onClick={restartDTMA}
                disabled={isRedeploying}
                size="sm"
                variant="outline"
              >
                <Power className="h-4 w-4 mr-2" />
                Restart DTMA
              </Button>
              <Button
                onClick={redeployDTMA}
                disabled={isRedeploying}
                size="sm"
                variant="outline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Redeploy DTMA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Console Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Health Monitor */}
          <HealthMonitor 
            toolboxId={toolboxId}
            dropletIp={dropletIp}
            showSSHStatus={true}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DTMA Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>DTMA Status</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dtmaStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(dtmaStatus.status)}
                      <Badge className={getStatusColor(dtmaStatus.status)}>
                        {dtmaStatus.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Version: {dtmaStatus.version}</p>
                      <p>Service: {dtmaStatus.service}</p>
                      <p>Updated: {formatTimestamp(dtmaStatus.timestamp)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Environment:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${dtmaStatus.environment.hasAuthToken ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span>Auth Token</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${dtmaStatus.environment.hasApiKey ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span>API Key</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${dtmaStatus.environment.hasApiBaseUrl ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span>API URL</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Port {dtmaStatus.environment.port}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No status data available'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Metrics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>System Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {systemMetrics ? (
                  <div className="space-y-4">
                    {/* CPU */}
                    <div className="flex items-center space-x-3">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span>CPU Load</span>
                          <span>{systemMetrics.cpu_load_percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(systemMetrics.cpu_load_percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Memory */}
                    <div className="flex items-center space-x-3">
                      <MemoryStick className="h-4 w-4 text-green-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span>Memory</span>
                          <span>{formatBytes(systemMetrics.memory.used_bytes)} / {formatBytes(systemMetrics.memory.total_bytes)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${(systemMetrics.memory.used_bytes / systemMetrics.memory.total_bytes) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Disk */}
                    <div className="flex items-center space-x-3">
                      <HardDrive className="h-4 w-4 text-purple-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm">
                          <span>Disk ({systemMetrics.disk.mount})</span>
                          <span>{formatBytes(systemMetrics.disk.used_bytes)} / {formatBytes(systemMetrics.disk.total_bytes)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-purple-500 h-2 rounded-full" 
                            style={{ width: `${(systemMetrics.disk.used_bytes / systemMetrics.disk.total_bytes) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No system metrics available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Containers Tab */}
        <TabsContent value="containers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Container className="h-5 w-5" />
                <span>Running Containers</span>
              </CardTitle>
              <CardDescription>
                Docker containers managed by DTMA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dtmaStatus?.tool_instances && dtmaStatus.tool_instances.length > 0 ? (
                <div className="space-y-4">
                  {dtmaStatus.tool_instances.map((instance, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{instance.instance_name_on_toolbox}</h4>
                        <Badge className={getStatusColor(instance.status)}>
                          {instance.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><span className="font-medium">Image:</span> {instance.image}</p>
                        <p><span className="font-medium">Container ID:</span> {instance.container_id.substring(0, 12)}...</p>
                        <p><span className="font-medium">Created:</span> {new Date(instance.created * 1000).toLocaleString()}</p>
                        {instance.ports.length > 0 && (
                          <div>
                            <span className="font-medium">Ports:</span>
                            <div className="ml-2">
                              {instance.ports.map((port, portIndex) => (
                                <div key={portIndex} className="text-xs">
                                  {port.private_port}{port.public_port ? ` → ${port.public_port}` : ''} ({port.type})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No containers found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>
                  DTMA service management actions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={restartDTMA}
                  disabled={isRedeploying}
                  className="w-full"
                  variant="outline"
                >
                  <Power className="h-4 w-4 mr-2" />
                  {isRedeploying ? 'Restarting...' : 'Restart DTMA Service'}
                </Button>
                <Button
                  onClick={redeployDTMA}
                  disabled={isRedeploying}
                  className="w-full"
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {isRedeploying ? 'Redeploying...' : 'Redeploy DTMA Service'}
                </Button>
                <Button
                  onClick={checkDTMAStatus}
                  disabled={isLoading}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Network Info</CardTitle>
                <CardDescription>
                  Connection details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Network className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">
                    <span className="font-medium">Endpoint:</span> {dropletIp}:30000
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    <span className="font-medium">Protocol:</span> HTTP
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">
                    <span className="font-medium">Auth:</span> Bearer Token
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Console Logs</span>
                <Button
                  onClick={() => setLogs([])}
                  size="sm"
                  variant="outline"
                >
                  Clear
                </Button>
              </CardTitle>
              <CardDescription>
                Recent DTMA console activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">No logs available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DTMAConsole; 