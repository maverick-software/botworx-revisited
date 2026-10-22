import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-set-user-status' started.");

// --- Helper Functions ---
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

// --- Main Handler ---
serve(async (req) => {
  // Handle CORS preflight & check method is POST
  if (req.method === 'OPTIONS') { return new Response("ok", { headers: corsHeaders }); }
  if (req.method !== 'POST') { return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    const adminUserId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(adminUserId!, supabaseClient);
    if (!isAdmin) { return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    // --- Get Data from Request Body ---
    const { userIdToUpdate, action } = await req.json();

    if (!userIdToUpdate || (action !== 'suspend' && action !== 'reactivate')) {
        return new Response(JSON.stringify({ error: "Bad Request: Missing userIdToUpdate or invalid action" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Prevent admin from suspending themselves
    if (userIdToUpdate === adminUserId && action === 'suspend') {
         return new Response(JSON.stringify({ error: "Bad Request: Cannot suspend your own account" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`Admin ${adminUserId} attempting to ${action} user ${userIdToUpdate}`);

    // --- Perform Update using RPC functions ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rpcFunction = action === 'suspend' ? 'admin_suspend_user' : 'admin_reactivate_user';
    const { data: success, error: updateError } = await supabaseAdmin.rpc(rpcFunction, {
        target_user_id: userIdToUpdate
    });

    if (updateError) {
        console.error(`Error ${action}ing user ${userIdToUpdate}:`, updateError);
        throw new Error(`Failed to ${action} user: ${updateError.message}`);
    }

    if (!success) {
        console.error(`User ${userIdToUpdate} not found or update failed`);
        return new Response(JSON.stringify({ error: "User not found" }), {
           headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404
       });
    }

    console.log(`Successfully ${action}ed user ${userIdToUpdate}`);

    return new Response(JSON.stringify({ message: `User ${action}ed successfully` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in admin-set-user-status:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
