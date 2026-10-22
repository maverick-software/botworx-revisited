import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChatRoom } from '../types'; // Assuming ChatRoom type exists
import { PostgrestError } from '@supabase/supabase-js';

// Define the shape of the data returned by the query
interface TeamChatRoomMembership {
  team_id: string;
  member_id: string; // Should match team_id
  member_type: 'team';
  chat_rooms: ChatRoom | null; // Joined data
}

interface UseTeamChatRoomsReturn {
  chatRooms: ChatRoom[];
  loading: boolean;
  error: PostgrestError | null;
  fetchTeamChatRooms: (teamId: string) => Promise<void>;
}

export function useTeamChatRooms(): UseTeamChatRoomsReturn {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  const fetchTeamChatRooms = useCallback(async (teamId: string) => {
    if (!teamId) {
      console.warn('fetchTeamChatRooms called without teamId');
      setChatRooms([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_room_members')
        .select(`
          team_id:member_id,
          member_type,
          chat_rooms (*) 
        `)
        .eq('member_type', 'team')
        .eq('member_id', teamId);

      if (fetchError) throw fetchError;

      // Extract the chat_rooms data, filtering out nulls
      const rooms = (data as TeamChatRoomMembership[] | null)
        ?.map(item => item.chat_rooms)
        .filter((room): room is ChatRoom => room !== null) || [];
        
      setChatRooms(rooms);
      console.log('[useTeamChatRooms] Fetched rooms:', rooms);

    } catch (err) {
      console.error(`Error fetching chat rooms for team ${teamId}:`, err);
      setError(err as PostgrestError);
      setChatRooms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    chatRooms,
    loading,
    error,
    fetchTeamChatRooms,
  };
} 