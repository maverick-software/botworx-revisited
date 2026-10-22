import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

interface RefreshToolsRequest {
  connectionId: string;
}

interface RefreshToolsResponse {
  success: boolean;
  toolCount?: number;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for vault access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { connectionId }: RefreshToolsRequest = await req.json()

    if (!connectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the connection details
    const { data: connection, error: connectionError } = await supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('id', connectionId)
      .single()

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection not found: ${connectionError?.message}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!connection.is_active) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Connection is not active' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the server URL securely using service role
    const { data: serverUrl, error: urlError } = await supabase.rpc('get_mcp_server_url', {
      connection_id: connectionId
    })

    if (urlError || !serverUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to retrieve server URL: ${urlError?.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Test the MCP connection and discover tools
    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2024-11-05'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      })

      // Handle different response formats (JSON or SSE)
      let mcpResponse
      const contentType = response.headers.get('content-type') || ''
      
      if (contentType.includes('text/event-stream')) {
        // Handle Server-Sent Events format (Zapier MCP uses this)
        const responseText = await response.text()
        console.log(`SSE Response received for connection ${connectionId}`)
        
        // Parse SSE format: look for "data: " lines
        const lines = responseText.split('\n')
        let jsonData = ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            jsonData = line.substring(6) // Remove "data: " prefix
            break
          }
        }
        
        if (!jsonData) {
          throw new Error('No data found in SSE response')
        }
        
        try {
          mcpResponse = JSON.parse(jsonData)
        } catch (parseError) {
          throw new Error(`Failed to parse SSE data: ${parseError.message}`)
        }
      } else {
        // Handle regular JSON response
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        mcpResponse = await response.json()
      }
      
      if (mcpResponse.error) {
        throw new Error(`MCP Error: ${mcpResponse.error.message}`)
      }

      const tools = mcpResponse.result?.tools || []
      
      // Deduplicate tools by name (in case MCP server returns duplicates)
      const uniqueTools = Array.from(
        new Map(tools.map((tool: any) => [tool.name, tool])).values()
      )
      
      if (uniqueTools.length !== tools.length) {
        console.log(`[Refresh MCP Tools] Deduplicated ${tools.length} tools to ${uniqueTools.length} unique tools`)
      }
      
      // Clear existing tools for this connection
      const { error: deleteError } = await supabase
        .from('mcp_tools_cache')
        .delete()
        .eq('connection_id', connectionId)
      
      if (deleteError) {
        console.warn('[Refresh MCP Tools] Warning - could not delete existing tools:', deleteError)
        // Continue anyway - we'll use upsert below
      }

      // Insert new tools (use upsert to handle any remaining duplicates)
      if (uniqueTools.length > 0) {
        // Generate schema hash for change detection
        const generateSchemaHash = (schema: any): string => {
          const schemaStr = JSON.stringify(schema, Object.keys(schema).sort())
          // Simple hash function (for better hash, use crypto.subtle.digest)
          let hash = 0
          for (let i = 0; i < schemaStr.length; i++) {
            const char = schemaStr.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32bit integer
          }
          return hash.toString(36)
        }

        const toolsToInsert = uniqueTools.map((tool: any) => {
          const openaiSchema = {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema || {}
          }
          
          return {
            connection_id: connectionId,
            tool_name: tool.name,
            tool_schema: tool,
            openai_schema: openaiSchema,
            schema_hash: generateSchemaHash(openaiSchema),
            schema_version: '1.0.0', // Could extract from tool metadata if available
            last_updated: new Date().toISOString(),
            refresh_count: 1 // Will be incremented on subsequent refreshes
          }
        })

        console.log(`[Refresh MCP Tools] Upserting ${toolsToInsert.length} tools for connection ${connectionId}`)
        console.log(`[Refresh MCP Tools] First tool sample:`, JSON.stringify(toolsToInsert[0], null, 2))

        const { data: insertedTools, error: insertError } = await supabase
          .from('mcp_tools_cache')
          .upsert(toolsToInsert, {
            onConflict: 'connection_id,tool_name',
            ignoreDuplicates: false
          })
          .select()

        if (insertError) {
          console.error('[Refresh MCP Tools] Error caching tools:', insertError)
          console.error('[Refresh MCP Tools] Error details:', JSON.stringify(insertError, null, 2))
          // Return error response instead of silently failing
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to cache tools: ${insertError.message}`,
              toolCount: tools.length 
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        } else {
          console.log(`[Refresh MCP Tools] Successfully cached ${insertedTools?.length || 0} tools`)
        }
      } else {
        console.log(`[Refresh MCP Tools] No tools to cache for connection ${connectionId}`)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          toolCount: uniqueTools.length 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (mcpError: any) {
      console.error('MCP connection error:', mcpError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `MCP connection failed: ${mcpError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error: any) {
    console.error('Refresh tools error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
