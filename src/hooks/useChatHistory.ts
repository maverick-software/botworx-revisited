import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatState } from '../types/chat';
import type { Message } from '../types';

export function useChatHistory(
  agentId: string | undefined,
  user: any,
  selectedConversationId: string | null,
  isCreatingNewConversation: boolean,
  updateChatState: (updates: Partial<ChatState>) => void,
  navigate: any
) {
  const fetchHistory = useCallback(async () => {
    if (!agentId || !user?.id) return;
    
    // Skip fetching if we're in the process of creating a new conversation
    if (isCreatingNewConversation) return;
    
    updateChatState({ isHistoryLoading: true });
    
    try {
      // If no conversation is selected, show a clean slate
      if (!selectedConversationId) {
        updateChatState({ messages: [] });
        return;
      }

      // Validate conversation is active; if archived or missing, clear selection and redirect
      try {
        const { data: sessionRow } = await supabase
          .from('conversation_sessions')
          .select('status')
          .eq('conversation_id', selectedConversationId)
          .eq('agent_id', agentId)
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (!sessionRow || sessionRow.status !== 'active') {
          updateChatState({ selectedConversationId: null });
          try { 
            localStorage.removeItem(`agent_${agentId}_conversation_id`); 
          } catch {}
          // Remove conv param from URL to show new conversation screen
          navigate(`/agents/${agentId}/chat`, { replace: true });
          updateChatState({ messages: [] });
          return;
        }
      } catch { /* non-fatal; proceed */ }

      const { data: assistantData, error: assistantErr } = await supabase
        .from('chat_messages_v2')
        .select('*')
        .eq('sender_agent_id', agentId)
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true });
      if (assistantErr) throw assistantErr;

      const { data: userData, error: userErr } = await supabase
        .from('chat_messages_v2')
        .select('*')
        .eq('sender_user_id', user.id)
        .eq('conversation_id', selectedConversationId)
        .order('created_at', { ascending: true });
      if (userErr) throw userErr;

      const rows = [...(assistantData || []), ...(userData || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const formatted: Message[] = rows.map((msg: any) => ({
        role: (msg.role === 'assistant' || msg.sender_agent_id) ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
        timestamp: new Date(msg.created_at),
        agentId: msg.sender_agent_id,
        userId: msg.sender_agent_id ? user.id : msg.sender_user_id,
      }));

      updateChatState({ messages: formatted });
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
      updateChatState({ error: 'Could not load chat history.' });
    } finally {
      updateChatState({ isHistoryLoading: false });
    }
  }, [agentId, user?.id, selectedConversationId, isCreatingNewConversation, updateChatState, navigate]);

  return { fetchHistory };
}
