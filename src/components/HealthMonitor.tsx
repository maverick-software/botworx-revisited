import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: string;
  responseTime?: number;
  details?: any;
}

interface HealthMonitorProps {
  toolboxId?: string;
  dropletIp?: string;
  showSSHStatus?: boolean;
}

export const HealthMonitor: React.FC<HealthMonitorProps> = ({ 
  toolboxId, 
  dropletIp, 
  showSSHStatus = true 
}) => {
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const checkHealth = async () => {
    if (!toolboxId && !dropletIp) return;
    
    setIsChecking(true);
    const newStatuses: HealthStatus[] = [];

    try {
      // Check DTMA Service Health
      if (dropletIp) {
        const dtmaStartTime = Date.now();
        try {
          const dtmaResponse = await fetch(`http://${dropletIp}:30000/status`, {
            signal: AbortSignal.timeout(10000),
          });
          
          const dtmaResponseTime = Date.now() - dtmaStartTime;
          
          if (dtmaResponse.ok) {
            const dtmaData = await dtmaResponse.json();
            newStatuses.push({
              service: 'DTMA Service',
              status: 'healthy',
              lastChecked: new Date().toISOString(),
              responseTime: dtmaResponseTime,
              details: {
                toolInstances: dtmaData.tool_instances?.length || 0,
                systemMetrics: dtmaData.system_metrics
              }
            });
          } else {
            newStatuses.push({
              service: 'DTMA Service',
              status: 'unhealthy',
              lastChecked: new Date().toISOString(),
              responseTime: dtmaResponseTime,
              details: { error: `HTTP ${dtmaResponse.status}` }
            });
          }
        } catch (dtmaError) {
          newStatuses.push({
            service: 'DTMA Service',
            status: 'unhealthy',
            lastChecked: new Date().toISOString(),
            details: { error: dtmaError instanceof Error ? dtmaError.message : 'Connection failed' }
          });
        }
      }

      // Check SSH Service Health
      if (showSSHStatus && dropletIp) {
        const sshStartTime = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke('ssh-command-executor', {
            body: {
              dropletIp,
              command: 'echo "SSH health check"',
              timeout: 5000
            }
          });

          const sshResponseTime = Date.now() - sshStartTime;

          if (error) {
            newStatuses.push({
              service: 'SSH Service',
              status: 'unhealthy',
              lastChecked: new Date().toISOString(),
              responseTime: sshResponseTime,
              details: { error: error.message }
            });
          } else if (data?.success) {
            newStatuses.push({
              service: 'SSH Service',
              status: 'healthy',
              lastChecked: new Date().toISOString(),
              responseTime: sshResponseTime,
              details: { stdout: data.stdout }
            });
          } else {
            newStatuses.push({
              service: 'SSH Service',
              status: 'unhealthy',
              lastChecked: new Date().toISOString(),
              responseTime: sshResponseTime,
              details: { error: data?.stderr || 'Unknown error' }
            });
          }
        } catch (sshError) {
          newStatuses.push({
            service: 'SSH Service',
            status: 'unhealthy',
            lastChecked: new Date().toISOString(),
            details: { error: sshError instanceof Error ? sshError.message : 'SSH check failed' }
          });
        }
      }

      // Check Backend API Health
      if (toolboxId) {
        const apiStartTime = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke('toolbox-tools', {
            body: { toolboxId }
          });

          const apiResponseTime = Date.now() - apiStartTime;

          if (error) {
            newStatuses.push({
              service: 'Backend API',
              status: 'unhealthy',
              lastChecked: new Date().toISOString(),
              responseTime: apiResponseTime,
              details: { error: error.message }
            });
          } else {
            newStatuses.push({
              service: 'Backend API',
              status: 'healthy',
              lastChecked: new Date().toISOString(),
              responseTime: apiResponseTime,
              details: { 
                toolInstances: data?.tool_instances?.length || 0,
                dtmaConnected: data?.dtma_connected 
              }
            });
          }
        } catch (apiError) {
          newStatuses.push({
            service: 'Backend API',
            status: 'unhealthy',
            lastChecked: new Date().toISOString(),
            details: { error: apiError instanceof Error ? apiError.message : 'API check failed' }
          });
        }
      }

      setHealthStatuses(newStatuses);
      setLastUpdate(new Date().toISOString());

    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [toolboxId, dropletIp, showSSHStatus]);

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getOverallStatus = () => {
    if (healthStatuses.length === 0) return 'unknown';
    if (healthStatuses.every(s => s.status === 'healthy')) return 'healthy';
    if (healthStatuses.some(s => s.status === 'unhealthy')) return 'unhealthy';
    return 'unknown';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {getOverallStatus() === 'healthy' ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          System Health
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={checkHealth}
          disabled={isChecking}
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {healthStatuses.map((status, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(status.status)}
                <div>
                  <p className="font-medium text-sm">{status.service}</p>
                  <p className="text-xs text-muted-foreground">
                    Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
                    {status.responseTime && ` (${status.responseTime}ms)`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(status.status)}
                {status.details && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {status.status === 'healthy' ? (
                      status.service === 'DTMA Service' ? (
                        `${status.details.toolInstances} tools`
                      ) : status.service === 'Backend API' ? (
                        `${status.details.toolInstances} tools, DTMA: ${status.details.dtmaConnected ? 'Yes' : 'No'}`
                      ) : (
                        'Connected'
                      )
                    ) : (
                      <span className="text-red-600">{status.details.error}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {healthStatuses.length === 0 && !isChecking && (
            <div className="text-center py-4 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>No health data available</p>
              <p className="text-xs">Check toolbox configuration</p>
            </div>
          )}

          {isChecking && (
            <div className="text-center py-4 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Checking system health...</p>
            </div>
          )}
        </div>

        {lastUpdate && (
          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground text-center">
            Last updated: {new Date(lastUpdate).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HealthMonitor; 