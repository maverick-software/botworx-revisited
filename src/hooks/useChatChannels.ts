// src/hooks/useChatChannels.ts
import { useState, useCallback, useEffect } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import type { Database } from '../types/database.types';

type ChatChannel = Database['public']['Tables']['chat_channels']['Row'];
import { useAuth } from '../contexts/AuthContext';

export const useChatChannels = (workspaceId: string | null) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannelsForRoom = useCallback(async () => {
    if (!supabase || !workspaceId) {
      setChannels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setChannels(data || []);

    } catch (err: any) {
      console.error("Error fetching channels:", err);
      setError(err.message || 'Failed to fetch channels');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    if (workspaceId && supabase) {
      fetchChannelsForRoom();
    }
  }, [workspaceId, supabase, fetchChannelsForRoom]);

  const createChannel = async (name: string, topic?: string): Promise<ChatChannel | null> => {
    if (!workspaceId || !user || !name.trim() || !supabase) {
      setError('Workspace ID, User context, Channel name, and Supabase client are required.');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('chat_channels')
        .insert({ workspace_id: workspaceId, name: name.trim(), topic: topic || null })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setChannels(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        return data;
      } else {
        throw new Error('Failed to create channel: No data returned.');
      }

    } catch (err: any) {
      console.error("Error creating channel:", err);
      setError(err.message || 'Failed to create channel. Check if you are the room owner.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateChannel = async (channelId: string, updates: { name?: string; topic?: string }): Promise<ChatChannel | null> => {
    if (!user || !channelId || Object.keys(updates).length === 0 || !supabase) {
        setError('User context, Channel ID, updates, and Supabase client are required.');
        return null;
    }
    setLoading(true);
    setError(null);
    try {
        const { data, error: updateError } = await supabase
            .from('chat_channels')
            .update(updates)
            .eq('id', channelId)
            .select()
            .single();

        if (updateError) throw updateError;

        if (data) {
            setChannels(prev => prev.map(ch => ch.id === channelId ? data : ch)
                                     .sort((a, b) => a.name.localeCompare(b.name)));
            return data;
        } else {
            throw new Error('Failed to update channel: No data returned.');
        }

    } catch (err: any) {
        console.error("Error updating channel:", err);
        setError(err.message || 'Failed to update channel. Check permissions.');
        return null;
    } finally {
        setLoading(false);
    }
};


 const deleteChannel = async (channelId: string): Promise<boolean> => {
    if (!user || !channelId || !supabase) {
        setError('User context, Channel ID, and Supabase client are required.');
        return false;
    }
    setLoading(true);
    setError(null);
    try {
        const { error: deleteError } = await supabase
            .from('chat_channels')
            .delete()
            .eq('id', channelId);

        if (deleteError) throw deleteError;

        setChannels(prev => prev.filter(ch => ch.id !== channelId));
        return true;

    } catch (err: any) {
        console.error("Error deleting channel:", err);
        setError(err.message || 'Failed to delete channel. Check permissions.');
        return false;
    } finally {
        setLoading(false);
    }
 };


  return {
    channels,
    loading,
    error,
    fetchChannelsForRoom,
    createChannel,
    updateChannel,
    deleteChannel,
  };
}; 