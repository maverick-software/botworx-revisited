import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { VaultService } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';

interface MailgunConfig {
  id?: string;
  domain: string;
  region: string;
  webhook_url?: string;
  is_active: boolean;
}

interface MailgunRoute {
  id?: string;
  mailgun_route_id?: string;
  priority: number;
  expression: string;
  action: string;
  description: string;
  agent_id?: string;
  is_active: boolean;
}

export function useMailgunIntegration() {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [configuration, setConfiguration] = useState<MailgunConfig | null>(null);
  const [routes, setRoutes] = useState<MailgunRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing configuration
  useEffect(() => {
    if (user) {
      loadConfiguration();
      loadRoutes();
    }
  }, [user]);

  const loadConfiguration = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('mailgun_configurations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('Error loading Mailgun config:', error);
        setError(error.message);
        return;
      }

      if (data) {
        setConfiguration(data);
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      setError(error instanceof Error ? error.message : 'Failed to load configuration');
    }
  };

  const loadRoutes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('mailgun_routes')
        .select(`
          *,
          mailgun_configurations!inner(user_id),
          agents(id, name)
        `)
        .eq('mailgun_configurations.user_id', user.id)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error loading routes:', error);
        setError(error.message);
        return;
      }

      setRoutes(data || []);
    } catch (error) {
      console.error('Error loading routes:', error);
      setError(error instanceof Error ? error.message : 'Failed to load routes');
    }
  };

  const saveConfiguration = async (config: {
    domain: string;
    apiKey: string;
    region?: string;
    webhookUrl?: string;
  }) => {
    if (!user) {
      toast.error('Not authenticated');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Store API key in vault
      const vaultService = new VaultService(supabase);
      const apiKeyId = await vaultService.createSecret(
        `mailgun_api_key_${user.id}`,
        config.apiKey,
        `Mailgun API key for domain ${config.domain}`
      );

      // Get or create OAuth provider entry
      let { data: provider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();

      if (providerError && providerError.code === 'PGRST116') {
        // Provider doesn't exist, create it
        const { data: newProvider, error: createError } = await supabase
          .from('service_providers')
          .insert({
            name: 'mailgun',
            display_name: 'Mailgun Email Service',
            provider_type: 'api_key',
            scope: 'email_send,email_receive,email_analytics,email_validate,email_manage'
          })
          .select()
          .single();

        if (createError) throw createError;
        provider = newProvider;
      } else if (providerError) {
        throw providerError;
      }

      if (!provider) {
        throw new Error('Failed to get or create Mailgun provider');
      }

      // Create or update user OAuth connection
      const { data: existingConnection } = await supabase
        .from('user_integration_credentials')
        .select('id')
        .eq('user_id', user.id)
        .eq('oauth_provider_id', provider.id)
        .single();

      let connectionId;
      
      if (existingConnection) {
        // Update existing connection
        const { data: updatedConnection, error: updateError } = await supabase
          .from('user_integration_credentials')
          .update({
            vault_access_token_id: apiKeyId,
            connection_status: 'connected',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConnection.id)
          .select()
          .single();

        if (updateError) throw updateError;
        connectionId = updatedConnection.id;
      } else {
        // Create new connection
        const { data: newConnection, error: connectionError } = await supabase
          .from('user_integration_credentials')
          .insert({
            user_id: user.id,
            oauth_provider_id: provider.id,
            credential_type: 'api_key',
            connection_status: 'connected',
            vault_access_token_id: apiKeyId,
            external_username: config.domain // Store domain as username for reference
          })
          .select()
          .single();

        if (connectionError) throw connectionError;
        connectionId = newConnection.id;
      }

      // Create or update Mailgun configuration
      const configData = {
        user_id: user.id,
        user_oauth_connection_id: connectionId,
        domain: config.domain,
        region: config.region || 'us',
        webhook_url: config.webhookUrl,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { data: existingConfig } = await supabase
        .from('mailgun_configurations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      let savedConfig;
      
      if (existingConfig) {
        // Update existing configuration
        const { data, error } = await supabase
          .from('mailgun_configurations')
          .update(configData)
          .eq('id', existingConfig.id)
          .select()
          .single();

        if (error) throw error;
        savedConfig = data;
      } else {
        // Create new configuration
        const { data, error } = await supabase
          .from('mailgun_configurations')
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        savedConfig = data;
      }

      setConfiguration(savedConfig);
      toast.success('Mailgun configuration saved successfully');
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const createRoute = async (route: Omit<MailgunRoute, 'id' | 'mailgun_route_id'>) => {
    if (!user || !configuration) {
      toast.error('Mailgun not configured');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Store route in database (webhook will create it in Mailgun when deployed)
      const { data, error } = await supabase
        .from('mailgun_routes')
        .insert({
          mailgun_config_id: configuration.id,
          ...route,
          is_active: true
        })
        .select(`
          *,
          agents(id, name)
        `)
        .single();

      if (error) throw error;

      setRoutes(prev => [...prev, data]);
      toast.success('Route created successfully');
      
    } catch (error) {
      console.error('Error creating route:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create route';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoute = async (routeId: string, updates: Partial<MailgunRoute>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('mailgun_routes')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', routeId)
        .select(`
          *,
          agents(id, name)
        `)
        .single();

      if (error) throw error;

      setRoutes(prev => prev.map(r => r.id === routeId ? data : r));
      toast.success('Route updated successfully');
      
    } catch (error) {
      console.error('Error updating route:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update route';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoute = async (routeId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase
        .from('mailgun_routes')
        .delete()
        .eq('id', routeId);

      if (error) throw error;

      setRoutes(prev => prev.filter(r => r.id !== routeId));
      toast.success('Route deleted successfully');
      
    } catch (error) {
      console.error('Error deleting route:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete route';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!user) {
      toast.error('Not authenticated');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('mailgun-service', {
        body: {
          action: 'test_connection',
          user_id: user.id,
          parameters: {}
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Mailgun connection test successful');
        return true;
      } else {
        toast.error(data?.message || 'Connection test failed');
        return false;
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    configuration,
    routes,
    isLoading,
    error,
    saveConfiguration,
    createRoute,
    updateRoute,
    deleteRoute,
    testConnection,
    loadConfiguration,
    loadRoutes
  };
}
