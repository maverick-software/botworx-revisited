import { useState, useCallback } from 'react';
import { 
  MCPDeploymentConfig, 
  MCPDeploymentStatus, 
  UseMCPDeploymentReturn,
  MCPDeploymentResponse 
} from '@/lib/mcp/ui-types';
import { config } from '@/lib/config/environment';

const DTMA_BASE_URL = config.dtma.apiUrl;

export function useMCPDeployment(): UseMCPDeploymentReturn {
  const [deploymentStatus, setDeploymentStatus] = useState<MCPDeploymentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deploy = useCallback(async (config: MCPDeploymentConfig): Promise<MCPDeploymentStatus> => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!config.templateId || !config.name) {
        throw new Error('Template ID and name are required');
      }

      // Prepare deployment payload for DTMA API
      const deploymentPayload = {
        groupName: config.name,
        description: config.description,
        environment: config.environment,
        containers: [
          {
            templateId: config.templateId,
            name: config.name,
            configuration: config.configuration,
            resourceLimits: {
              memory: config.resourceLimits.memory,
              cpu: config.resourceLimits.cpu,
              storage: config.resourceLimits.storage
            },
            scaling: config.scaling,
            networking: config.networking,
            healthCheck: config.healthCheck,
            monitoring: config.monitoring
          }
        ],
        credentials: config.credentials
      };

      const response = await fetch(`${DTMA_BASE_URL}/mcp/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deploymentPayload),
      });

      if (!response.ok) {
        throw new Error(`Deployment failed: ${response.statusText}`);
      }

      const data: MCPDeploymentResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Deployment failed');
      }

      const newDeploymentStatus: MCPDeploymentStatus = {
        id: data.deploymentId,
        status: 'pending',
        progress: 0,
        message: 'Deployment initiated',
        startedAt: new Date(),
        logs: [{
          timestamp: new Date(),
          level: 'info',
          message: 'Deployment request submitted',
          source: 'deployment-manager'
        }],
        endpoints: []
      };

      setDeploymentStatus(newDeploymentStatus);
      
      // Start polling for status updates
      pollDeploymentStatus(data.deploymentId);
      
      return newDeploymentStatus;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to deploy MCP server';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const pollDeploymentStatus = useCallback(async (deploymentId: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`${DTMA_BASE_URL}/mcp/status?deploymentId=${deploymentId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get deployment status: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          const status = data.data.deploymentStatus;
          
          setDeploymentStatus(prev => ({
            ...prev!,
            status: status.status,
            progress: status.progress,
            message: status.message,
            completedAt: status.completedAt ? new Date(status.completedAt) : undefined,
            logs: status.logs?.map((log: any) => ({
              ...log,
              timestamp: new Date(log.timestamp)
            })) || prev!.logs,
            endpoints: status.endpoints || []
          }));

          // Continue polling if deployment is still in progress
          if (status.status === 'pending' || status.status === 'deploying') {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(poll, 5000); // Poll every 5 seconds
            } else {
              setError('Deployment timeout - status polling stopped');
            }
          }
        }
      } catch (err) {
        console.error('Error polling deployment status:', err);
        setError('Failed to get deployment status updates');
      }
    };

    // Start polling after a brief delay
    setTimeout(poll, 2000);
  }, []);

  const reset = useCallback(() => {
    setDeploymentStatus(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    deploy,
    deploymentStatus,
    loading,
    error,
    reset,
  };
} 