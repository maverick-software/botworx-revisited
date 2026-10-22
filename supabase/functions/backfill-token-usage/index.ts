import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'backfill-token-usage' started.");

// --- Types ---
interface BackfillTokenUsageRequest {
  startDate: string;  // YYYY-MM-DD - Required
  endDate: string;    // YYYY-MM-DD - Required
  batchSize?: number; // Days per batch, Default: 30
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

    // Only admins can trigger backfill
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

    console.log(`[backfill-token-usage] Admin user ${currentUserId} triggered backfill`);

    // --- Parse Request Body ---
    const body: BackfillTokenUsageRequest = await req.json();
    const {
      startDate,
      endDate,
      batchSize = 30
    } = body;

    // --- Validate Required Fields ---
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing required fields: startDate, endDate",
        code: "INVALID_REQUEST"
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Validate Date Range ---
    if (new Date(startDate) > new Date(endDate)) {
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

    const overallStart = Date.now();
    
    const { data, error } = await supabaseAdmin.rpc('backfill_token_usage', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_batch_size: batchSize
    });

    const overallDuration = (Date.now() - overallStart) / 1000; // Convert to seconds

    if (error) {
      console.error("[backfill-token-usage] Database error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to backfill token usage",
        code: "DATABASE_ERROR",
        details: { message: error.message }
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Build Response ---
    const batches = Array.isArray(data) ? data : [];
    
    const summary = {
      totalBatches: batches.length,
      successfulBatches: batches.filter((b: any) => b.status === 'success').length,
      failedBatches: batches.filter((b: any) => b.status !== 'success').length,
      totalUsersProcessed: batches.reduce((sum: number, b: any) => sum + (b.users_processed || 0), 0),
      totalRecordsCreated: batches.reduce((sum: number, b: any) => sum + (b.records_created || 0), 0),
      totalRecordsUpdated: batches.reduce((sum: number, b: any) => sum + (b.records_updated || 0), 0),
      totalDurationSeconds: overallDuration,
      dateRange: { start: startDate, end: endDate }
    };

    const response = {
      success: true,
      data: {
        batches,
        summary
      }
    };

    console.log(`[backfill-token-usage] Backfill complete:`, summary);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[backfill-token-usage] Error:", error);
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

