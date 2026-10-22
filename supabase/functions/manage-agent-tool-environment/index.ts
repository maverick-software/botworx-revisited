import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/database.types.ts';

const NODE_BACKEND_URL = Deno.env.get('NODE_BACKEND_URL'); // e.g., http://localhost:8080 or your deployed backend service URL
const INTERNAL_API_SECRET = Deno.env.get('INTERNAL_API_SECRET');

async function callInternalNodeService(agentId: string, method: 'POST' | 'DELETE') {
  if (!NODE_BACKEND_URL || !INTERNAL_API_SECRET) {
    console.error('NODE_BACKEND_URL or INTERNAL_API_SECRET is not configured.');
    return { success: false, error: 'Internal service communication not configured.', status: 500 };
  }

  const internalEndpoint = method === 'POST' 
    ? `${NODE_BACKEND_URL}/internal/agents/${agentId}/ensure-tool-environment` 
    : `${NODE_BACKEND_URL}/internal/agents/${agentId}/tool-environment`;

  try {
    const response = await fetch(internalEndpoint, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Api-Secret': INTERNAL_API_SECRET,
      },
    });

    const responseData: any = await response.json();

    if (!response.ok) {
      console.error(`Internal service call failed (${method} ${internalEndpoint}): ${response.status}`, responseData);
      return { success: false, error: responseData.error || 'Internal service error', status: response.status };
    }
    return { success: true, data: responseData, status: response.status };
  } catch (error: any) {
    console.error(`Error calling internal service (${method} ${internalEndpoint}):`, error);
    return { success: false, error: error.message || 'Failed to communicate with internal service', status: 500 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseClientAuth = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user }, error: userError } = await supabaseClientAuth.auth.getUser();

  if (userError || !user) {
    console.error('User auth error:', userError);
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const agentId = pathParts[pathParts.length - 1];

  if (!agentId || agentId === 'manage-agent-tool-environment') {
    return new Response(JSON.stringify({ error: 'Agent ID is missing in the path' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }

  const supabaseAdminForCheck = createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: agentData, error: agentFetchError } = await supabaseAdminForCheck
    .from('agents')
    .select('id, user_id')
    .eq('id', agentId)
    .single();

  if (agentFetchError) {
    console.error(`Error fetching agent ${agentId} for authorization:`, agentFetchError);
    return new Response(JSON.stringify({ error: 'Failed to verify agent ownership.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }

  if (!agentData) {
    return new Response(JSON.stringify({ error: 'Agent not found.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
  }

  if (agentData.user_id !== user.id) {
    console.warn(`User ${user.id} attempt to manage agent ${agentId} owned by ${agentData.user_id}. Forbidden.`);
    return new Response(JSON.stringify({ error: 'Forbidden. You do not own this agent.' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  console.log(`User ${user.id} authorized to manage tool environment for agent ${agentId}`);

  try {
    let result;
    if (req.method === 'POST') {
      console.log(`Calling internal service to ensure tool environment for agent ${agentId}`);
      result = await callInternalNodeService(agentId, 'POST');
    } else if (req.method === 'DELETE') {
      console.log(`Calling internal service to deprovision tool environment for agent ${agentId}`);
      result = await callInternalNodeService(agentId, 'DELETE');
    } else {
      return new Response(JSON.stringify({ error: 'Method not supported' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result.success ? result.data : { error: result.error }), {
      status: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in manage-agent-tool-environment function:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 