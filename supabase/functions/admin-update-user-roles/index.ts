import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-update-user-roles' started.");

// --- Helper Functions (reuse or import from _shared) ---
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    const adminUserId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(adminUserId!, supabaseClient);

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Get Data from Request Body ---
    const { userIdToUpdate, roleIds } = await req.json();

    if (!userIdToUpdate || !Array.isArray(roleIds)) {
        return new Response(JSON.stringify({ error: "Bad Request: Missing userIdToUpdate or roleIds array" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
     // Basic validation for UUID format (simple regex)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userIdToUpdate) || !roleIds.every(id => typeof id === 'string' && uuidRegex.test(id))) {
         return new Response(JSON.stringify({ error: "Bad Request: Invalid UUID format provided" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`Admin ${adminUserId} attempting to update roles for user ${userIdToUpdate} to [${roleIds.join(', ')}]`);

    // --- Perform Update in Transaction ---
    // Use Admin client for direct table modification
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create function to run in transaction
    const updateRolesTransaction = async (txClient: SupabaseClient) => {
        // 1. Delete existing roles for the user
        const { error: deleteError } = await txClient
            .from('user_roles')
            .delete()
            .eq('user_id', userIdToUpdate);

        if (deleteError) throw deleteError;

        // 2. Insert new roles if any roles were provided
        if (roleIds.length > 0) {
            const newRolesData = roleIds.map(roleId => ({
                user_id: userIdToUpdate,
                role_id: roleId
            }));
            const { error: insertError } = await txClient
                .from('user_roles')
                .insert(newRolesData);

            if (insertError) throw insertError;
        }
        console.log(`Successfully updated roles for user ${userIdToUpdate}`);
    };

    // Execute the transaction using rpc (assuming you have a generic tx wrapper or handle it directly)
    // Supabase doesn't directly expose JS transactions easily in Edge Functions yet.
    // A common workaround is a PL/pgSQL function, or performing steps sequentially and hoping for the best (less safe).
    // Let's try sequential steps for now, but acknowledge a transaction function is better.

    // --- Perform Update Sequentially (Less Safe - Use DB Transaction Function Ideally) ---
    // 1. Delete existing roles
     const { error: deleteError } = await supabaseAdmin
         .from('user_roles')
         .delete()
         .eq('user_id', userIdToUpdate);

     if (deleteError) {
         console.error(`Error deleting roles for user ${userIdToUpdate}:`, deleteError);
         throw new Error(`Failed to delete existing roles: ${deleteError.message}`);
     }
     console.log(`Deleted existing roles for user ${userIdToUpdate}`);

    // 2. Insert new roles if any
     if (roleIds.length > 0) {
         const newRolesData = roleIds.map(roleId => ({
             user_id: userIdToUpdate,
             role_id: roleId
         }));
         const { error: insertError } = await supabaseAdmin
             .from('user_roles')
             .insert(newRolesData);

         if (insertError) {
             // Uh oh, delete succeeded but insert failed. DB state is inconsistent.
             console.error(`Error inserting new roles for user ${userIdToUpdate}:`, insertError);
             // Ideally, we'd roll back the delete here if in a transaction.
             throw new Error(`Failed to insert new roles after deleting old ones: ${insertError.message}`);
         }
         console.log(`Inserted new roles for user ${userIdToUpdate}`);
     }

    // --- End Update ---

    return new Response(JSON.stringify({ message: "User roles updated successfully" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in admin-update-user-roles:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 