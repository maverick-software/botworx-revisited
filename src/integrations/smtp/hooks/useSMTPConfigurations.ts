/**
 * SMTP Configurations Hook
 * Manages SMTP configurations with CRUD operations
 */

import { useState, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { 
  SMTPConfiguration, 
  SMTPConfigurationCreate, 
  SMTPConfigurationUpdate,
  TestConnectionResult,
  UseSMTPConfigurationsResult 
} from '../types/smtp';

export const useSMTPConfigurations = (): UseSMTPConfigurationsResult => {
  const [configurations, setConfigurations] = useState<SMTPConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = useSupabaseClient();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('smtp_configurations')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setConfigurations(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch SMTP configurations';
      setError(errorMessage);
      console.error('Error fetching SMTP configurations:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const createConfiguration = useCallback(async (config: SMTPConfigurationCreate): Promise<SMTPConfiguration> => {
    setError(null);
    
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      // Use the new standardized function to create SMTP connection
      const { data: configId, error: createError } = await supabase
        .rpc('create_smtp_connection', {
          p_user_id: user.id,
          p_connection_name: config.connection_name,
          p_username: config.username,
          p_password: config.password,
          p_host: config.host,
          p_port: config.port,
          p_secure: config.secure,
          p_from_email: config.from_email,
          p_from_name: config.from_name || null,
          p_reply_to_email: config.reply_to_email || null,
          p_connection_timeout: config.connection_timeout || 60000,
          p_socket_timeout: config.socket_timeout || 60000,
          p_greeting_timeout: config.greeting_timeout || 30000,
          p_max_emails_per_day: config.max_emails_per_day || 100,
          p_max_recipients_per_email: config.max_recipients_per_email || 50
        });

      if (createError) {
        throw new Error(createError.message);
      }

      // Fetch the created configuration
      const { data, error: fetchError } = await supabase
        .from('smtp_configurations')
        .select('*')
        .eq('id', configId)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Update local state
      setConfigurations(prev => [data, ...prev]);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create SMTP configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  const updateConfiguration = useCallback(async (
    id: string, 
    updates: SMTPConfigurationUpdate
  ): Promise<SMTPConfiguration> => {
    setError(null);
    
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      // Use the new standardized function to update SMTP connection
      const { error: updateError } = await supabase
        .rpc('update_smtp_connection', {
          p_user_id: user.id,
          p_config_id: id,
          p_connection_name: updates.connection_name,
          p_username: updates.username,
          p_password: updates.password,
          p_host: updates.host,
          p_port: updates.port,
          p_secure: updates.secure,
          p_from_email: updates.from_email,
          p_from_name: updates.from_name,
          p_reply_to_email: updates.reply_to_email,
          p_connection_timeout: updates.connection_timeout,
          p_socket_timeout: updates.socket_timeout,
          p_greeting_timeout: updates.greeting_timeout,
          p_max_emails_per_day: updates.max_emails_per_day,
          p_max_recipients_per_email: updates.max_recipients_per_email,
          p_is_active: updates.is_active
        });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Fetch the updated configuration
      const { data, error: fetchError } = await supabase
        .from('smtp_configurations')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Update local state
      setConfigurations(prev => 
        prev.map(config => config.id === id ? data : config)
      );
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update SMTP configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  const deleteConfiguration = useCallback(async (id: string): Promise<void> => {
    setError(null);
    
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      // Use the new standardized function to delete SMTP connection
      const { error: deleteError } = await supabase
        .rpc('delete_smtp_connection', {
          p_user_id: user.id,
          p_config_id: id
        });

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Update local state
      setConfigurations(prev => prev.filter(config => config.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete SMTP configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  const testConfiguration = useCallback(async (id: string): Promise<TestConnectionResult> => {
    setError(null);
    
    try {
      const { data, error: testError } = await supabase.functions.invoke('smtp-api', {
        body: {
          action: 'test_connection',
          user_id: (await supabase.auth.getUser()).data.user?.id,
          params: {
            smtp_config_id: id
          }
        }
      });

      if (testError) {
        throw new Error(testError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Connection test failed');
      }

      // Refresh configurations to get updated test status
      await refresh();

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test SMTP connection';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase, refresh]);

  const toggleActive = useCallback(async (id: string, isActive: boolean): Promise<void> => {
    setError(null);
    
    try {
      const { data, error: updateError } = await supabase
        .from('smtp_configurations')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state
      setConfigurations(prev => 
        prev.map(config => config.id === id ? data : config)
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update SMTP configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  return {
    configurations,
    loading,
    error,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    testConfiguration,
    toggleActive,
    refresh
  };
};
