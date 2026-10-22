import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'get-worker-status' started.");

// Get Worker Manager URL and Secret from environment variables
const managerUrl = Deno.env.get("MANAGER_URL");
const managerSecretKey = Deno.env.get("MANAGER_SECRET_KEY");

if (!managerUrl || !managerSecretKey) {
    console.error("[get-worker-status] FATAL: MANAGER_URL or MANAGER_SECRET_KEY environment variables not set.");
}

serve(async (req) => {
  // --- START CORS Preflight Handling ---
  if (req.method === 'OPTIONS') {
    console.log("[get-worker-status] Handling OPTIONS request for CORS preflight.");
    return new Response("ok", { headers: corsHeaders });
  }
  // --- END CORS Preflight Handling ---

  try {
    // 1. Create Supabase client with user's auth context (to ensure user is logged in)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    );

    // 2. Get user session (optional but good practice)
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("[get-worker-status] Auth Error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Get agentId from request BODY
    let agentId: string | null = null;
    try {
        const body = await req.json();
        agentId = body.agentId;
    } catch (e) {
        console.error("[get-worker-status] Failed to parse request body:", e);
        return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON body" }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!agentId) {
      console.log("[get-worker-status] Bad Request: Missing agentId in request body.");
      return new Response(JSON.stringify({ error: "Bad Request: Missing agentId in request body" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log(`[get-worker-status] Received request for Agent ID: ${agentId}`);

    // 4. Check Manager URL/Secret availability
    if (!managerUrl || !managerSecretKey) {
        console.error("[get-worker-status] Worker Manager URL or Secret Key not configured in function environment.");
        return new Response(JSON.stringify({ error: "Internal Server Error: Service configuration missing." }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // 5. Call the Worker Manager status endpoint
    const statusUrl = `${managerUrl}/status?agent_id=${encodeURIComponent(agentId)}`;
    console.log(`[get-worker-status] Calling Worker Manager status endpoint: ${statusUrl}`);

    const managerResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${managerSecretKey}` // Authenticate with the manager service
      }
    });

    // 6. Handle Manager Response
    if (!managerResponse.ok) {
      const errorText = await managerResponse.text();
      console.error(`[get-worker-status] Worker Manager service returned error (${managerResponse.status}): ${errorText}`);
      let detail = `Worker Manager status check failed: ${managerResponse.statusText}`;
       try { detail = JSON.parse(errorText).error || detail; } catch(e) {}
      // Return a specific structure indicating failure to get status
      return new Response(JSON.stringify({ error: "Failed to retrieve status from manager", details: detail }), {
        status: 502, // Bad Gateway seems appropriate
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const managerResult = await managerResponse.json();
    console.log("[get-worker-status] Worker Manager status response:", JSON.stringify(managerResult, null, 2));

    // 7. Return the relevant status info to the UI
    return new Response(
      JSON.stringify(managerResult), // Forward the manager's JSON response ({ agentId, status })
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("[get-worker-status] Function Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 