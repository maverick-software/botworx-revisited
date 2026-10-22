/**
 * Invalidate Agent Tool Cache
 * Endpoint to manually clear the tool cache for a specific agent
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Import the FunctionCallingManager (we'll need to access its cache)
// Since we can't directly import from the chat function, we'll implement our own cache invalidation

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { agent_id, user_id } = await req.json();

    if (!agent_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required parameters: agent_id and user_id' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CacheInvalidation] Invalidating tool cache for agent ${agent_id}, user ${user_id}`);

    // Since we can't directly access the FunctionCallingManager's cache from here,
    // we'll use a different approach: call the get-agent-tools function with a 
    // special parameter to force cache refresh
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call get-agent-tools with force_refresh parameter
    const { data: toolsResponse, error } = await supabase.functions.invoke('get-agent-tools', {
      body: { 
        agent_id: agent_id, 
        user_id: user_id,
        force_refresh: true // This will be our signal to bypass cache
      }
    });

    if (error) {
      console.error('[CacheInvalidation] Error calling get-agent-tools:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to refresh tools: ${error.message}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toolCount = toolsResponse?.tools?.length || 0;

    console.log(`[CacheInvalidation] Successfully refreshed tools for agent ${agent_id} (${toolCount} tools)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tool cache invalidated for agent ${agent_id}`,
        tools_count: toolCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CacheInvalidation] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
