/**
 * Realtime Voice WebSocket Edge Function
 * 
 * Proxies WebSocket connection to OpenAI's Realtime API
 * - Manages WebSocket connection to OpenAI
 * - Handles authentication and session setup
 * - Forwards events between client and OpenAI
 * - Saves transcripts to database
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Fetch OpenAI API key from system_api_keys table and Supabase Vault
 */
async function getOpenAIAPIKey(supabase: any): Promise<string | null> {
  try {
    const { data: systemKey, error } = await supabase
      .from('system_api_keys')
      .select('vault_secret_id, is_active')
      .eq('provider_name', 'openai')
      .eq('is_active', true)
      .single();

    if (error || !systemKey?.vault_secret_id) {
      console.warn('[RealtimeVoice] No system API key found for OpenAI');
      return null;
    }

    const { data: secretData, error: vaultError } = await supabase
      .rpc('get_secret', { secret_id: systemKey.vault_secret_id });

    if (vaultError || !secretData || secretData.length === 0) {
      console.error('[RealtimeVoice] Failed to decrypt OpenAI key:', vaultError);
      return null;
    }

    return secretData[0]?.key || null;
  } catch (err) {
    console.error('[RealtimeVoice] Error fetching system API key for OpenAI:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  console.log('[RealtimeVoice] Incoming request:', {
    url: req.url,
    method: req.method,
    upgrade: req.headers.get('upgrade'),
    connection: req.headers.get('connection')
  });

  // Only accept WebSocket upgrade requests
  if (req.headers.get('upgrade') !== 'websocket') {
    console.log('[RealtimeVoice] Not a WebSocket request');
    return new Response('Expected WebSocket connection', { status: 426 });
  }

  try {
    // Get query parameters
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversation_id');
    const agentId = url.searchParams.get('agent_id');
    const voice = url.searchParams.get('voice') || 'alloy';
    const token = url.searchParams.get('token');

    if (!agentId) {
      console.log('[RealtimeVoice] Missing agent_id');
      return new Response('Missing agent_id parameter', { status: 400 });
    }

    // Verify authentication (from query param for WebSocket)
    if (!token) {
      console.log('[RealtimeVoice] Missing auth token');
      return new Response('Missing authorization token', { status: 401 });
    }

    const authHeader = `Bearer ${token}`;

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get OpenAI API key
    const OPENAI_API_KEY = await getOpenAIAPIKey(supabaseServiceClient);
    if (!OPENAI_API_KEY) {
      return new Response('Voice service not configured', { status: 500 });
    }

    // Create conversation if needed
    let activeConversationId = conversationId;
    if (!activeConversationId || activeConversationId.trim() === '') {
      const { data: newConv, error: convError } = await supabaseServiceClient
        .from('conversations')
        .insert({
          agent_id: agentId,
          user_id: user.id,
          title: 'Voice Conversation',
          metadata: { started_via: 'realtime_voice' }
        })
        .select('id')
        .single();

      if (convError || !newConv) {
        return new Response('Failed to create conversation', { status: 500 });
      }

      activeConversationId = newConv.id;
      console.log(`[RealtimeVoice] Created conversation: ${activeConversationId}`);
    }

    console.log(`[RealtimeVoice] Starting WebSocket proxy for user ${user.id}`);

    // Upgrade client connection to WebSocket
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // Connect to OpenAI Realtime API
    const openaiWs = new WebSocket(
      'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      }
    );

    let sessionInitialized = false;
    let userTranscript = '';
    let assistantTranscript = '';

    // Handle OpenAI WebSocket connection
    openaiWs.onopen = () => {
      console.log('[RealtimeVoice] Connected to OpenAI Realtime API');
      
      // Send session configuration
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'You are a helpful AI assistant. Keep responses concise and natural for voice interaction.',
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
      };

      openaiWs.send(JSON.stringify(sessionConfig));
      sessionInitialized = true;
    };

    // Forward messages from OpenAI to client
    openaiWs.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      // Log important events
      if (data.type === 'session.created' || data.type === 'session.updated') {
        console.log(`[RealtimeVoice] ${data.type}`);
      }

      // Track transcripts
      if (data.type === 'conversation.item.input_audio_transcription.completed') {
        userTranscript += (data.transcript || '') + ' ';
      }

      if (data.type === 'response.audio_transcript.delta') {
        assistantTranscript += (data.delta || '');
      }

      // Save messages when response is complete
      if (data.type === 'response.done') {
        console.log('[RealtimeVoice] Response complete, saving transcripts');
        
        // Save user message
        if (userTranscript.trim()) {
          await supabaseServiceClient
            .from('chat_messages_v2')
            .insert({
              conversation_id: activeConversationId,
              agent_id: agentId,
              user_id: user.id,
              role: 'user',
              content: userTranscript.trim(),
              metadata: {
                input_method: 'realtime_voice',
                model: 'gpt-4o-realtime-preview'
              }
            });
          userTranscript = '';
        }

        // Save assistant message
        if (assistantTranscript.trim()) {
          await supabaseServiceClient
            .from('chat_messages_v2')
            .insert({
              conversation_id: activeConversationId,
              agent_id: agentId,
              user_id: user.id,
              role: 'assistant',
              content: assistantTranscript.trim(),
              metadata: {
                voice: voice,
                model: 'gpt-4o-realtime-preview'
              }
            });
          assistantTranscript = '';
        }

        // Send conversation_id to client on first response
        if (!conversationId) {
          clientSocket.send(JSON.stringify({
            type: 'conversation_created',
            conversation_id: activeConversationId
          }));
        }
      }

      // Forward event to client
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data);
      }
    };

    openaiWs.onerror = (error) => {
      console.error('[RealtimeVoice] OpenAI WebSocket error:', error);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({
          type: 'error',
          error: 'Connection to voice service failed'
        }));
      }
    };

    openaiWs.onclose = () => {
      console.log('[RealtimeVoice] OpenAI WebSocket closed');
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    // Handle client WebSocket
    clientSocket.onopen = () => {
      console.log('[RealtimeVoice] Client connected');
    };

    // Forward messages from client to OpenAI
    clientSocket.onmessage = (event) => {
      if (openaiWs.readyState === WebSocket.OPEN && sessionInitialized) {
        openaiWs.send(event.data);
      }
    };

    clientSocket.onerror = (error) => {
      console.error('[RealtimeVoice] Client WebSocket error:', error);
    };

    clientSocket.onclose = () => {
      console.log('[RealtimeVoice] Client disconnected');
      if (openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    };

    return response;

  } catch (error) {
    console.error('[RealtimeVoice] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
});

