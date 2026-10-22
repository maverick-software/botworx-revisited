import { useState, useEffect, useCallback } from 'react';
import { MCPServer, UseMCPServersReturn } from '@/lib/mcp/ui-types';
import { mcpService } from '@/lib/services/mcpService';

export function useMCPServers(): UseMCPServersReturn {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const servers = await mcpService.getServers();
      setServers(servers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch MCP servers';
      setError(errorMessage);
      console.error('Error fetching MCP servers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateServer = useCallback(async (id: string, updates: Partial<MCPServer>) => {
    try {
      setError(null);

      const updatedServer = await mcpService.updateServer(id, updates);
      
      // Update the local state
      setServers(prev => 
        prev.map(server => 
          server.id.toString() === id 
            ? updatedServer
            : server
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update server';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const deleteServer = useCallback(async (id: string) => {
    try {
      setError(null);

      await mcpService.deleteServer(id);
      
      // Remove from local state
      setServers(prev => prev.filter(server => server.id.toString() !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete server';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  return {
    servers,
    loading,
    error,
    refetch,
    updateServer,
    deleteServer,
  };
} 