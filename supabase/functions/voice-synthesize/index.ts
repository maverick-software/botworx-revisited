/**
 * Voice Synthesis Edge Function
 * 
 * Handles text-to-speech using OpenAI's TTS API.
 * Accepts text and returns audio file.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface SynthesizeRequest {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  speed?: number; // 0.25 to 4.0
  model?: 'tts-1' | 'tts-1-hd'; // tts-1 is faster, tts-1-hd is higher quality
}

/**
 * Fetch OpenAI API key from system_api_keys table and Supabase Vault
 */
async function getOpenAIAPIKey(supabase: any): Promise<string | null> {
  try {
    // Get vault_secret_id from system_api_keys
    const { data: systemKey, error } = await supabase
      .from('system_api_keys')
      .select('vault_secret_id, is_active')
      .eq('provider_name', 'openai')
      .eq('is_active', true)
      .single();

    if (error || !systemKey?.vault_secret_id) {
      console.warn('[VoiceSynthesize] No system API key found for OpenAI');
      return null;
    }

    // Decrypt from vault using get_secret function
    const { data: secretData, error: vaultError } = await supabase
      .rpc('get_secret', { secret_id: systemKey.vault_secret_id });

    if (vaultError || !secretData || secretData.length === 0) {
      console.error('[VoiceSynthesize] Failed to decrypt OpenAI key:', vaultError);
      return null;
    }

    // get_secret returns an array with one row containing {key: "secret"}
    return secretData[0]?.key || null;
  } catch (err) {
    console.error('[VoiceSynthesize] Error fetching system API key for OpenAI:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for vault access
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create auth client to verify user
    const supabaseAuthClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OpenAI API key from system_api_keys and vault
    const OPENAI_API_KEY = await getOpenAIAPIKey(supabaseServiceClient);
    if (!OPENAI_API_KEY) {
      console.error('[VoiceSynthesize] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'Voice synthesis service not configured. Admin: Please add OpenAI API key in Admin > System API Keys.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: SynthesizeRequest = await req.json();
    const { text, voice = 'alloy', speed = 1.0, model = 'tts-1' } = body;

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate text length (max 4096 characters for OpenAI TTS)
    if (text.length > 4096) {
      return new Response(
        JSON.stringify({ error: 'Text too long. Maximum length is 4096 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate speed
    const clampedSpeed = Math.max(0.25, Math.min(4.0, speed));

    console.log(`[VoiceSynthesize] Synthesizing text (${text.length} chars) for user ${user.id} with voice: ${voice}, speed: ${clampedSpeed}`);

    // Call OpenAI TTS API
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        speed: clampedSpeed,
        response_format: 'mp3' // mp3 is widely supported
      })
    });

    if (!ttsResponse.ok) {
      const errorData = await ttsResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[VoiceSynthesize] OpenAI TTS API error:', errorData);
      
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || `Speech synthesis failed: ${ttsResponse.status}` 
        }),
        { status: ttsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get audio data as blob
    const audioData = await ttsResponse.arrayBuffer();

    if (audioData.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: 'No audio data received from TTS service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VoiceSynthesize] Synthesis successful: ${audioData.byteLength} bytes`);

    // Return audio file
    return new Response(
      audioData,
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioData.byteLength.toString()
        } 
      }
    );

  } catch (error) {
    console.error('[VoiceSynthesize] Error in voice-synthesize function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

