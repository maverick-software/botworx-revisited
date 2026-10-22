/**
 * Voice Transcription Edge Function
 * 
 * Handles audio transcription using OpenAI's Whisper API.
 * Accepts audio file and returns transcribed text.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface TranscriptionResponse {
  text: string;
  confidence?: number;
  duration?: number;
  language?: string;
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
      console.warn('[VoiceTranscribe] No system API key found for OpenAI');
      return null;
    }

    // Decrypt from vault using get_secret function
    const { data: secretData, error: vaultError } = await supabase
      .rpc('get_secret', { secret_id: systemKey.vault_secret_id });

    if (vaultError || !secretData || secretData.length === 0) {
      console.error('[VoiceTranscribe] Failed to decrypt OpenAI key:', vaultError);
      return null;
    }

    // get_secret returns an array with one row containing {key: "secret"}
    return secretData[0]?.key || null;
  } catch (err) {
    console.error('[VoiceTranscribe] Error fetching system API key for OpenAI:', err);
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
      console.error('[VoiceTranscribe] OpenAI API key not configured');
      return new Response(
        JSON.stringify({ error: 'Voice transcription service not configured. Admin: Please add OpenAI API key in Admin > System API Keys.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the audio file from the request
    const formData = await req.formData();
    const audioFile = formData.get('file') as File;
    
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size (max 25MB for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large. Maximum size is 25MB.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcribing audio file: ${audioFile.name} (${audioFile.size} bytes) for user ${user.id}`);

    // Prepare form data for Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('response_format', 'verbose_json'); // Get detailed response with timestamps

    // Optional: Add language hint if provided
    const language = formData.get('language') as string;
    if (language) {
      whisperFormData.append('language', language);
    }

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Whisper API error:', errorData);
      
      return new Response(
        JSON.stringify({ 
          error: errorData.error?.message || `Transcription failed: ${whisperResponse.status}` 
        }),
        { status: whisperResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await whisperResponse.json();
    
    // Extract relevant information
    const response: TranscriptionResponse = {
      text: result.text?.trim() || '',
      language: result.language,
      duration: result.duration,
    };

    // Whisper API doesn't provide confidence in verbose_json, but we can estimate based on other factors
    // If there are segments, we could calculate average confidence if available
    if (result.segments && Array.isArray(result.segments)) {
      const totalConfidence = result.segments.reduce((sum: number, seg: any) => {
        return sum + (seg.confidence || 1.0);
      }, 0);
      response.confidence = totalConfidence / result.segments.length;
    }

    if (!response.text) {
      return new Response(
        JSON.stringify({ error: 'No speech detected in audio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Transcription successful: "${response.text.substring(0, 50)}..." (${response.text.length} chars)`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in voice-transcribe function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

