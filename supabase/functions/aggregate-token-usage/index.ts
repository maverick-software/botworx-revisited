import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'aggregate-token-usage' started.");

// --- Types ---
interface AggregateTokenUsageRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  force?: boolean;
}

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
      console.warn(`Received non-POST request: ${req.method}`);
       return new Response(JSON.stringify({ 
         success: false, 
         error: "Method Not Allowed",
         code: "INVALID_REQUEST"
       }), {
         status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
  }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    
    const currentUserId = await getUserIdFromRequest(req, supabaseClient);
    if (!currentUserId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Authentication required",
        code: "UNAUTHORIZED"
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only admins can trigger aggregation
    const isAdmin = await checkAdminRole(currentUserId, supabaseClient);
    if (!isAdmin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Admin access required",
        code: "FORBIDDEN"
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[aggregate-token-usage] Admin user ${currentUserId} triggered aggregation`);

    // --- Parse Request Body ---
    const body: AggregateTokenUsageRequest = await req.json().catch(() => ({}));
    const {
      userId,
      startDate,
      endDate,
      force = false
    } = body;

    // --- Validate Date Range ---
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid date range: startDate must be before endDate",
        code: "INVALID_REQUEST",
        details: { startDate, endDate }
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Call Database Function ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const start = Date.now();
    
    const { data, error } = await supabaseAdmin.rpc('aggregate_user_token_usage', {
      p_user_id: userId || null,
      p_start_date: startDate ? new Date(startDate).toISOString() : null,
      p_end_date: endDate ? new Date(endDate).toISOString() : null
    });

    const duration = Date.now() - start;

    if (error) {
      console.error("[aggregate-token-usage] Database error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to aggregate token usage",
        code: "DATABASE_ERROR",
        details: { message: error.message }
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Build Response ---
    // The RPC function returns a single row with: users_processed, records_created, records_updated, total_tokens_aggregated
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
    
    const response = {
      success: true,
      data: {
        usersProcessed: result?.users_processed || 0,
        recordsCreated: result?.records_created || 0,
        recordsUpdated: result?.records_updated || 0,
        totalTokensAggregated: result?.total_tokens_aggregated || 0,
        duration,
        dateRange: {
          start: startDate || new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
          end: endDate || new Date().toISOString().split('T')[0] // Today
        }
      }
    };

    console.log(`[aggregate-token-usage] Aggregation complete:`, response.data);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[aggregate-token-usage] Error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error',
      code: "INTERNAL_ERROR"
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

