import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

// Types
export interface GmailConnection {
  id: string;
  external_username: string;
  scopes_granted: string[];
  connection_status: 'active' | 'error' | 'expired';
  connection_metadata: {
    user_name: string;
    user_picture: string;
    last_connected: string;
  };
  configuration: {
    require_confirmation_for_send: boolean;
    allow_delete_operations: boolean;
    restrict_to_specific_labels: string[];
  };
}

export interface AgentGmailPermission {
  id: string;
  agent_id: string;
  allowed_scopes: string[];
  is_active: boolean;
  granted_at: string;
  usage_limits: {
    max_emails_per_day: number;
    max_api_calls_per_hour: number;
  };
}

export interface GmailOperationLog {
  id: string;
  agent_id: string;
  operation_type: string;
  operation_params: any;
  operation_result: any;
  status: 'success' | 'error' | 'unauthorized';
  error_message?: string;
  quota_consumed: number;
  execution_time_ms: number;
  created_at: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

// Hook for managing Gmail OAuth connections
export function useGmailConnection() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<GmailConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        'get_user_gmail_connections',
        { p_user_id: user.id }
      );

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (data && data.length > 0) {
        setConnections(data.map((conn: any) => ({
          id: conn.connection_id,
          external_username: conn.external_username,
          scopes_granted: conn.scopes_granted,
          connection_status: conn.connection_status,
          connection_metadata: conn.connection_metadata || {},
          configuration: conn.configuration || {}
        })));
      } else {
        setConnections([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Gmail connections');
    } finally {
      setLoading(false);
    }
  };

  const initiateOAuth = async (): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authenticated session');
    }

    const redirectUri = `${window.location.origin}/integrations/gmail/callback`;
    
    // Call the edge function to get the OAuth URL
    const response = await supabase.functions.invoke('gmail-oauth-initiate', {
      body: {
        redirect_uri: redirectUri,
        // Ensure all required scopes are requested, including gmail.modify
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify'
        ]
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`
      }
    });

    if (response.error) {
      // Check if this is a configuration error with detailed instructions
      if (response.data?.details) {
        console.error('Gmail OAuth Configuration Required:\n', response.data.details);
        throw new Error('Gmail OAuth is not configured. Please contact your administrator to set up Google OAuth credentials.');
      }
      throw new Error(response.error.message || 'Failed to initiate OAuth flow');
    }

    const { auth_url, state } = response.data;

    // Store state for later use in callback
    sessionStorage.setItem('gmail_oauth_state', state);
    
    // Open OAuth flow in popup
    const popup = window.open(
      auth_url,
      'gmail-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    // Listen for popup completion using postMessage and polling as fallback
    return new Promise((resolve, reject) => {
      // Listen for messages from the popup
      const handleMessage = (event: MessageEvent) => {
        console.log('Received postMessage:', event.data, 'from origin:', event.origin);
        console.log('Window location origin:', window.location.origin);
        
        // Temporarily comment out origin check for debugging
        // if (event.origin !== window.location.origin) {
        //   console.log('Ignoring message from different origin:', event.origin);
        //   return;
        // }

        if (event.data.type === 'GMAIL_OAUTH_SUCCESS') {
          console.log('Gmail OAuth success message received');
          // Clean up listeners
          window.removeEventListener('message', handleMessage);
          clearInterval(checkClosed);
          clearTimeout(timeout);
          
          // Refresh local state
          fetchConnections().then(() => {
            console.log('fetchConnections completed, resolving promise');
            resolve();
          }).catch((err) => {
            console.log('fetchConnections failed but resolving anyway:', err);
            resolve(); // Still resolve as OAuth succeeded
          });
        } else if (event.data.type === 'GMAIL_OAUTH_ERROR') {
          console.log('Gmail OAuth error message received:', event.data.data.error);
          // Clean up listeners
          window.removeEventListener('message', handleMessage);
          clearInterval(checkClosed);
          clearTimeout(timeout);
          
          reject(new Error(event.data.data.error || 'OAuth flow failed'));
        }
      };

      console.log('Setting up postMessage listener for Gmail OAuth');
      window.addEventListener('message', handleMessage);

      // Fallback: polling to check if popup is closed (in case postMessage fails)
      const checkClosed = setInterval(async () => {
        if (popup?.closed) {
          console.log('Popup closed, falling back to polling method');
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          
          // Wait a moment for the callback to complete
          await new Promise(r => setTimeout(r, 1000));
          
          // Check if connection was successful by fetching fresh data
          try {
            const { data } = await supabase.rpc(
              'get_user_gmail_connections',
              { p_user_id: user.id }
            );
            
            if (data && data.length > 0) {
              // Refresh local state
              await fetchConnections();
              resolve();
            } else {
              reject(new Error('OAuth flow was cancelled or failed'));
            }
          } catch (error) {
            reject(new Error('Failed to verify connection'));
          }
        }
      }, 1000);

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        console.log('Gmail OAuth timeout reached');
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        popup?.close();
        reject(new Error('OAuth flow timed out'));
      }, 300000);
    });
  };

  const handleOAuthCallback = async (code: string, state: string): Promise<void> => {
    const storedState = sessionStorage.getItem('gmail_oauth_state');
    if (!storedState || storedState !== state) {
      throw new Error('Invalid state parameter');
    }

    // Extract code verifier from state
    const stateData = JSON.parse(atob(state));
    const codeVerifier = stateData.code_verifier;

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) {
      throw new Error('No authenticated session');
    }

    const response = await supabase.functions.invoke('gmail-oauth', {
      body: {
        code,
        state,
        redirect_uri: `${window.location.origin}/integrations/gmail/callback`,
        code_verifier: codeVerifier
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`
      }
    });

    if (response.error) {
      throw new Error(response.error.message || 'Failed to complete OAuth flow');
    }

    // Clean up
    sessionStorage.removeItem('gmail_oauth_state');
    
    // Refresh connections data
    await fetchConnections();
  };

  const disconnectGmail = async (connectionId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('user_oauth_connections')
        .update({ connection_status: 'disconnected' })
        .eq('id', connectionId);

      if (error) {
        throw new Error(error.message);
      }

      // Refresh connections
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Gmail');
      throw err;
    }
  };

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  return {
    connections,
    connection: connections.length > 0 ? connections[0] : null, // For backward compatibility
    loading,
    error,
    initiateOAuth,
    handleOAuthCallback,
    disconnectGmail,
    refetch: fetchConnections
  };
}

