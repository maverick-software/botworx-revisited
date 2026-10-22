import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

export interface AgentIntegrationPermission {
  permission_id: string;
  agent_id: string;
  connection_id: string;
  connection_name: string;
  external_username: string;
  provider_name: string;
  provider_display_name: string;
  integration_name?: string;
  allowed_scopes: any[];
  is_active: boolean;
  permission_level: string;
  granted_at: string;
  granted_by_user_id: string;
}

/**
 * Hook to fetch agent integration permissions
 * Replaces the RPC function get_agent_integration_permissions with direct queries
 */
export function useAgentIntegrationPermissions(agentId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AgentIntegrationPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!agentId || !user) {
      setPermissions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching agent permissions via Edge Function for agent:', agentId);
      
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-agent-permissions', {
        body: { agent_id: agentId }
      });

      console.log('Edge function response:', { data: edgeData, error: edgeError });

      if (!edgeError && edgeData?.data) {
        console.log('Edge function successful, permissions count:', edgeData.data.length);
        setPermissions(edgeData.data);
        return;
      }

      if (edgeError) {
        console.error('Edge function error details:', {
          message: edgeError.message,
          context: edgeError.context,
          status: edgeError.status,
          details: edgeError
        });
      } else if (edgeData && !edgeData.data) {
        console.error('Edge function returned no data, full response:', edgeData);
      }

      // If Edge Function fails, return empty permissions
      console.warn('Edge Function failed, returning empty permissions');
      setPermissions([]);
      
    } catch (err) {
      console.error('Error in useAgentIntegrationPermissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [agentId, user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  return {
    permissions,
    loading,
    error,
    refetch: fetchPermissions
  };
}

/**
 * Helper function to get agent integration permissions
 * Uses Edge Function directly since RPC doesn't exist
 */
export async function getAgentIntegrationPermissions(agentId: string, userId: string): Promise<AgentIntegrationPermission[]> {
  try {
    console.log('Getting permissions via Edge Function for agent:', agentId);
    
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('get-agent-permissions', {
      body: { agent_id: agentId }
    });

    console.log('Edge function response:', { data: edgeData, error: edgeError });

    if (!edgeError && edgeData?.data) {
      console.log('Edge function successful, returning permissions');
      return edgeData.data;
    }

    if (edgeError) {
      console.error('Edge function error details:', {
        message: edgeError.message,
        context: edgeError.context,
        status: edgeError.status,
        edgeError
      });
    } else if (edgeData && !edgeData.data) {
      console.error('Edge function returned no data:', edgeData);
    }

    console.warn('Edge Function failed, returning empty permissions');
    return [];
    
  } catch (err) {
    console.error('Error getting agent integration permissions:', err);
    return [];
  }
}
