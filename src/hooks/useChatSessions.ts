import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChatSession } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

interface UseChatSessionsReturn {
  sessions: ChatSession[];
  loading: boolean;
  error: PostgrestError | null;
  fetchChatSessions: (teamId: string) => Promise<void>;
  createChatSession: (teamId: string, sessionName?: string) => Promise<ChatSession | null>;
}

export function useChatSessions(): UseChatSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  // Fetch sessions for a specific team
  const fetchChatSessions = useCallback(async (teamId: string) => {
    if (!teamId) {
      console.warn('fetchChatSessions called without teamId');
      setSessions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false }); // Optional: order by creation date

      if (fetchError) throw fetchError;
      setSessions(data || []);
    } catch (err) {
      console.error(`Error fetching chat sessions for team ${teamId}:`, err);
      setError(err as PostgrestError);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new chat session for a team
  const createChatSession = useCallback(async (teamId: string, sessionName?: string): Promise<ChatSession | null> => {
    if (!teamId) {
      console.error('createChatSession requires a teamId');
      setError({ message: 'Team ID is required to create a session', details: '', hint: '', code: '400' } as PostgrestError);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const newSessionData: Partial<ChatSession> = { team_id: teamId };
      if (sessionName) {
        newSessionData.session_name = sessionName;
      }

      const { data, error: insertError } = await supabase
        .from('chat_sessions')
        .insert([newSessionData])
        .select()
        .single();

      if (insertError) throw insertError;
      
      const newSession = data as ChatSession;
      // Update local state
      setSessions(currentSessions => [newSession, ...currentSessions]); // Add to the beginning
      return newSession;

    } catch (err) {
      console.error(`Error creating chat session for team ${teamId}:`, err);
      setError(err as PostgrestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sessions,
    loading,
    error,
    fetchChatSessions,
    createChatSession,
  };
} 