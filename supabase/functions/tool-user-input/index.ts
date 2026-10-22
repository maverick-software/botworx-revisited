// Tool User Input Request Handler
// Manages user input collection for tools that require additional context
// File: supabase/functions/tool-user-input/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserInputRequest {
  conversation_id: string;
  agent_id: string;
  user_id: string;
  tool_name: string;
  tool_call_id: string;
  required_fields: any[];
  reason?: string;
}

interface UserInputResponse {
  conversation_id: string;
  tool_call_id: string;
  user_inputs: Record<string, any>;
  provided_at: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    if (action === 'create_request') {
      // Store a user input request
      const request: UserInputRequest = params as UserInputRequest;
      
      const { data, error } = await supabase
        .from('tool_user_input_requests')
        .insert({
          conversation_id: request.conversation_id,
          agent_id: request.agent_id,
          user_id: request.user_id,
          tool_name: request.tool_name,
          tool_call_id: request.tool_call_id,
          required_fields: request.required_fields,
          reason: request.reason,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, request: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'submit_response') {
      // User provides the requested input
      const { tool_call_id, user_inputs } = params;

      // Update the request status
      const { error: updateError } = await supabase
        .from('tool_user_input_requests')
        .update({
          user_inputs,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('tool_call_id', tool_call_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Input received' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_pending') {
      // Get pending requests for a conversation
      const { conversation_id } = params;

      const { data, error } = await supabase
        .from('tool_user_input_requests')
        .select('*')
        .eq('conversation_id', conversation_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, requests: data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_session_values') {
      // Get saved session values (like realm_id) for this conversation
      const { conversation_id } = params;

      const { data, error } = await supabase
        .from('tool_user_input_requests')
        .select('tool_name, user_inputs')
        .eq('conversation_id', conversation_id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build a map of saved session values
      const sessionValues: Record<string, any> = {};
      if (data) {
        for (const record of data) {
          if (record.user_inputs) {
            Object.assign(sessionValues, record.user_inputs);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, session_values: sessionValues }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Tool User Input] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

