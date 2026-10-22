import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-force-stop-worker' started.");

// --- Helper Functions (Copied from admin-get-users/admin-set-user-status) ---
async function getUserIdFromRequest(req: Request, supabaseClient: SupabaseClient): Promise<string | null> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  return userError ? null : user?.id ?? null;
}

async function checkAdminRole(userId: string, supabaseClient: SupabaseClient): Promise<boolean> {
   if (!userId) return false;
   const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('user_has_role', {
        user_id: userId,
        role_name: 'admin'
    });
    if (rpcError) {
        console.error("RPC Error checking admin role:", rpcError);
        return false;
    }
    return isAdmin ?? false;
}
// --- End Helper Functions ---

// --- Main Handler ---
serve(async (req) => {
  // Handle CORS preflight & check method is POST
  if (req.method === 'OPTIONS') { return new Response("ok", { headers: corsHeaders }); }
  if (req.method !== 'POST') { return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!, 
        Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    const adminUserId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(adminUserId!, supabaseClient);
    if (!isAdmin) { return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    // --- Get Data from Request Body ---
    const { agentId } = await req.json();
    if (!agentId) {
        return new Response(JSON.stringify({ error: "Bad Request: Missing agentId" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`Admin ${adminUserId} attempting to force stop worker for agent ${agentId}`);

    // --- Get Connection ID using Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from('agent_discord_connections')
      .select('id') // We only need the connection ID
      .eq('agent_id', agentId)
      .maybeSingle(); // Expect zero or one connection

    if (connectionError) {
        console.error(`Error fetching connection for agent ${agentId}:`, connectionError);
        throw new Error(`Database error checking for agent connection: ${connectionError.message}`);
    }

    if (!connection?.id) {
         console.log(`No active connection found for agent ${agentId}. Worker might already be stopped or never started.`);
         // Consider returning success or a specific message indicating nothing to stop
         return new Response(JSON.stringify({ message: "No active worker connection found for this agent to stop." }), {
            status: 200, // Or maybe 404 if agent exists but connection doesn't? 200 seems okay.
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const connectionDbId = connection.id;
    console.log(`Found connection ID ${connectionDbId} for agent ${agentId}. Invoking stop action...`);

    // --- Invoke manage-discord-worker function ---
    // Use the regular client (with user's auth) to invoke the function,
    // as manage-discord-worker might perform its own checks or use user context.
    // Alternatively, could call it with admin client if needed/designed that way.
    const { error: invokeError } = await supabaseClient.functions.invoke('manage-discord-worker', {
        body: { action: 'stop', agentId: agentId, connectionDbId: connectionDbId }
    });

    if (invokeError) {
        console.error(`Error invoking manage-discord-worker for agent ${agentId}:`, invokeError);
        // Provide more specific feedback if possible
        let errorMessage = `Failed to invoke worker stop function: ${invokeError.message}`;
        if (invokeError.message.includes('Function not found')) {
            errorMessage = "Internal Error: The 'manage-discord-worker' function could not be found.";
        } else if (invokeError instanceof Error && 'context' in invokeError && (invokeError as any).context?.status === 500) {
             // Check if manage-discord-worker itself returned an error
             try {
                 const functionError = JSON.parse((invokeError as any).context.responseText || '{}');
                 errorMessage = `Worker stop function failed: ${functionError.error || invokeError.message}`;
             } catch (e) { /* Ignore parsing error */ }
        }
        throw new Error(errorMessage);
    }

    console.log(`Successfully invoked stop action for agent ${agentId}, connection ${connectionDbId}`);

    // --- End Update ---

    return new Response(JSON.stringify({ message: "Worker stop request sent successfully." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Accepted the request, actual stopping is async
    });

  } catch (error) {
    console.error("Error in admin-force-stop-worker:", error);
     if (error instanceof SyntaxError) { return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 