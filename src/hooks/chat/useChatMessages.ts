import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConversationLifecycle } from './useConversationLifecycle';

export function useChatMessages(
  agentId: string | undefined,
  userId: string | undefined,
  conversationLifecycle: ConversationLifecycle,
  conversationRefreshKey: number
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [messageSubscription, setMessageSubscription] = useState<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track fresh conversations created in this session (don't fetch history for these)
  const freshConversationsRef = useRef<Set<string>>(new Set());

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  
  // Mark a conversation as fresh (just created, messages already in UI)
  const markConversationAsFresh = useCallback((conversationId: string) => {
    freshConversationsRef.current.add(conversationId);
    console.log('[useChatMessages] Marked conversation as fresh:', conversationId);
  }, []);

  // Fetch chat history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!agentId || !userId) return;
      
      if (conversationLifecycle.status !== 'active') {
        console.log('[fetchHistory] Skipping - lifecycle status:', conversationLifecycle.status);
        // Don't clear messages! Keep existing UI messages.
        setIsHistoryLoading(false);
        return;
      }
      
      const conversationId = conversationLifecycle.id;
      
      // Skip history fetch for fresh conversations (just created in this session)
      console.log('[fetchHistory] Checking if conversation is fresh:', conversationId, 'Fresh set:', Array.from(freshConversationsRef.current));
      if (freshConversationsRef.current.has(conversationId)) {
        console.log('[fetchHistory] Skipping - fresh conversation, UI already has messages');
        setIsHistoryLoading(false);
        return;
      }
      
      console.log('[fetchHistory] Loading history from database for conversation:', conversationId);
      
      setIsHistoryLoading(true);
      try {
        // Check if conversation exists
        try {
          const { data: sessionRow } = await supabase
            .from('conversation_sessions')
            .select('status')
            .eq('conversation_id', conversationId)
            .eq('agent_id', agentId)
            .eq('user_id', userId)
            .maybeSingle();
          
          if (sessionRow && sessionRow.status !== 'active') {
            console.log('[fetchHistory] Conversation is archived, clearing');
            setMessages([]);
            return;
          }
        } catch { /* non-fatal */ }

        // Fetch messages
        const { data: assistantData, error: assistantErr } = await supabase
          .from('chat_messages_v2')
          .select('*')
          .eq('sender_agent_id', agentId)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        if (assistantErr) throw assistantErr;

        const { data: userData, error: userErr } = await supabase
          .from('chat_messages_v2')
          .select('*')
          .eq('sender_user_id', userId)
          .eq('conversation_id', conversationId)
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
          userId: msg.sender_agent_id ? userId : msg.sender_user_id,
          metadata: msg.metadata || undefined,
        }));

        setMessages(formatted);
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [agentId, userId, conversationLifecycle, conversationRefreshKey]);

  // Reset messages when switching conversations
  // Track previous lifecycle to detect transitions
  const prevLifecycleRef = useRef(conversationLifecycle);
  
  useEffect(() => {
    const prev = prevLifecycleRef.current;
    const current = conversationLifecycle;
    
    // Don't clear messages when transitioning from 'creating' to 'active'
    // This preserves the user message and thinking indicator
    if (prev.status === 'creating' && current.status === 'active' && prev.id === current.id) {
      console.log('[useChatMessages] Transitioning creating -> active, preserving messages');
      prevLifecycleRef.current = current;
      return;
    }
    
    // Clear messages when going to 'none' (New chat clicked)
    if (current.status === 'none' && prev.status !== 'none') {
      console.log('[useChatMessages] Transitioning to none, clearing messages');
      setMessages([]);
      prevLifecycleRef.current = current;
      return;
    }
    
    // Don't clear when creating
    if (current.status === 'creating') {
      console.log('[useChatMessages] Creating new conversation, preserving messages');
      prevLifecycleRef.current = current;
      return;
    }
    
    // Clear and reload when switching to a different conversation
    // This includes: active->active (different ID) AND none->active
    if (current.status === 'active') {
      const isDifferentConversation = prev.status === 'active' && prev.id !== current.id;
      const isLoadingFromNone = prev.status === 'none';
      
      if (isDifferentConversation || isLoadingFromNone) {
        console.log('[useChatMessages] Loading conversation, clearing UI first');
        setMessages([]);
        setIsHistoryLoading(true);
      }
    }
    
    prevLifecycleRef.current = current;
  }, [agentId, conversationLifecycle]);

  // Real-time subscription
  useEffect(() => {
    const conversationId = conversationLifecycle.status === 'active' ? conversationLifecycle.id : null;
    
    if (!conversationId || !agentId) {
      if (messageSubscription) {
        console.log('Cleaning up message subscription');
        supabase.removeChannel(messageSubscription);
        setMessageSubscription(null);
      }
      return;
    }

    console.log(`Setting up real-time subscription for conversation: ${conversationId}`);
    
    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages_v2',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          console.log('New message received via realtime:', payload);
          const newMessage = payload.new as any;
          
          const message: Message = {
            role: newMessage.role,
            content: typeof newMessage.content === 'string' ? newMessage.content : newMessage.content?.text || '',
            timestamp: new Date(newMessage.created_at),
            userId: newMessage.sender_user_id,
            agentId: newMessage.sender_agent_id,
            metadata: newMessage.metadata || undefined,
          };
          
          setMessages(prev => {
            const exists = prev.some(m => 
              m.content === message.content && 
              Math.abs(m.timestamp.getTime() - message.timestamp.getTime()) < 1000
            );
            if (exists) return prev;
            return [...prev, message];
          });
        }
      )
      .subscribe((status: any, err: any) => {
        if (status === 'SUBSCRIBED') {
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Connected to messages for conversation ${conversationId}`);
          }
        } else if (status === 'CHANNEL_ERROR') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('🔄 Message connection interrupted, auto-reconnecting...');
          }
        }
      });

    setMessageSubscription(channel);

    return () => {
      if (channel) {
        console.log(`Unsubscribing from messages for conversation ${conversationId}`);
        supabase.removeChannel(channel);
      }
    };
  }, [conversationLifecycle, agentId]);

  return {
    messages,
    setMessages,
    isHistoryLoading,
    scrollToBottom,
    messagesEndRef,
    markConversationAsFresh,
  };
}

