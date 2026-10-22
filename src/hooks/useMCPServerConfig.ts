import { useState, useCallback, useEffect } from 'react';
import { 
  MCPServer, 
  UseMCPServerConfigReturn
} from '@/lib/mcp/ui-types';
import { mcpService } from '@/lib/services/mcpService';

export function useMCPServerConfig(serverId?: string): UseMCPServerConfigReturn {
  const [config, setConfig] = useState<MCPServer | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async (id: string): Promise<MCPServer> => {
    try {
      setLoading(true);
      setError(null);
      
      const serverConfig = await mcpService.getServer(id);
      setConfig(serverConfig);
      return serverConfig;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch server configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (updates: Partial<MCPServer>): Promise<void> => {
    if (!config) {
      throw new Error('No server loaded');
    }

    try {
      setSaving(true);
      setError(null);

      const updatedConfig = await mcpService.updateServer(config.id.toString(), updates);
      setConfig(updatedConfig);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update server configuration';
      setError(errorMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [config]);

  const validateConfig = useCallback(async (
    id: string, 
    configToValidate: Partial<MCPServer>
  ): Promise<{ valid: boolean; errors: string[] }> => {
    // TODO: Implement validation through API client
    console.log('Validating config for server:', id, configToValidate);
    return { valid: true, errors: [] };
  }, []);

  const restartServer = useCallback(async (id: string): Promise<void> => {
    // TODO: Implement restart through API client
    console.log('Restarting server:', id);
    setSaving(true);
    // Simulate restart delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
  }, []);

  const resetConfig = useCallback((): void => {
    if (config && serverId) {
      // Reset to original state by refetching
      fetchConfig(serverId).catch(() => {
        // Error already handled in fetchConfig
      });
    }
  }, [config, serverId, fetchConfig]);

  // Auto-fetch config if serverId is provided
  useEffect(() => {
    if (serverId) {
      fetchConfig(serverId).catch(() => {
        // Error already handled in fetchConfig
      });
    }
  }, [serverId, fetchConfig]);

  return {
    config,
    loading,
    error,
    updateConfig,
    resetConfig,
  };
} 