// Hook for managing agent Gmail permissions
export function useAgentGmailPermissions(agentId?: string) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<AgentGmailPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = async () => {
    if (!user || !agentId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('agent_oauth_permissions')
        .select(`
          *,
          user_oauth_connections(
            external_username,
            oauth_provider_id,
            oauth_providers(name)
          )
        `)
        .eq('agent_id', agentId)
        .eq('user_oauth_connections.user_id', user.id);

      // Filter on client-side for Gmail provider
      const filteredData = (data || []).filter((permission: any) => 
        permission.user_oauth_connections && 
        permission.user_oauth_connections.oauth_providers && 
        permission.user_oauth_connections.oauth_providers.name === 'gmail'
      );

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setPermissions(filteredData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent permissions');
    } finally {
      setLoading(false);
    }
  };

  const grantPermissions = async (
    connectionId: string,
    scopes: string[],
    usageLimits?: { max_emails_per_day?: number; max_api_calls_per_hour?: number }
  ): Promise<void> => {
    if (!user || !agentId) {
      throw new Error('User or agent not available');
    }

    const toastId = toast.loading('Granting permissions...');

    try {
      // Use the correct column names as per the latest schema
      const { error } = await supabase
        .from('agent_oauth_permissions')
        .upsert({
          agent_id: agentId,
          user_oauth_connection_id: connectionId,
          granted_by_user_id: user.id, // Corrected from granted_by
          allowed_scopes: scopes,      // Corrected from granted_scopes
          permission_level: 'custom',  // Set a valid permission level
          is_active: true,
        }, {
          onConflict: 'agent_id, user_oauth_connection_id'
        });

      if (error) {
        throw error;
      }

      toast.success('Permissions granted successfully!', { id: toastId });
      await fetchPermissions();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to grant permissions';
      console.error('Error granting permissions:', errorMessage);
      toast.error(errorMessage, { id: toastId });
      throw err;
    }
  };

  const revokePermissions = async (permissionId: string): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await supabase
        .from('agent_oauth_permissions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', permissionId);

      if (error) {
        throw new Error(error.message);
      }

      await fetchPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke permissions');
      throw err;
    }
  };

  useEffect(() => {
    if (user && agentId) {
      fetchPermissions();
    }
  }, [user, agentId]);

  return {
    permissions,
    loading,
    error,
    grantPermissions,
    revokePermissions,
    refetch: fetchPermissions
  };
}

// Hook for Gmail operations
export function useGmailOperations(agentId?: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeOperation = async (action: string, parameters: any): Promise<any> => {
    if (!user || !agentId) {
      throw new Error('User or agent not available');
    }

    try {
      setLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No authenticated session');
      }

      const response = await supabase.functions.invoke('gmail-api', {
        body: {
          agent_id: agentId,
          action,
          parameters
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || `Failed to execute ${action}`);
      }

      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to execute ${action}`;
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (message: EmailMessage): Promise<any> => {
    return executeOperation('send_email', message);
  };

  const readEmails = async (options?: {
    query?: string;
    max_results?: number;
    label_ids?: string[];
  }): Promise<any> => {
    return executeOperation('read_emails', options || {});
  };

  const searchEmails = async (query: string, options?: {
    labels?: string[];
    max_results?: number;
  }): Promise<any> => {
    return executeOperation('search_emails', { query, ...options });
  };

  const manageLabels = async (action: string, params: {
    label_name?: string;
    label_id?: string;
    message_ids?: string[];
  }): Promise<any> => {
    return executeOperation('manage_labels', { action, ...params });
  };

  return {
    loading,
    error,
    sendEmail,
    readEmails,
    searchEmails,
    manageLabels,
    executeOperation
  };
}

// Hook for Gmail operation logs
export function useGmailOperationLogs(agentId?: string, limit = 50) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<GmailOperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('gmail_operation_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch operation logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, agentId, limit]);

  return {
    logs,
    loading,
    error,
    fetchLogs,
    clearLogs: () => setLogs([])
  };
} 