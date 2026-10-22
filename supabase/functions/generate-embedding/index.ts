// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import OpenAI from 'npm:openai@4.28.0'; // Use specific npm version
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust for production if needed
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize OpenAI client
let openai: OpenAI;
try {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set.');
  }
  openai = new OpenAI({ apiKey });
  console.log("OpenAI client initialized successfully.");
} catch (error) {
  console.error("Failed to initialize OpenAI client:", error.message);
  // Optionally, handle this more gracefully, e.g., by returning an error response later
}

// Initialize Supabase client (optional, only if needed to update DB directly)
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

interface EmbeddingRequest {
  content: string;
  // Optional: Add messageId if you want to update the DB record here
  // messageId?: string; 
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if OpenAI client is initialized
  if (!openai) {
    return new Response(JSON.stringify({ error: 'OpenAI client not initialized. Check API key secret.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const requestBody: EmbeddingRequest = await req.json();
    const { content } = requestBody;

    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid \'content\' field in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating embedding for content: "${content.substring(0, 50)}..."`);

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Recommended model
      input: content,
      encoding_format: 'float',
    });

    if (!embeddingResponse.data || embeddingResponse.data.length === 0) {
        throw new Error('OpenAI embedding response was empty.');
    }

    const embedding = embeddingResponse.data[0].embedding;

    console.log(`Successfully generated embedding (dimensions: ${embedding.length}).`);

    // --- Optional: Update chat_messages table --- 
    // If you pass messageId in the request, you can update the record directly:
    // if (messageId) {
    //   const { error: updateError } = await supabaseClient
    //     .from('chat_messages')
    //     .update({ embedding })
    //     .eq('id', messageId);
    //   if (updateError) {
    //     console.error('Error updating message embedding in DB:', updateError);
    //     // Decide how to handle DB update failure - maybe still return embedding?
    //   }
    // }
    // ---------------------------------------------

    return new Response(JSON.stringify({ embedding }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing embedding request:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

/* 
Test with curl:

curl -X POST 'http://localhost:<SUPABASE_PORT>/functions/v1/generate-embedding' \
-H 'Authorization: Bearer <YOUR_SUPABASE_SERVICE_ROLE_KEY>' \
-H 'Content-Type: application/json' \
-d '{"content": "This is a test message."}'

*/
