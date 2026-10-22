import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Database } from '../_shared/database.types.ts' // Assuming types are in _shared

console.log('Heartbeat function starting...');

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Restrict in production!
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to create Supabase admin client (move to _shared if used by multiple functions)
function getSupabaseAdminClient(req: Request): SupabaseClient<Database> {
  // Deno imports from esm.sh may not have process.env directly
  // Supabase Edge Functions have access to environment variables set in the dashboard
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or Service Role Key not defined for admin client in Edge Function.');
    // In a real scenario, you might throw or handle this more gracefully
    // For now, to allow compilation, returning a dummy client or throwing
    throw new Error('Supabase credentials not configured for Edge Function.');
  }

  // Note: In Deno, ensure you have appropriate headers for the admin client
  // if your RLS policies depend on them, though service_role bypasses RLS.
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } },
    auth: {
      persistSession: false, // No session persistence for backend operations
      autoRefreshToken: false, // No need to auto-refresh token
      detectSessionInUrl: false // Not relevant for server-to-server
    }
  });
}

serve(async (req) => {
  console.log('Heartbeat request received:', req.method, req.url);

  // Handle OPTIONS pre-flight request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }

  // 1. Extract Bearer token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('Heartbeat: Missing or invalid Authorization header.');
    return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }
  const dtmaAuthToken = authHeader.substring(7); // Remove "Bearer "

  let requestPayload;
  try {
    requestPayload = await req.json();
    console.log('Heartbeat payload:', requestPayload);
  } catch (e) {
    console.error('Heartbeat: Invalid JSON payload:', e.message);
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }

  // Extract expected fields from payload (add validation as needed)
  const { dtma_version, system_status, tool_statuses } = requestPayload as {
    dtma_version?: string;
    system_status?: Record<string, unknown>; // JSONB from DTMA
    tool_statuses?: Array<{ // Array of statuses for each tool instance
      account_tool_instance_id: string; // PK of account_tool_instances
      instance_name_on_toolbox?: string; // For logging/reference
      status_on_toolbox: Database['public']['Enums']['account_tool_installation_status_enum']; // ENUM
      runtime_details?: Record<string, unknown>; // JSONB
    }>;
  };

  try {
    const supabaseAdmin = getSupabaseAdminClient(req);

    // 2. Find account_tool_environments record by dtma_bearer_token (Refactored)
    const { data: toolboxData, error: fetchToolboxError } = await supabaseAdmin
      .from('account_tool_environments')
      .select('id, status') // Select fields needed for update logic
      .eq('dtma_bearer_token', dtmaAuthToken)
      .single();

    if (fetchToolboxError || !toolboxData) {
      console.error('Heartbeat: Error fetching toolbox or token not found:', fetchToolboxError?.message);
      const status = fetchToolboxError?.code === 'PGRST116' ? 401 : 500;
      const message = fetchToolboxError?.code === 'PGRST116' ? 'Unauthorized: Invalid token' : 'Internal server error: Could not verify token';
      return new Response(JSON.stringify({ error: message }), {
        status: status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Update the account_tool_environments record (Refactored)
    const toolboxUpdates: Partial<Database['public']['Tables']['account_tool_environments']['Update']> = {
      last_heartbeat_at: new Date().toISOString(),
      dtma_last_known_version: dtma_version,
      dtma_health_details_json: system_status as any, // Store system_status here
    };

    // WBS 2.3.1, Point 4: Update status if was provisioning or awaiting_heartbeat
    if (toolboxData.status === 'provisioning' || toolboxData.status === 'awaiting_heartbeat') {
      toolboxUpdates.status = 'active';
    }

    const { error: updateToolboxError } = await supabaseAdmin
      .from('account_tool_environments')
      .update(toolboxUpdates)
      .eq('id', toolboxData.id);

    if (updateToolboxError) {
      console.error('Heartbeat: Error updating toolbox record:', updateToolboxError.message);
      return new Response(JSON.stringify({ error: 'Internal server error: Failed to update toolbox status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // WBS 2.3.1, Point 3: Process tool_statuses to update account_tool_instances (New Logic)
    if (tool_statuses && Array.isArray(tool_statuses)) {
      const toolInstanceUpdatePromises = tool_statuses.map(async (toolStatus) => {
        if (!toolStatus.account_tool_instance_id) {
          console.warn('Heartbeat: Skipping tool status update due to missing account_tool_instance_id:', toolStatus);
          return;
        }
        const instanceUpdates: Partial<Database['public']['Tables']['account_tool_instances']['Update']> = {
          status_on_toolbox: toolStatus.status_on_toolbox,
          runtime_details: toolStatus.runtime_details as any, // Cast if complex
          last_heartbeat_from_dtma: new Date().toISOString(),
        };
        
        const { error: updateInstanceError } = await supabaseAdmin
          .from('account_tool_instances')
          .update(instanceUpdates)
          .eq('id', toolStatus.account_tool_instance_id);

        if (updateInstanceError) {
          console.error(
            `Heartbeat: Error updating tool instance ${toolStatus.account_tool_instance_id} (Toolbox ID: ${toolboxData.id}):`,
            updateInstanceError.message
          );
          // Decide if this error should fail the whole heartbeat or just be logged. For now, logging.
        } else {
          console.log(`Heartbeat: Successfully updated tool instance ${toolStatus.account_tool_instance_id} for toolbox ${toolboxData.id}`);
        }
      });
      
      // Wait for all tool instance updates to settle
      // Using Promise.allSettled to ensure all attempts are made even if some fail
      const results = await Promise.allSettled(toolInstanceUpdatePromises);
      results.forEach(result => {
        if (result.status === 'rejected') {
          // Already logged within the map function, but could add summary logging here if needed.
          console.warn('Heartbeat: A tool instance update promise was rejected.', result.reason);
        }
      });
    }

    console.log(`Heartbeat successful for toolbox ID: ${toolboxData.id}`);
    return new Response(null, { status: 204, headers: corsHeaders });

  } catch (error) {
    console.error('Heartbeat: Unhandled exception:', error.message, error.stack);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Added CORS
    });
  }
}); 