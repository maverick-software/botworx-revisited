import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAgentIntegrationPermissions } from '@/integrations/_shared';

interface AgentPermission {
  id: string;
  connection_id: string;
  provider_name: string;
  external_username?: string | null;
  is_active: boolean;
  allowed_scopes?: string[];
}

interface ChannelPermissionsHook {
  agentPermissions: AgentPermission[];
  isLoading: boolean;
  error: string | null;
  fetchAgentPermissions: () => Promise<void>;
}

export function useChannelPermissions(agentId: string): ChannelPermissionsHook {
  const supabase = useSupabaseClient();
  const [agentPermissions, setAgentPermissions] = useState<AgentPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the shared hook for integration permissions
  const { permissions: integrationPermissions, refetch: refetchIntegrationPermissions } = useAgentIntegrationPermissions(agentId);

  // Map integration permissions to our format
  useEffect(() => {
    console.log('[useChannelPermissions] Raw integrationPermissions:', integrationPermissions);
    
    const mappedPermissions = integrationPermissions.map(perm => ({
      id: perm.permission_id,
      connection_id: perm.connection_id,
      provider_name: perm.provider_name,
      external_username: perm.external_username,
      is_active: perm.is_active,
      allowed_scopes: perm.allowed_scopes || []
    }));
    
    console.log('[useChannelPermissions] Mapped permissions:', mappedPermissions);
    setAgentPermissions(mappedPermissions);
    setIsLoading(false);
  }, [integrationPermissions]);

  const fetchAgentPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await refetchIntegrationPermissions();
    } catch (err: any) {
      console.error('Failed to fetch agent permissions:', err);
      setError(err.message || 'Failed to fetch permissions');
    } finally {
      setIsLoading(false);
    }
  }, [refetchIntegrationPermissions]);

  return {
    agentPermissions,
    isLoading,
    error,
    fetchAgentPermissions
  };
}
