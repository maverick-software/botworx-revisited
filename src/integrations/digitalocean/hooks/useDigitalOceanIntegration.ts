import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

export interface DigitalOceanConnection {
  id: string;
  user_id: string;
  oauth_provider_id: string;
  provider_name: string;
  provider_display_name: string;
  external_username: string; // API key name
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentDigitalOceanPermission {
  id: string;
  agent_id: string;
  user_oauth_connection_id: string;
  granted_by_user_id: string;
  allowed_scopes: string[];
  permission_level: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for managing DigitalOcean connections (API keys stored as OAuth-style connections)
 */
export function useDigitalOceanConnection() {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [connections, setConnections] = useState<DigitalOceanConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_integration_credentials')
        .select(`
          *,
          service_providers!inner (
            name,
            display_name
          )
        `)
        .eq('user_id', user.id)
        .eq('service_providers.name', 'digitalocean')
        .eq('connection_status', 'active')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedConnections: DigitalOceanConnection[] = (data || []).map((conn: any) => ({
        id: conn.id,
        user_id: conn.user_id,
        oauth_provider_id: conn.oauth_provider_id,
        provider_name: conn.service_providers.name,
        provider_display_name: conn.service_providers.display_name,
        external_username: conn.external_username || conn.connection_name,
        is_active: conn.connection_status === 'active',
        created_at: conn.created_at,
        updated_at: conn.updated_at
      }));

      setConnections(formattedConnections);
    } catch (err: any) {
      console.error('Error fetching DigitalOcean connections:', err);
      setError(err.message || 'Failed to fetch connections');
      toast.error('Failed to load DigitalOcean connections');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchConnections();
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  return {
    connections,
    loading,
    error,
    refetch
  };
}

/**
 * Hook for managing agent DigitalOcean permissions
 */
export function useAgentDigitalOceanPermissions(agentId?: string) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [permissions, setPermissions] = useState<AgentDigitalOceanPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !agentId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agent_integration_permissions')
        .select(`
          *,
          user_integration_credentials!inner (
            id,
            connection_name,
            external_username,
            service_providers!inner (
              name,
              display_name
            )
          )
        `)
        .eq('agent_id', agentId)
        .eq('is_active', true)
        .eq('user_integration_credentials.service_providers.name', 'digitalocean')
        .order('granted_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedPermissions: AgentDigitalOceanPermission[] = (data || []).map((perm: any) => ({
        id: perm.id,
        agent_id: perm.agent_id,
        user_oauth_connection_id: perm.user_oauth_connection_id,
        granted_by_user_id: perm.granted_by_user_id,
        allowed_scopes: perm.allowed_scopes || [],
        permission_level: perm.permission_level,
        is_active: perm.is_active,
        created_at: perm.granted_at,
        updated_at: perm.granted_at
      }));

      setPermissions(formattedPermissions);
    } catch (err: any) {
      console.error('Error fetching agent DigitalOcean permissions:', err);
      setError(err.message || 'Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  };

  const refetch = () => {
    fetchPermissions();
  };

  useEffect(() => {
    fetchPermissions();
  }, [user, agentId]);

  return {
    permissions,
    loading,
    error,
    refetch
  };
}

/**
 * DigitalOcean scopes available for agent permissions
 */
export const DIGITALOCEAN_SCOPES = [
  {
    id: 'droplet:read',
    label: 'Read Droplets',
    description: 'View droplet information and status'
  },
  {
    id: 'droplet:create',
    label: 'Create Droplets',
    description: 'Create new droplets'
  },
  {
    id: 'droplet:delete',
    label: 'Delete Droplets',
    description: 'Delete existing droplets'
  },
  {
    id: 'image:read',
    label: 'Read Images',
    description: 'View available images'
  },
  {
    id: 'region:read',
    label: 'Read Regions',
    description: 'View available regions'
  },
  {
    id: 'size:read',
    label: 'Read Sizes',
    description: 'View available droplet sizes'
  }
];

/**
 * Default DigitalOcean scopes for new agent permissions
 */
export const DEFAULT_DIGITALOCEAN_SCOPES = [
  'droplet:read',
  'image:read',
  'region:read',
  'size:read'
];
