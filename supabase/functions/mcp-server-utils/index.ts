// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { MCPServerConfig } from './types.ts'; // Changed path to local
import { MCPClient } from './client.ts'; // Changed path to local

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const logPrefix = '[mcp-server-utils]';
console.log(`${logPrefix} Function instance started.`);

serve(async (req) => {
  const requestUrl = new URL(req.url);
  console.log(`${logPrefix} Received request: ${req.method} ${requestUrl.pathname}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`${logPrefix} Responding to OPTIONS request.`);
    return new Response(null, { headers: corsHeaders });
  }

  // Handle POST requests
  if (req.method === 'POST') {
    let action = 'test'; // Default action
    try {
        if (requestUrl.pathname.endsWith('/discover')) {
            action = 'discover';
        } else if (requestUrl.pathname.endsWith('/test')) {
             action = 'test';
        }
        console.log(`${logPrefix} Determined action: ${action}`);

      const body = await req.json();
      console.log(`${logPrefix} Request body parsed.`);
      // Avoid logging the body directly if it might contain sensitive info like API keys

      // Expecting a cleaned serverConfig (no vault_id or api_key)
      const serverConfig = body.serverConfig as Partial<MCPServerConfig>;

      if (!serverConfig || !serverConfig.endpoint_url) {
        console.error(`${logPrefix} Invalid request body: Missing serverConfig or endpoint_url.`);
        throw new Error('Missing serverConfig or endpoint_url in request body');
      }

       console.log(`${logPrefix} Processing ${action} request for endpoint: ${serverConfig.endpoint_url} (Config Name: ${serverConfig.name || 'N/A'})`);

      // Create config for MCPClient, setting api_key explicitly to null
      const configForClient: MCPServerConfig & { api_key?: string | null } = {
        id: serverConfig.id || 0,
        config_id: serverConfig.config_id || 0,
        name: serverConfig.name || 'TestClient',
        endpoint_url: serverConfig.endpoint_url,
        vault_api_key_id: null, // Not used/sent by frontend for test/discover
        timeout_ms: serverConfig.timeout_ms || 5000,
        max_retries: serverConfig.max_retries ?? 1, // Default to 1 retry for util
        retry_backoff_ms: serverConfig.retry_backoff_ms || 1000,
        priority: serverConfig.priority || 0,
        is_active: true,
        api_key: null, // Explicitly null - attempt connection without key
      };

      console.log(`${logPrefix} Initializing MCPClient for ${action} (without API key)...`);
      const client = new MCPClient(configForClient);

      let result;
      if (action === 'discover') {
          console.log(`${logPrefix} Executing discovery action...`);
          try {
              const capabilities = await client.connect(); // connect performs discovery
              client.disconnect(); // Disconnect immediately after discovery
              result = { success: true, capabilities: capabilities, message: 'Discovery successful.' };
              console.log(`${logPrefix} Discovery successful for ${serverConfig.endpoint_url}`);
          } catch(err) {
               console.error(`${logPrefix} Discovery failed for ${serverConfig.endpoint_url}:`, err);
               client.disconnect(); // Ensure disconnected on error
               result = { success: false, capabilities: null, message: `Discovery failed: ${err.message}` };
          }
      } else { // Default is 'test'
          console.log(`${logPrefix} Executing test connection action (without API key)...`);
          result = await client.testConnection();
          console.log(`${logPrefix} Test connection completed for ${serverConfig.endpoint_url}. Success: ${result.success}`);
          if (!result.success && result.message.includes('MCPHandshakeError')) {
            // Add a hint if handshake fails, suggesting a key might be required
            result.message += " (Server might require an API key for handshake)";
          }
      }

      console.log(`${logPrefix} Sending ${action} result back to client.`);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error(`${logPrefix} Error processing ${action} request:`, error);
      let status = 500;
      if (error instanceof SyntaxError) {
          console.error(`${logPrefix} JSON parsing error.`);
          status = 400;
      } else if (error.message.includes('Missing serverConfig')) {
          status = 400;
      }
      return new Response(JSON.stringify({ error: error.message || 'An internal error occurred' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: status,
      });
    }
  }

  // Handle other methods
  console.warn(`${logPrefix} Received unsupported method: ${req.method}`);
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 405,
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/mcp-server-utils' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
