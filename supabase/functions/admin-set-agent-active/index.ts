import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-set-agent-active' started.");

// --- Helper Functions (Copied from admin-get-users/admin-set-user-status) ---
// It's recommended to move these to _shared eventually
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
    const { agentId, active } = await req.json(); // active should be boolean

    if (!agentId || typeof active !== 'boolean') {
        return new Response(JSON.stringify({ error: "Bad Request: Missing agentId or invalid active status (must be boolean)" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`Admin ${adminUserId} attempting to set agent ${agentId} active status to ${active}`);

    // --- Perform Update using Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({ active: active })
      .eq('id', agentId);

    if (updateError) {
        console.error(`Error updating active status for agent ${agentId}:`, updateError);
        // Check if error is due to agent not found
        if (updateError.code === 'PGRST116') { // Resource Not Found (might vary slightly)
             return new Response(JSON.stringify({ error: "Agent not found" }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        throw new Error(`Failed to update agent active status: ${updateError.message}`);
    }

    console.log(`Successfully set agent ${agentId} active status to ${active}`);

    // --- End Update ---

    return new Response(JSON.stringify({ message: `Agent active status updated successfully to ${active}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in admin-set-agent-active:", error);
     if (error instanceof SyntaxError) { return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 