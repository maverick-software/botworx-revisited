/**
 * OpenAI Realtime API Proxy
 * Handles bidirectional WebSocket forwarding between client and OpenAI
 */

import WebSocket from 'ws';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { ProxyOptions, OpenAIRealtimeEvent } from './types';

/**
 * Create a proxy connection between client WebSocket and OpenAI Realtime API
 */
export async function createOpenAIProxy(options: ProxyOptions) {
  const {
    connectionId,
    clientWs,
    supabase,
    userId,
    agentId,
    conversationId,
    voice,
    logger
  } = options;

  // Fetch OpenAI API key from Supabase Vault
  const openaiApiKey = await getOpenAIAPIKey(supabase, logger, connectionId);
  
  if (!openaiApiKey) {
    logger.error(`[${connectionId}] OpenAI API key not available`);
    clientWs.close(1011, 'OpenAI API key not configured');
    throw new Error('OpenAI API key not available');
  }

  logger.info(`[${connectionId}] Connecting to OpenAI Realtime API...`);

  // Connect to OpenAI Realtime API
  const openaiWs = new WebSocket(
    'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
    {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    }
  );

  let sessionId: string | null = null;
  let currentConversationId = conversationId;
  let userTranscript = '';
  let assistantTranscript = '';

  // OpenAI → Client forwarding
  openaiWs.on('open', () => {
    logger.info(`[${connectionId}] Connected to OpenAI Realtime API`);
    
    // Send session configuration
    openaiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    }));
  });

  openaiWs.on('message', async (data: WebSocket.Data) => {
    try {
      const event: OpenAIRealtimeEvent = JSON.parse(data.toString());
      
      // Log important events
      if (event.type === 'session.created') {
        sessionId = event.session?.id;
        logger.info(`[${connectionId}] OpenAI session created: ${sessionId}`);
      } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
        // User speech transcript
        userTranscript = event.transcript || '';
        logger.info(`[${connectionId}] User said: "${userTranscript}"`);
      } else if (event.type === 'response.audio_transcript.delta') {
        // Assistant speech transcript (streaming)
        assistantTranscript += event.delta || '';
      } else if (event.type === 'response.done') {
        // Response complete, save to database
        logger.info(`[${connectionId}] Assistant said: "${assistantTranscript}"`);
        
        // Create conversation if not exists
        if (!currentConversationId) {
          try {
            const { data: newConv, error: convError } = await supabase
              .from('conversation_sessions')
              .insert({
                user_id: userId,
                agent_id: agentId,
                title: 'Voice Chat',
                started_at: new Date().toISOString(),
                last_active: new Date().toISOString(),
                session_state: { started_via: 'realtime_voice' }
              })
              .select('session_id')
              .single();
            
            if (!convError && newConv) {
              currentConversationId = newConv.session_id;
              logger.info(`[${connectionId}] Created conversation: ${currentConversationId}`);
              
              // Notify client of new conversation ID
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'conversation.created',
                  conversation_id: currentConversationId
                }));
              }
            } else {
              logger.error(`[${connectionId}] Failed to create conversation:`, convError);
            }
          } catch (error) {
            logger.error(`[${connectionId}] Error creating conversation:`, error);
          }
        }
        
        // Save user message
        if (userTranscript && currentConversationId) {
          try {
            await supabase.from('chat_messages_v2').insert({
              session_id: currentConversationId,
              sender_user_id: userId,
              content: { type: 'text', text: userTranscript },
              metadata: {
                input_method: 'realtime_voice',
                model: 'gpt-4o-realtime-preview'
              }
            });
            logger.debug(`[${connectionId}] Saved user message to database`);
          } catch (error) {
            logger.error(`[${connectionId}] Error saving user message:`, error);
          }
        }
        
        // Save assistant message
        if (assistantTranscript && currentConversationId) {
          try {
            await supabase.from('chat_messages_v2').insert({
              session_id: currentConversationId,
              sender_agent_id: agentId,
              content: { type: 'text', text: assistantTranscript },
              metadata: {
                voice: voice,
                model: 'gpt-4o-realtime-preview'
              }
            });
            logger.debug(`[${connectionId}] Saved assistant message to database`);
          } catch (error) {
            logger.error(`[${connectionId}] Error saving assistant message:`, error);
          }
        }
        
        // Reset transcripts
        userTranscript = '';
        assistantTranscript = '';
      }
      
      // Forward all events to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(event));
      }
    } catch (error) {
      logger.error(`[${connectionId}] Error processing OpenAI message:`, error);
    }
  });

  openaiWs.on('error', (error) => {
    logger.error(`[${connectionId}] OpenAI WebSocket error:`, error);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        error: 'OpenAI connection error'
      }));
    }
  });

  openaiWs.on('close', (code, reason) => {
    logger.info(`[${connectionId}] OpenAI connection closed: ${code} - ${reason}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'OpenAI connection closed');
    }
  });

  // Client → OpenAI forwarding
  clientWs.on('message', (data: WebSocket.Data) => {
    try {
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(data);
      } else {
        logger.warn(`[${connectionId}] Cannot forward message, OpenAI not connected`);
      }
    } catch (error) {
      logger.error(`[${connectionId}] Error forwarding client message:`, error);
    }
  });

  // Cleanup function
  const cleanup = () => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close(1000, 'Client disconnected');
    }
  };

  return { cleanup };
}

/**
 * Get OpenAI API key from Supabase Vault
 */
async function getOpenAIAPIKey(
  supabase: SupabaseClient, 
  logger: Logger, 
  connectionId: string
): Promise<string | null> {
  try {
    // Get vault_secret_id from system_api_keys
    const { data: systemKey, error: keyError } = await supabase
      .from('system_api_keys')
      .select('vault_secret_id')
      .eq('provider_name', 'openai')
      .eq('is_active', true)
      .single();

    if (keyError || !systemKey?.vault_secret_id) {
      logger.error(`[${connectionId}] No system API key found for OpenAI:`, keyError);
      return null;
    }

    // Decrypt from vault using get_secret function
    const { data: secretData, error: vaultError } = await supabase
      .rpc('get_secret', { secret_id: systemKey.vault_secret_id });

    if (vaultError || !secretData || secretData.length === 0) {
      logger.error(`[${connectionId}] Failed to decrypt OpenAI key:`, vaultError);
      return null;
    }

    // get_secret returns an array with one row containing {key: "secret"}
    return secretData[0]?.key || null;
  } catch (error) {
    logger.error(`[${connectionId}] Error fetching OpenAI API key:`, error);
    return null;
  }
}

