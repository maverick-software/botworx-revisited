// Supabase Edge Function: refresh-mcp-schemas-cron
// Purpose: Periodic (cron) job to refresh stale MCP tool schemas
// Triggered: Automatically via Supabase cron (daily) or manually
// Author: Agentopia
// Date: October 3, 2025

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface RefreshResult {
  connection_id: string;
  connection_name: string;
  success: boolean;
  tool_count?: number;
  error?: string;
}

Deno.serve(async (req) => {
  console.log(`[MCP Schema Cron] Starting periodic schema refresh check`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify this is a cron request or service role request
    const authHeader = req.headers.get('Authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    
    // Allow if: 1) Valid cron secret, 2) Service role key, or 3) Manual trigger with proper auth
    const isCronRequest = req.headers.get('x-supabase-cron') === 'true'
    const hasValidSecret = cronSecret && authHeader?.includes(cronSecret)
    const hasServiceRole = authHeader?.includes(supabaseServiceKey)
    
    if (!isCronRequest && !hasValidSecret && !hasServiceRole) {
      console.warn(`[MCP Schema Cron] Unauthorized request`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized: This endpoint is for automated cron jobs or service role only' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[MCP Schema Cron] Authorized request - isCron: ${isCronRequest}`)

    // Get all connections needing refresh
    const { data: connectionsToRefresh, error: fetchError } = await supabase
      .rpc('get_mcp_connections_needing_refresh')

    if (fetchError) {
      console.error(`[MCP Schema Cron] Error fetching connections:`, fetchError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to fetch connections: ${fetchError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!connectionsToRefresh || connectionsToRefresh.length === 0) {
      console.log(`[MCP Schema Cron] ✅ No connections need refresh - all schemas are fresh`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No connections need refresh',
          connections_checked: 0,
          connections_refreshed: 0
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[MCP Schema Cron] Found ${connectionsToRefresh.length} connections needing refresh`)
    
    // Refresh each connection
    const results: RefreshResult[] = []
    let successCount = 0
    let failureCount = 0

    for (const conn of connectionsToRefresh) {
      console.log(`[MCP Schema Cron] Refreshing ${conn.connection_name} (${conn.connection_id}) - ${conn.days_old} days old, ${conn.tool_count} tools`)
      
      try {
        const { data: refreshData, error: refreshError } = await supabase.functions.invoke(
          'refresh-mcp-tools',
          {
            body: { connectionId: conn.connection_id }
          }
        )

        if (refreshError) {
          console.error(`[MCP Schema Cron] Failed to refresh ${conn.connection_name}:`, refreshError)
          results.push({
            connection_id: conn.connection_id,
            connection_name: conn.connection_name,
            success: false,
            error: refreshError.message
          })
          failureCount++
        } else if (!refreshData.success) {
          console.error(`[MCP Schema Cron] Refresh returned failure for ${conn.connection_name}:`, refreshData.error)
          results.push({
            connection_id: conn.connection_id,
            connection_name: conn.connection_name,
            success: false,
            error: refreshData.error
          })
          failureCount++
        } else {
          console.log(`[MCP Schema Cron] ✅ Successfully refreshed ${conn.connection_name}: ${refreshData.toolCount} tools`)
          results.push({
            connection_id: conn.connection_id,
            connection_name: conn.connection_name,
            success: true,
            tool_count: refreshData.toolCount
          })
          successCount++
        }
      } catch (error) {
        console.error(`[MCP Schema Cron] Exception refreshing ${conn.connection_name}:`, error)
        results.push({
          connection_id: conn.connection_id,
          connection_name: conn.connection_name,
          success: false,
          error: error.message
        })
        failureCount++
      }

      // Add a small delay between refreshes to avoid overwhelming MCP servers
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`[MCP Schema Cron] Refresh complete: ${successCount} succeeded, ${failureCount} failed`)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Refreshed ${successCount}/${connectionsToRefresh.length} connections`,
        connections_checked: connectionsToRefresh.length,
        connections_refreshed: successCount,
        connections_failed: failureCount,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error(`[MCP Schema Cron] Fatal error:`, error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

