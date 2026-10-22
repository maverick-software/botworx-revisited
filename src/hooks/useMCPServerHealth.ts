import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  MCPServerHealth, 
  UseMCPServerHealthReturn
} from '@/lib/mcp/ui-types';

export function useMCPServerHealth(serverId?: string): UseMCPServerHealthReturn {
  const [health, setHealth] = useState<MCPServerHealth>({
    overall: 'unknown',
    checks: {
      connectivity: false,
      responseTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    },
    lastChecked: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!serverId) {
      setError('No server ID provided');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // TODO: Implement health check through API client
      // For now, simulate health check
      const mockHealthData: MCPServerHealth = {
        overall: 'healthy',
        checks: {
          connectivity: true,
          responseTime: Math.random() * 100 + 50,
          errorRate: Math.random() * 5,
          memoryUsage: Math.random() * 80 + 10,
          cpuUsage: Math.random() * 60 + 5,
        },
        lastChecked: new Date(),
      };
      
      setHealth(mockHealthData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch server health';
      setError(errorMessage);
      
      // Set health to unknown state on error
      setHealth(prev => ({
        ...prev,
        overall: 'unknown',
        lastChecked: new Date(),
      }));
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const startMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!serverId) {
      return;
    }

    // Initial fetch
    refresh();

    // Set up periodic health checks every 30 seconds
    intervalRef.current = setInterval(() => {
      refresh();
    }, 30000);
  }, [serverId, refresh]);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start monitoring when serverId is provided
  useEffect(() => {
    if (serverId) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    // Cleanup on unmount or serverId change
    return () => {
      stopMonitoring();
    };
  }, [serverId, startMonitoring, stopMonitoring]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    health,
    loading,
    error,
    refresh,
    startMonitoring,
    stopMonitoring,
  };
} 