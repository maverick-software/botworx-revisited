import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { type ChatMessage } from '../types/chat';
import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';

interface UseChatMessagesReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: PostgrestError | string | null;
  createMessage: (channelId: string, content: string, sender: { senderUserId?: string; senderAgentId?: string }, metadata?: Record<string, any>) => Promise<ChatMessage | null>;
  sendMessage: (content: string, agentId?: string | null) => Promise<void>;
  currentChannelId: string | null;
}

export function useChatMessages(
  workspaceId: string | null,
  initialChannelId: string | null
): UseChatMessagesReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<PostgrestError | string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(initialChannelId);
  const [currentSubscription, setCurrentSubscription] = useState<RealtimeChannel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchMessages = useCallback(async (channelId: string, offset: number = 0, limit: number = 50) => {
    if (!channelId) {
      console.warn('fetchMessages called without channelId');
      setMessages([]);
      return;
    }
    console.log(`Fetching messages for channel ${channelId}, offset: ${offset}, limit: ${limit}`);
    setError(null);
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('chat_messages_v2')
        .select(`
          *,
          agents:sender_agent_id (
            id,
            name
          )
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (fetchError) throw fetchError;
      
      const fetchedMessages = data?.map((msg: any) => {
        const message: ChatMessage = {
          ...msg,
          content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
          timestamp: new Date(msg.created_at),
          role: (msg.role === 'assistant' || msg.sender_agent_id) ? 'assistant' : 'user',
          agentName: msg.agents?.name || null
        };
        return message;
      }) || [];

      console.log('Fetched and processed messages with agent names:', fetchedMessages);
      
      setMessages(prevMessages => {
          const existingIds = new Set(prevMessages.map(m => m.id));
          const newMessages = fetchedMessages.filter(m => !existingIds.has(m.id));
          
          if (offset === 0) {
              if (prevMessages.length !== fetchedMessages.length || 
                  (prevMessages.length > 0 && fetchedMessages.length > 0 && prevMessages[0].id !== fetchedMessages[0].id)) {
                 return fetchedMessages; 
              } else {
                 return prevMessages;
              }
          } else {
              return newMessages.length > 0 ? [...newMessages, ...prevMessages] : prevMessages;
          }
      });
      
    } catch (err) {
        console.error(`Error fetching messages for channel ${channelId}:`, err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred fetching messages.');
        setMessages([]);
    } finally {
        setLoading(false);
    }
  }, []);

  const subscribeToNewMessages = useCallback((channelId: string) => {
    if (!channelId) {
      console.error('subscribeToNewMessages requires a channelId');
      setError('Channel ID is required to subscribe to messages.');
      return null;
    }
    
    if (currentSubscription) {
        console.log(`Unsubscribing from previous channel: ${currentSubscription.topic}`);
        supabase.removeChannel(currentSubscription);
    }

    setError(null);
    console.log(`Subscribing to new messages for channel ${channelId}`);
    
    const channel = supabase.channel(`chat_channel_v2:${channelId}`)
      .on<ChatMessage>(
        'postgres_changes',
        { 
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages_v2',
          filter: `channel_id=eq.${channelId}`
        },
        async (payload) => {
          console.log('New message received via Realtime:', payload);
          const newMessageRaw = payload.new as any;
          
          let agentName = null;
          if (newMessageRaw.sender_agent_id) {
            try {
              const { data: agentData } = await supabase
                .from('agents')
                .select('name')
                .eq('id', newMessageRaw.sender_agent_id)
                .single();
              
              if (agentData) {
                agentName = agentData.name;
              }
            } catch (err) {
              console.error('Error fetching agent name for realtime message:', err);
            }
          }
          
          const newMessage: ChatMessage = {
            ...newMessageRaw,
            content: typeof newMessageRaw.content === 'string' ? newMessageRaw.content : (newMessageRaw.content?.text ?? ''),
            timestamp: new Date(newMessageRaw.created_at),
            role: (newMessageRaw.role === 'assistant' || newMessageRaw.sender_agent_id) ? 'assistant' : 'user',
            agentName
          } as any;
          
          const currentMessages = messagesRef.current;
          if (!currentMessages.some(msg => msg.id === newMessage.id)) {
            setMessages([...currentMessages, newMessage]);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to channel ${channelId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Realtime subscription error for channel ${channelId}:`, status, err);
          setError(`Subscription failed: ${status}. ${err?.message || 'Check console.'}`);
        } else {
            console.log(`Realtime status for channel ${channelId}:`, status);
        }
      });

    setCurrentSubscription(channel);
    return channel;

  }, [currentSubscription]);

  useEffect(() => {
    if (currentChannelId) {
      setMessages([]);
      fetchMessages(currentChannelId);
      subscribeToNewMessages(currentChannelId);
    } else {
      setMessages([]);
      if (currentSubscription) {
          console.log(`Unsubscribing due to null channelId: ${currentSubscription.topic}`);
          supabase.removeChannel(currentSubscription);
          setCurrentSubscription(null);
      }
    }

    return () => {
        if (currentSubscription) {
            console.log(`Unsubscribing during cleanup: ${currentSubscription.topic}`);
            supabase.removeChannel(currentSubscription);
        }
    };
  }, [currentChannelId]);

  const createMessage = useCallback(async (
    channelId: string,
    content: string,
    sender: { senderUserId?: string; senderAgentId?: string },
    metadata?: Record<string, any>
  ): Promise<ChatMessage | null> => {
    console.log('createMessage called for channel', channelId);
    if (!channelId) {
        setError('Channel ID is required to create a message.');
        return null;
    }
    if (!sender.senderUserId && !sender.senderAgentId) {
      const errMsg = 'Message sender (user or agent) is required.';
      console.error(`createMessage Error: ${errMsg}`);
      setError(errMsg);
      return null;
    }
    if (!content) {
        const errMsg = 'Message content cannot be empty.';
        console.error(`createMessage Error: ${errMsg}`);
        setError(errMsg);
        return null;
    }

    setError(null);

    try {
      const newMessagePayload: Partial<ChatMessage> = {
        channel_id: channelId,
        content: content,
        sender_user_id: sender.senderUserId,
        sender_agent_id: sender.senderAgentId,
        metadata: metadata
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('chat_messages')
        .insert([newMessagePayload])
        .select()
        .single();

      if (insertError) throw insertError;
      if (!insertedData) throw new Error("Message insertion returned no data.");

      const newMessage = insertedData as ChatMessage;
      console.log(`Message ${newMessage.id} created successfully.`);

      setMessages(currentMessages => [...currentMessages, newMessage]);

      try {
          console.log(`Triggering embedding generation for message ${newMessage.id}...`);
          const { data: embeddingData, error: rpcError } = await supabase.functions.invoke('generate-embedding', {
              body: { content: newMessage.content }
          });

          if (rpcError) {
              throw rpcError;
          } 

          if (embeddingData && embeddingData.embedding) {
              console.log(`Embedding received for message ${newMessage.id}, updating DB...`);
              const { error: updateError } = await supabase
                  .from('chat_messages')
                  .update({ embedding: embeddingData.embedding })
                  .eq('id', newMessage.id);
              
              if (updateError) {
                  console.error(`Failed to update message ${newMessage.id} with embedding:`, updateError);
              } else {
                  console.log(`Successfully updated message ${newMessage.id} with embedding.`);
              }
          } else {
              console.warn(`generate-embedding function did not return expected embedding data for message ${newMessage.id}.`);
          }

      } catch (embeddingError) {
          console.error(`Embedding generation/update failed for message ${newMessage.id}:`, embeddingError);
      }

      return newMessage;

    } catch (err) {
      console.error(`Error creating message in channel ${channelId}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred creating the message.');
      return null;
    } 
  }, []);

  const sendMessage = useCallback(async (content: string, agentIdToSend: string | null = null) => {
    if (!content.trim()) {
        setError('Cannot send an empty message.');
        return;
    }
    if (!user?.id) {
        setError('User not authenticated.');
        return;
    }
    if (!workspaceId) {
        setError('Workspace context is missing.');
        return;
    }
     if (!currentChannelId) {
        setError('Channel context is missing.');
        return;
    }

    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSending(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error(`Authentication error: ${sessionError?.message || 'Could not get session token.'}`);
      }
      const accessToken = session.access_token;

      const requestBody = {
        agentId: agentIdToSend,
        message: content.trim(),
        roomId: workspaceId,
        channelId: currentChannelId,
      };
      console.log("[useChatMessages] Sending chat request body:", requestBody);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      abortControllerRef.current = null;

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) { /* Ignore */ }
        console.error(`[useChatMessages] HTTP error! Status: ${response.status}`, errorData);
        throw new Error(errorData?.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      console.log("[useChatMessages] Received response:", result);
      
    } catch (err: any) {
      abortControllerRef.current = null;
      if (err.name === 'AbortError') {
        console.log('[useChatMessages] Fetch aborted.');
      } else {
        console.error('[useChatMessages] Error sending message:', err);
        setError('Failed to send message: ' + err.message);
      }
    } finally {
      setSending(false);
    }
  }, [user?.id, workspaceId, currentChannelId]);

  return {
    messages,
    loading,
    sending,
    error,
    createMessage,
    sendMessage,
    currentChannelId
  };
} 