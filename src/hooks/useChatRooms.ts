// src/hooks/useChatRooms.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase'; // Import client directly
import { type ChatRoom } from '../types/chat'; // Assuming chat types are in src/types/chat.ts
import { useAuth } from '../contexts/AuthContext'; // Corrected import

export const useChatRooms = () => {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserChatRooms = useCallback(async () => {
    if (!user) {
      setChatRooms([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Call the database function using the directly imported client
      const { data, error: rpcError } = await supabase.rpc('get_user_chat_rooms', {
        p_user_id: user.id,
      });
      if (rpcError) {
        throw rpcError;
      }
      setChatRooms((data as ChatRoom[]) || []);
    } catch (err: any) {
      console.error("Error fetching chat rooms:", err);
      setError(err.message || 'Failed to fetch chat rooms');
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
    // Pass supabase directly in dependency array if needed, though likely stable
  }, [user]); // Removed supabase from dependency array as it's imported globally

  // Initial fetch when user context is available
  useEffect(() => {
    if (user) {
      fetchUserChatRooms();
    }
  }, [user, fetchUserChatRooms]);

  const createChatRoom = async (name: string): Promise<ChatRoom | null> => {
    if (!user || !name.trim()) {
      setError('User must be logged in and room name cannot be empty.');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
        const { data, error: insertError } = await supabase // Use imported supabase
            .from('chat_rooms')
            .insert({ name: name.trim(), owner_user_id: user.id })
            .select()
            .single();
        if (insertError) {
            throw insertError;
        }
        if (data) {
            const newRoom = data as ChatRoom;
            setChatRooms(prev => [...prev, newRoom]);
            return newRoom;
        } else {
             throw new Error('Failed to create room: No data returned');
        }
    } catch (err: any) {
        console.error("Error creating chat room:", err);
        setError(err.message || 'Failed to create chat room');
        return null;
    } finally {
        setLoading(false);
    }
  };

  // Placeholder for fetching single room details - might need more data
  const fetchRoomDetails = async (roomId: string): Promise<ChatRoom | null> => {
    if (!user) return null; // Need user for RLS check implicitly
    setLoading(true);
    setError(null);
    try {
      const { data, error: detailsError } = await supabase // Use imported supabase
        .from('chat_rooms')
        .select('*')
        .eq('id', roomId)
        // RLS check is implicit based on the SELECT policy for chat_rooms
        .maybeSingle();

      if (detailsError) throw detailsError;
      // TODO: Potentially fetch associated channels/members here or in separate hooks
      return data as ChatRoom | null;

    } catch (err: any) {
        console.error("Error fetching room details:", err);
        setError(err.message || 'Failed to fetch room details');
        return null;
    } finally {
        setLoading(false);
    }
  };

  return {
    chatRooms,
    loading,
    error,
    fetchUserChatRooms, // Expose refetch capability
    createChatRoom,
    fetchRoomDetails,
  };
}; 