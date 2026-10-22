import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { ChatMessage } from './context_builder.ts';

/**
 * Fetches chat history - Returns array matching ChatMessage interface
 * @param channelId - The channel ID for workspace chats (null for direct chats)
 * @param userId - The user ID for direct chats
 * @param targetAgentId - The agent ID for direct chats
 * @param limit - Maximum number of messages to retrieve
 * @param supabaseClient - Supabase client instance
 * @returns Array of chat messages
 */
export async function getRelevantChatHistory(
    channelId: string | null,
    userId: string | null,
    targetAgentId: string | null,
    limit: number,
    supabaseClient: SupabaseClient,
    conversationId?: string | null
): Promise<ChatMessage[]> {
  if (limit <= 0) return [];

  try {
    // Prefer v2 storage
    let v2Query = supabaseClient
        .from('chat_messages_v2')
        .select('role, content, created_at, sender_agent_id, sender_user_id, context, agents:sender_agent_id ( name )')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (channelId) {
        // Workspace Channel History
        v2Query = v2Query.eq('channel_id', channelId);
    } else if (conversationId) {
        // Direct Chat History scoped to a specific conversation
        v2Query = v2Query.eq('conversation_id', conversationId);
    } else if (userId && targetAgentId) {
        // Direct Chat History (User <-> Agent)
        v2Query = v2Query.is('channel_id', null)
                     .or(
                        `sender_user_id.eq.${userId},` +
                        `sender_agent_id.eq.${targetAgentId}`
                     );
    } else {
        // Invalid state or scenario not supported
        console.warn('[getRelevantChatHistory] Cannot fetch: No channelId AND no valid userId/targetAgentId pair.');
        return [];
    }

    const { data: v2Data, error: v2Error } = await v2Query;

    if (v2Error) {
      console.error(`[getRelevantChatHistory] Error:`, v2Error); 
      throw v2Error;
    }

    if (!v2Data) {
      return [];
    }

    const historyV2 = (v2Data || []).map((msg: any) => ({
        role: (msg.role === 'assistant' || msg.sender_agent_id) ? 'assistant' : 'user',
        content: typeof msg.content === 'string' ? msg.content : (msg.content?.text ?? ''),
        timestamp: msg.created_at,
        agentName: msg.agents?.name ?? null
    } as ChatMessage)).reverse();
    return historyV2;

  } catch (err) {
    console.error(`[getRelevantChatHistory] Error fetching history (channel: ${channelId}, user: ${userId}, agent: ${targetAgentId}):`, err);
    return [];
  }
}

/**
 * Saves a user message to the database (V2)
 * @param channelId - The channel ID where the message was sent
 * @param content - The message content
 * @param senderId - The ID of the user sending the message
 * @param supabaseClient - Supabase client instance
 * @param conversationId - The conversation ID
 * @param sessionId - The session ID
 * @returns Success status
 */
export async function saveUserMessage(
  channelId: string | null,
  content: string,
  senderId: string,
  supabaseClient: SupabaseClient,
  conversationId?: string,
  sessionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const userMessagePayload = {
      conversation_id: conversationId || crypto.randomUUID(),
      session_id: sessionId || crypto.randomUUID(),
      channel_id: channelId,
      content: typeof content === 'string' ? { type: 'text', text: content } : content,
      role: 'user',
      sender_user_id: senderId,
      sender_agent_id: null
    };

    const { error: insertError } = await supabaseClient
      .from('chat_messages_v2')
      .insert(userMessagePayload);

    if (insertError) {
      console.error('Error saving user message:', insertError);
      return { success: false, error: 'Failed to save message.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving user message:', error);
    return { success: false, error: 'Unexpected error occurred.' };
  }
}

/**
 * Saves an agent response to the database (V2)
 * @param channelId - The channel ID where the response was sent
 * @param content - The response content
 * @param agentId - The ID of the agent sending the response
 * @param supabaseClient - Supabase client instance
 * @param conversationId - The conversation ID
 * @param sessionId - The session ID
 * @returns Success status
 */
export async function saveAgentResponse(
  channelId: string | null,
  content: string,
  agentId: string,
  supabaseClient: SupabaseClient,
  conversationId?: string,
  sessionId?: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const agentResponsePayload = {
      conversation_id: conversationId || crypto.randomUUID(),
      session_id: sessionId || crypto.randomUUID(),
      channel_id: channelId,
      content: typeof content === 'string' ? { type: 'text', text: content } : content,
      role: 'assistant',
      sender_user_id: userId || null,  // Store user_id for token tracking
      sender_agent_id: agentId
    };

    const { error: responseInsertError } = await supabaseClient
      .from('chat_messages_v2')
      .insert(agentResponsePayload);

    if (responseInsertError) {
      console.error('Error saving agent response:', responseInsertError);
      return { success: false, error: 'Failed to save agent response.' };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving agent response:', error);
    return { success: false, error: 'Unexpected error occurred.' };
  }
} 