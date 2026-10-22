import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'get-user-token-usage' started.");

// --- Types ---
interface GetUserTokenUsageRequest {
  userId?: string;
  startDate?: string;
  endDate?: string;
  periodType?: 'daily' | 'weekly' | 'monthly' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'period_start' | 'total_tokens' | 'message_count';
  sortOrder?: 'asc' | 'desc';
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
    // --- Auth Check ---
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

    // --- Parse Request Body ---
    const body: GetUserTokenUsageRequest = await req.json();
    const {
      userId: requestedUserId,
      startDate,
      endDate,
      periodType = 'daily',
      limit = 30,
      offset = 0,
      sortBy = 'period_start',
      sortOrder = 'desc'
    } = body;

    // Default to current user if no userId specified
    const targetUserId = requestedUserId || currentUserId;

    // --- Authorization Check ---
    // Users can view their own data, admins can view anyone's
    if (targetUserId !== currentUserId) {
      const isAdmin = await checkAdminRole(currentUserId, supabaseClient);
      if (!isAdmin) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "You are not authorized to view token usage for this user",
          code: "FORBIDDEN"
        }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`[get-user-token-usage] User ${currentUserId} fetching usage for ${targetUserId}`);

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

    // --- Build Query ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabaseAdmin
      .from('user_token_usage')
      .select('*', { count: 'exact' })
      .eq('user_id', targetUserId);

    // Apply filters
    if (periodType !== 'all') {
      query = query.eq('period_type', periodType);
    }

    if (startDate) {
      query = query.gte('period_start', startDate);
    }

    if (endDate) {
      query = query.lte('period_start', endDate);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // --- Execute Query ---
    const { data: usageRecords, error: queryError, count } = await query;

    if (queryError) {
      console.error("[get-user-token-usage] Database error:", queryError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to fetch token usage data",
        code: "DATABASE_ERROR",
        details: { message: queryError.message }
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- Calculate Summary ---
    const summary = {
      totalTokens: usageRecords?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0,
      totalPromptTokens: usageRecords?.reduce((sum, r) => sum + (r.total_prompt_tokens || 0), 0) || 0,
      totalCompletionTokens: usageRecords?.reduce((sum, r) => sum + (r.total_completion_tokens || 0), 0) || 0,
      totalMessages: usageRecords?.reduce((sum, r) => sum + (r.message_count || 0), 0) || 0,
      totalConversations: usageRecords?.reduce((sum, r) => sum + (r.conversation_count || 0), 0) || 0,
      uniqueAgents: new Set(usageRecords?.flatMap(r => r.agent_ids || [])).size,
      dateRange: {
        start: usageRecords?.[usageRecords.length - 1]?.period_start || startDate || '',
        end: usageRecords?.[0]?.period_start || endDate || ''
      },
      avgTokensPerDay: usageRecords?.length ? Math.round((usageRecords.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0) / usageRecords.length) : 0,
      avgTokensPerMessage: usageRecords?.reduce((sum, r) => sum + (r.message_count || 0), 0) > 0
        ? Math.round((usageRecords.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0) / (usageRecords.reduce((sum, r) => sum + (r.message_count || 0), 0) || 1))
        : 0
    };

    // --- Build Response ---
    const response = {
      success: true,
      data: {
        usage: usageRecords || [],
        summary,
        pagination: {
          limit,
          offset,
          total: count || 0,
          hasMore: (offset + limit) < (count || 0)
        }
      }
    };

    console.log(`[get-user-token-usage] Returning ${usageRecords?.length || 0} records`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[get-user-token-usage] Error:", error);
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

