/**
 * SMTP Permissions Hook
 * Manages agent SMTP permissions
 */

import { useState, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { 
  AgentSMTPPermission, 
  AgentSMTPPermissionCreate, 
  AgentSMTPPermissionUpdate,
  UseSMTPPermissionsResult 
} from '../types/smtp';

export const useSMTPPermissions = (agentId: string): UseSMTPPermissionsResult => {
  const [permissions, setPermissions] = useState<AgentSMTPPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = useSupabaseClient();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('agent_smtp_permissions')
        .select(`
          *,
          smtp_configurations!inner(
            id,
            connection_name,
            from_email,
            is_active
          )
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setPermissions(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch SMTP permissions';
      setError(errorMessage);
      console.error('Error fetching SMTP permissions:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, agentId]);

  const addPermission = useCallback(async (permission: AgentSMTPPermissionCreate): Promise<AgentSMTPPermission> => {
    setError(null);
    
    try {
      const { data, error: insertError } = await supabase
        .from('agent_smtp_permissions')
        .insert({
          agent_id: permission.agent_id,
          smtp_config_id: permission.smtp_config_id,
          can_send_email: permission.can_send_email ?? true,
          can_send_attachments: permission.can_send_attachments ?? false,
          can_use_custom_from: permission.can_use_custom_from ?? false,
          daily_email_limit: permission.daily_email_limit || null,
          recipients_per_email_limit: permission.recipients_per_email_limit || null,
          allowed_recipients: JSON.stringify(permission.allowed_recipients || []),
          blocked_recipients: JSON.stringify(permission.blocked_recipients || []),
          expires_at: permission.expires_at || null,
          granted_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select(`
          *,
          smtp_configurations!inner(
            id,
            connection_name,
            from_email,
            is_active
          )
        `)
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Update local state
      setPermissions(prev => [data, ...prev]);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add SMTP permission';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  const updatePermission = useCallback(async (
    id: string, 
    updates: AgentSMTPPermissionUpdate
  ): Promise<AgentSMTPPermission> => {
    setError(null);
    
    try {
      const updateData: any = {
        can_send_email: updates.can_send_email,
        can_send_attachments: updates.can_send_attachments,
        can_use_custom_from: updates.can_use_custom_from,
        daily_email_limit: updates.daily_email_limit || null,
        recipients_per_email_limit: updates.recipients_per_email_limit || null,
        expires_at: updates.expires_at || null,
        is_active: updates.is_active
      };

      if (updates.allowed_recipients !== undefined) {
        updateData.allowed_recipients = JSON.stringify(updates.allowed_recipients);
      }

      if (updates.blocked_recipients !== undefined) {
        updateData.blocked_recipients = JSON.stringify(updates.blocked_recipients);
      }

      const { data, error: updateError } = await supabase
        .from('agent_smtp_permissions')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          smtp_configurations!inner(
            id,
            connection_name,
            from_email,
            is_active
          )
        `)
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state
      setPermissions(prev => 
        prev.map(permission => permission.id === id ? data : permission)
      );
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update SMTP permission';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  const removePermission = useCallback(async (id: string): Promise<void> => {
    setError(null);
    
    try {
      const { error: deleteError } = await supabase
        .from('agent_smtp_permissions')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // Update local state
      setPermissions(prev => prev.filter(permission => permission.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove SMTP permission';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [supabase]);

  return {
    permissions,
    loading,
    error,
    addPermission,
    updatePermission,
    removePermission,
    refresh
  };
};
