/**
 * TypeScript type definitions for WebSocket Voice Server
 */

export interface ClientConnectionParams {
  token: string;
  agent_id: string;
  conversation_id?: string;
  voice?: string;
}

export interface OpenAIRealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

export interface UserMessage {
  session_id: string;
  sender_user_id: string;
  content: {
    type: 'text';
    text: string;
  };
  metadata: {
    input_method: 'realtime_voice';
    model: string;
  };
}

export interface AssistantMessage {
  session_id: string;
  sender_agent_id: string;
  content: {
    type: 'text';
    text: string;
  };
  metadata: {
    voice: string;
    model: string;
  };
}

export interface ProxyOptions {
  connectionId: string;
  clientWs: any; // WebSocket type
  supabase: any; // SupabaseClient type
  userId: string;
  agentId: string;
  conversationId: string | null;
  voice: string;
  logger: any; // Logger type
}

