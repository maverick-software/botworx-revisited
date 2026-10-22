import { useState, useCallback } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { type ChatRoomMember, type MemberType } from '../types/chat';
import { useAuth } from '../contexts/AuthContext'; // Corrected import

// Interface to potentially include fetched details alongside member info
export interface RoomMemberDetails extends ChatRoomMember {
  user_full_name?: string | null;
  user_avatar_url?: string | null;
  agent_name?: string | null;
  team_name?: string | null;
}

// Define a type for the data structure returned by the complex select
// This is an approximation; Supabase types might be more precise
type FetchedMemberData = ChatRoomMember & {
  user?: { full_name: string | null; avatar_url: string | null } | null;
  agent?: { name: string | null } | null;
  team?: { name: string | null } | null;
};

export const useRoomMembers = (roomId: string | null) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth(); // Corrected usage
  const [members, setMembers] = useState<RoomMemberDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!roomId) {
        setMembers([]);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch members and try to join basic info
      // RLS policy on chat_room_members ensures only members of the room can select.
      // This query might become complex; consider a DB function if performance suffers.
      const { data, error: fetchError } = await supabase
        .from('chat_room_members')
        .select(`
          *,
          user:profiles!member_id(full_name, avatar_url),
          agent:agents!member_id(name),
          team:teams!member_id(name)
        `)
        .eq('room_id', roomId);

      if (fetchError) throw fetchError;

      // Map data to include flattened details
      const detailedMembers = data?.map((m: FetchedMemberData) => ({
          ...m,
          user_full_name: m.member_type === 'user' && m.user ? m.user.full_name : null,
          user_avatar_url: m.member_type === 'user' && m.user ? m.user.avatar_url : null,
          agent_name: m.member_type === 'agent' && m.agent ? m.agent.name : null,
          team_name: m.member_type === 'team' && m.team ? m.team.name : null,
      })) || [];

      setMembers(detailedMembers as RoomMemberDetails[]);

    } catch (err: any) {
      console.error("Error fetching room members:", err);
      setError(err.message || 'Failed to fetch room members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, roomId]);

  // Consider when to fetch: maybe manually triggered or when roomId changes
  // useEffect(() => {
  //   fetchMembers();
  // }, [fetchMembers]);

  const addMember = async (type: MemberType, memberId: string): Promise<boolean> => {
    if (!roomId || !user || !memberId) {
        setError('Room ID, User context, and Member ID are required to add a member.');
        return false;
    }
    // RLS Policy "Allow room owner to add members" should handle permission check
    setLoading(true);
    setError(null);
    try {
        const { error: insertError } = await supabase
            .from('chat_room_members')
            .insert({ room_id: roomId, member_type: type, member_id: memberId });

        if (insertError) throw insertError;

        fetchMembers(); // Refetch members list after adding
        return true;

    } catch (err: any) {
        console.error("Error adding room member:", err);
        setError(err.message || 'Failed to add member. Check if you are the room owner.');
        return false;
    } finally {
        setLoading(false);
    }
  };

 const removeMember = async (memberEntryId: string): Promise<boolean> => {
    if (!roomId || !user || !memberEntryId) {
        setError('Room ID, User context, and Membership Entry ID are required to remove a member.');
        return false;
    }
     // RLS Policy "Allow room owner to remove members" should handle permission check
    setLoading(true);
    setError(null);
    try {
        const { error: deleteError } = await supabase
            .from('chat_room_members')
            .delete()
            .eq('id', memberEntryId)
            .eq('room_id', roomId); // Ensure deleting from the correct room

        if (deleteError) throw deleteError;

        // Optimistic update or refetch
        setMembers(prev => prev.filter(m => m.id !== memberEntryId));
        // fetchMembers(); // Alternatively refetch
        return true;

    } catch (err: any) {
        console.error("Error removing room member:", err);
        setError(err.message || 'Failed to remove member. Check if you are the room owner.');
        return false;
    } finally {
        setLoading(false);
    }
 };


  return {
    members,
    loading,
    error,
    fetchMembers,
    addMember,
    removeMember,
  };
}; 