import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { detectServerType, getServerTypeMetadata, extractCapabilities, formatServerInfo } from '../_shared/mcp-server-detection.ts'

interface CreateConnectionRequest {
  agentId: string;
  connectionName: string;
  serverUrl: string;
  authConfig?: Record<string, any>;
}

interface CreateConnectionResponse {
  success: boolean;
  connection?: any;
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
    const { agentId, connectionName, serverUrl, authConfig = {} }: CreateConnectionRequest = await req.json()

    if (!agentId || !connectionName || !serverUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent ID, connection name, and server URL are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate URL format
    try {
      new URL(serverUrl)
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid server URL format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Test MCP connection before saving
    let toolCount = 0
    let detectedType: string = 'generic'
    let serverCapabilities: string[] = []
    let serverDisplayName = 'MCP Server'
    let initResult: any = {}
    
    try {
      // Initialize connection
      const initResponse = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: 'Agentopia',
              version: '1.0.0'
            }
          }
        })
      })

      // For initialization, we'll be more lenient with status codes
      // Some MCP servers (like Zapier) may return 400 but still work
      if (!initResponse.ok && initResponse.status !== 400) {
        throw new Error(`HTTP ${initResponse.status}: ${initResponse.statusText}`)
      }

      // Parse initialization response to detect server type
      let initResult: any = {};
      try {
        const initContentType = initResponse.headers.get('content-type') || '';
        if (initContentType.includes('text/event-stream')) {
          const initText = await initResponse.text();
          const initLines = initText.split('\n');
          for (const line of initLines) {
            if (line.startsWith('data: ')) {
              initResult = JSON.parse(line.substring(6));
              break;
            }
          }
        } else {
          initResult = await initResponse.json();
        }
      } catch (e) {
        console.warn('Could not parse init response for server detection:', e);
        // Continue - we'll use defaults
      }

      // Detect server type from initialization response
      detectedType = detectServerType(serverUrl, initResult.result || {});
      const serverMetadata = getServerTypeMetadata(detectedType);
      serverCapabilities = extractCapabilities(initResult.result || {});
      serverDisplayName = formatServerInfo(detectedType, initResult.result || {});
      
      console.log(`Detected MCP server type: ${detectedType} (${serverDisplayName})`);
      console.log(`Server capabilities: ${serverCapabilities.join(', ')}`);
      
      // Send initialized notification (optional, may fail)
      try {
        await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized'
          })
        })
      } catch {
        // Ignore initialized notification failures - this is common
      }

      // Test tools listing - this is the critical test
      const toolsResponse = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2024-11-05'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        })
      })

      // Handle different response formats (JSON or SSE)
      let toolsResult
      const contentType = toolsResponse.headers.get('content-type') || ''
      
      if (contentType.includes('text/event-stream')) {
        // Handle Server-Sent Events format
        const responseText = await toolsResponse.text()
        console.log(`SSE Response: ${responseText.substring(0, 500)}`)
        
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
          toolsResult = JSON.parse(jsonData)
        } catch (parseError) {
          throw new Error(`Failed to parse SSE data: ${parseError.message}`)
        }
      } else {
        // Handle regular JSON response
        try {
          toolsResult = await toolsResponse.json()
        } catch (parseError) {
          const responseText = await toolsResponse.text().catch(() => 'Unable to read response')
          throw new Error(`Failed to parse JSON response: ${parseError.message}. Response: ${responseText.substring(0, 200)}`)
        }
      }

      // Check if we got a valid MCP response even with 400 status
      if (toolsResult.error) {
        throw new Error(`MCP Error: ${toolsResult.error.message || 'Unknown error'}`)
      }

      // If we have tools in the result, consider it successful regardless of HTTP status
      if (toolsResult.result?.tools) {
        toolCount = toolsResult.result.tools.length
      } else if (!toolsResponse.ok) {
        // Only fail if we don't have tools AND the HTTP status is bad
        throw new Error(`Tools list failed: HTTP ${toolsResponse.status}: ${toolsResponse.statusText}`)
      }

      if (toolCount === 0) {
        console.warn('MCP connection successful but no tools found')
      } else {
        console.log(`MCP connection test successful, found ${toolCount} tools`)
      }

    } catch (mcpError: any) {
      console.error('MCP connection test failed:', mcpError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection test failed: ${mcpError.message}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create vault secret for the server URL
    const secretName = `mcp_server_url_${agentId}_${Date.now()}`
    const secretDescription = `MCP Server URL for connection: ${connectionName} (Agent: ${agentId})`
    
    const { data: vaultId, error: vaultError } = await supabase.rpc('create_vault_secret', {
      p_secret: serverUrl,
      p_name: secretName,
      p_description: secretDescription
    })

    if (vaultError || !vaultId) {
      console.error('Vault creation error:', vaultError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to secure server URL in vault: ${vaultError?.message || 'Unknown vault error'}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create the MCP connection record with detected server type
    const { data: connection, error: insertError} = await supabase
      .from('agent_mcp_connections')
      .insert({
        agent_id: agentId,
        connection_name: connectionName,
        vault_server_url_id: vaultId,
        server_url: null, // Never store plain text URLs
        connection_type: detectedType,
        server_capabilities: {
          tools: { listChanged: false },
          discovered: serverCapabilities,
          ...((initResult.result || {}).capabilities || {})
        },
        server_info: {
          name: serverDisplayName,
          ...((initResult.result || {}).serverInfo || {}),
          detectedType: detectedType
        },
        protocol_version: (initResult.result || {}).protocolVersion || '2024-11-05',
        auth_config: authConfig,
        is_active: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Database insert error:', insertError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to create MCP connection: ${insertError.message}` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Trigger tool discovery for the new connection
    try {
      const { data: refreshData, error: refreshError } = await supabase.functions.invoke('refresh-mcp-tools', {
        body: { connectionId: connection.id }
      })

      if (refreshError) {
        console.warn('Tool refresh failed after connection creation:', refreshError)
        // Don't fail the connection creation, just log the warning
      }
    } catch (refreshError) {
      console.warn('Tool refresh failed after connection creation:', refreshError)
      // Don't fail the connection creation, just log the warning
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        connection: connection 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Create MCP connection error:', error)
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
