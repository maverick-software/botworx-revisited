import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface WorkspaceContextSettings {
  context_window_size: number;
  context_window_token_limit: number;
}

interface UseWorkspaceSettingsReturn {
  contextSettings: WorkspaceContextSettings | null;
  loading: boolean;
  error: string | null;
  fetchSettings: (workspaceId: string) => Promise<WorkspaceContextSettings | null>;
  updateSettings: (workspaceId: string, settings: Partial<WorkspaceContextSettings>) => Promise<boolean>;
}

export function useWorkspaceSettings(): UseWorkspaceSettingsReturn {
  const { user } = useAuth();
  const [contextSettings, setContextSettings] = useState<WorkspaceContextSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (workspaceId: string): Promise<WorkspaceContextSettings | null> => {
    if (!workspaceId) {
      setError('Workspace ID is required to fetch settings');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('workspaces')
        .select('context_window_size, context_window_token_limit')
        .eq('id', workspaceId)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('Workspace not found');
      }

      const settings: WorkspaceContextSettings = {
        context_window_size: data.context_window_size,
        context_window_token_limit: data.context_window_token_limit
      };

      setContextSettings(settings);
      return settings;
    } catch (err: any) {
      console.error('Error fetching workspace context settings:', err);
      setError(err.message || 'Failed to fetch workspace context settings');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (
    workspaceId: string,
    settings: Partial<WorkspaceContextSettings>
  ): Promise<boolean> => {
    if (!workspaceId) {
      setError('Workspace ID is required to update settings');
      return false;
    }

    if (!user?.id) {
      setError('You must be logged in to update workspace settings');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate settings before updating
      if (settings.context_window_size !== undefined && settings.context_window_size <= 0) {
        throw new Error('Context window size must be greater than 0');
      }

      if (settings.context_window_token_limit !== undefined && settings.context_window_token_limit <= 0) {
        throw new Error('Context window token limit must be greater than 0');
      }

      const { error: updateError } = await supabase
        .from('workspaces')
        .update(settings)
        .eq('id', workspaceId);

      if (updateError) throw updateError;

      // Update local state with new settings
      if (contextSettings) {
        setContextSettings({ ...contextSettings, ...settings });
      }

      return true;
    } catch (err: any) {
      console.error('Error updating workspace context settings:', err);
      setError(err.message || 'Failed to update workspace context settings');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, contextSettings]);

  return {
    contextSettings,
    loading,
    error,
    fetchSettings,
    updateSettings
  };
} 