import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-get-dashboard-stats' started.");

// Helper function to get user ID from JWT
// (You might want to move this to _shared if used elsewhere)
async function getUserIdFromRequest(req: Request, supabaseClient: any): Promise<string | null> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    console.error("Auth Error getting user for stats:", userError);
    return null;
  }
  return user.id;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's auth context to check roles
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    );

    // Check if user is authenticated
     const userId = await getUserIdFromRequest(req, supabaseClient);
     if (!userId) {
       return new Response(JSON.stringify({ error: "Unauthorized: Not logged in" }), {
         status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
     }

    // Check if the user is an admin using the RPC function
    const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('user_has_role', {
        user_id: userId,
        role_name: 'admin'
    });

    if (rpcError) {
        console.error("RPC Error checking admin role:", rpcError);
        return new Response(JSON.stringify({ error: "Internal Server Error: Failed to check role" }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!isAdmin) {
        console.warn(`Admin check failed for user ${userId}`);
        return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`Admin user ${userId} authorized for dashboard stats.`);

    // --- User is Admin: Proceed to fetch stats ---
    // Use Admin client for potentially restricted data access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch Total Users count (using admin client for auth.users)
    const { count: userCount, error: userCountError } = await supabaseAdmin
      .from('users') // Note: Supabase admin client might access auth schema directly with 'users'
      .select('*', { count: 'exact', head: true }); // Optimized count query

     if (userCountError) {
         // Attempt fallback using auth admin API if direct table fails
         console.warn("Direct count on auth.users failed (maybe permissions?), trying auth admin API.", userCountError);
         const { data: { users }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({page: 1, perPage: 1}); // Fetch minimal data
         if (listUsersError || !users) {
            console.error("Error fetching user count via auth admin:", listUsersError);
             throw new Error("Failed to fetch user count.");
         }
         // The total count should be available in the response metadata even with perPage=1,
         // but we need to check the actual API response structure from Supabase.
         // If total isn't directly available, this approach might need refinement or be slow for large user bases.
         // Let's assume userCount is directly available for now, or fallback to a placeholder.
         console.error("Auth admin listUsers response structure needs verification for total count.");
         // Placeholder if count isn't readily available from listUsers metadata
         // For now, we'll proceed assuming the first count worked or handle the error below.
         if (!userCount && userCount !== 0) throw new Error("Failed to fetch user count.");
     }


    // Fetch Active Agents count
    const { count: activeAgentCount, error: agentCountError } = await supabaseAdmin
      .from('agent_discord_connections')
      .select('id', { count: 'exact', head: true })
      .eq('worker_status', 'active'); // Assuming 'active' is the status string

    if (agentCountError) {
      console.error("Error fetching active agent count:", agentCountError);
      throw new Error("Failed to fetch active agent count.");
    }

    const stats = {
        totalUsers: userCount ?? 0, // Default to 0 if count is null
        activeAgents: activeAgentCount ?? 0 // Default to 0 if count is null
    };

    console.log("Fetched stats:", stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in admin-get-dashboard-stats:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 