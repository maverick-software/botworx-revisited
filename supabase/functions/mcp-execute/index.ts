import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { getServerTypeMetadata } from '../_shared/mcp-server-detection.ts'

interface MCPExecuteRequest {
  connection_id: string;
  tool_name: string;
  parameters: Record<string, any>;
  agent_id: string;
}

interface MCPExecuteResponse {
  success: boolean;
  data?: any;
  error?: string;
}

Deno.serve(async (req) => {
  console.log(`[MCP Execute] Incoming request - Method: ${req.method}, URL: ${req.url}`)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`[MCP Execute] CORS preflight request handled`)
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for vault access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log(`[MCP Execute] Supabase URL: ${supabaseUrl}`)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const rawBody = await req.text()
    console.log(`[MCP Execute] Raw request body: ${rawBody}`)
    
    let parsedBody: MCPExecuteRequest
    try {
      parsedBody = JSON.parse(rawBody)
    } catch (parseError) {
      console.error(`[MCP Execute] JSON parse error:`, parseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid JSON in request body: ${parseError.message}` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const { connection_id, tool_name, parameters, agent_id } = parsedBody
    console.log(`[MCP Execute] Parsed request - connection_id: ${connection_id}, tool_name: ${tool_name}, agent_id: ${agent_id}, parameters:`, parameters)

    if (!connection_id || !tool_name || !agent_id) {
      console.error(`[MCP Execute] Missing required parameters - connection_id: ${!!connection_id}, tool_name: ${!!tool_name}, agent_id: ${!!agent_id}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Connection ID, tool name, and agent ID are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[MCP Execute] ✅ All required parameters present, executing tool ${tool_name} for agent ${agent_id} on connection ${connection_id}`)

    // Get the connection details
    console.log(`[MCP Execute] Fetching connection details from database...`)
    const { data: connection, error: connectionError } = await supabase
      .from('agent_mcp_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('agent_id', agent_id)
      .single()

    console.log(`[MCP Execute] Connection query result - data:`, connection, `error:`, connectionError)

    if (connectionError || !connection) {
      console.error(`[MCP Execute] Connection not found or not authorized - error:`, connectionError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Connection not found or not authorized: ${connectionError?.message}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[MCP Execute] Connection found - is_active: ${connection.is_active}, connection_type: ${connection.connection_type}`)
    
    // Get server type metadata for specialized handling
    const serverMetadata = getServerTypeMetadata(connection.connection_type);
    console.log(`[MCP Execute] Server type: ${connection.connection_type}, Name: ${serverMetadata.name}, Transport: ${serverMetadata.defaultTransport}`);

    if (!connection.is_active) {
      console.error(`[MCP Execute] Connection is not active`)
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
    console.log(`[MCP Execute] Retrieving server URL from vault for connection ${connection_id}...`)
    const { data: serverUrl, error: urlError } = await supabase.rpc('get_mcp_server_url', {
      connection_id: connection_id
    })

    console.log(`[MCP Execute] Server URL retrieval result - serverUrl: ${serverUrl ? '[REDACTED]' : 'null'}, error:`, urlError)

    if (urlError || !serverUrl) {
      console.error(`[MCP Execute] Failed to retrieve server URL: ${urlError?.message}`)
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

    console.log(`[MCP Execute] ✅ Server URL retrieved successfully, preparing MCP request...`)

    // Execute the tool via MCP protocol
    try {
      console.log(`[MCP Execute] Calling MCP server for tool: ${tool_name}`)
      
      // Pass parameters as-is to let the LLM learn from errors
      // The intelligent retry mechanism will handle missing parameters
      let transformedParameters = { ...parameters };
      
      console.log(`[MCP Execute] Parameters being sent to MCP server:`, transformedParameters)
      
      const mcpRequestBody = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: tool_name,
          arguments: transformedParameters
        }
      }
      
      console.log(`[MCP Execute] MCP request body:`, JSON.stringify(mcpRequestBody, null, 2))
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'MCP-Protocol-Version': '2024-11-05'
        },
        body: JSON.stringify(mcpRequestBody)
      })

      console.log(`[MCP Execute] MCP server response - status: ${response.status}, statusText: ${response.statusText}`)
      console.log(`[MCP Execute] Response headers:`, Object.fromEntries(response.headers.entries()))

      // Handle different response formats (JSON or SSE)
      let mcpResponse
      const contentType = response.headers.get('content-type') || ''
      console.log(`[MCP Execute] Response content-type: ${contentType}`)
      
      if (contentType.includes('text/event-stream')) {
        // Handle Server-Sent Events format (Zapier MCP uses this)
        const responseText = await response.text()
        console.log(`[MCP Execute] SSE Response received for tool ${tool_name}, length: ${responseText.length} chars`)
        console.log(`[MCP Execute] SSE Response (first 500 chars): ${responseText.substring(0, 500)}`)
        
        // Parse SSE format: look for "data: " lines
        const lines = responseText.split('\n')
        let jsonData = ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            jsonData = line.substring(6) // Remove "data: " prefix
            console.log(`[MCP Execute] Found SSE data line: ${jsonData.substring(0, 200)}...`)
            break
          }
        }
        
        if (!jsonData) {
          console.error(`[MCP Execute] No data found in SSE response. Full response:`, responseText)
          throw new Error('No data found in SSE response')
        }
        
        try {
          mcpResponse = JSON.parse(jsonData)
          console.log(`[MCP Execute] Successfully parsed SSE JSON response`)
        } catch (parseError) {
          console.error(`[MCP Execute] Failed to parse SSE data. Parse error:`, parseError, `Raw data:`, jsonData)
          throw new Error(`Failed to parse SSE data: ${parseError.message}`)
        }
      } else {
        // Handle regular JSON response
        console.log(`[MCP Execute] Handling regular JSON response`)
        if (!response.ok && response.status !== 400) {
          // Some MCP servers return 400 but still have valid data
          const text = await response.text()
          console.error(`[MCP Execute] HTTP error ${response.status}: ${text}`)
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const responseText = await response.text()
        console.log(`[MCP Execute] JSON response text (first 500 chars): ${responseText.substring(0, 500)}`)
        try {
          mcpResponse = JSON.parse(responseText)
          console.log(`[MCP Execute] Successfully parsed JSON response`)
        } catch (parseError) {
          console.error(`[MCP Execute] Failed to parse JSON. Parse error:`, parseError, `Raw text:`, responseText)
          throw new Error(`Failed to parse JSON response: ${parseError.message}`)
        }
      }
      
      console.log(`[MCP Execute] MCP response structure:`, Object.keys(mcpResponse))
      
      // Check for MCP protocol errors
      if (mcpResponse.error) {
        console.error(`[MCP Execute] MCP Error detected:`, mcpResponse.error)
        
        const errorCode = mcpResponse.error.code
        const errorMessage = mcpResponse.error.message || 'Unknown error'
        
        // Check if this is a retryable parameter error
        const isParameterError = errorCode === -32602 || // Invalid params
                                errorMessage.toLowerCase().includes('invalid arguments') ||
                                errorMessage.toLowerCase().includes('required') ||
                                errorMessage.toLowerCase().includes('missing') ||
                                errorMessage.toLowerCase().includes('undefined')
        
        console.log(`[MCP Execute] Error code: ${errorCode}, Is parameter error: ${isParameterError}`)
        
        if (isParameterError) {
          console.log(`[MCP Execute] 🔄 MCP parameter error detected - flagging for retry`)
          
          // Mark schema as potentially stale for automatic refresh
          try {
            await supabase.rpc('mark_mcp_schema_refresh_needed', {
              p_connection_id: connection_id,
              p_error_message: errorMessage
            })
            console.log(`[MCP Execute] 📝 Marked connection ${connection_id} for schema refresh`)
          } catch (refreshMarkError) {
            console.warn(`[MCP Execute] Failed to mark schema refresh:`, refreshMarkError)
            // Don't fail the request if marking fails
          }
          
          // Return success: false with requires_retry flag for intelligent retry system
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `MCP Error ${errorCode}: ${errorMessage}`,
              requires_retry: true,
              metadata: {
                tool_name,
                mcp_error_code: errorCode,
                mcp_error: mcpResponse.error,
                retry_reason: 'Invalid or missing parameters detected',
                schema_refresh_triggered: true
              }
            }),
            { 
              status: 200, // Return 200 so Universal Tool Executor processes the retry
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        // Non-retryable error
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `MCP Error: ${errorMessage}`,
            data: mcpResponse.error
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Extract the result
      const result = mcpResponse.result
      console.log(`[MCP Execute] Tool ${tool_name} executed successfully, result type: ${typeof result}`)
      console.log(`[MCP Execute] Result preview:`, JSON.stringify(result).substring(0, 200))

      // Check if Zapier MCP returned an error in the result (they use isError flag)
      if (result && result.isError === true) {
        console.error(`[MCP Execute] Zapier MCP tool returned an error:`, result)
        
        // Extract the error message from the nested content structure
        let errorMessage = 'Tool execution failed'
        if (result.content && Array.isArray(result.content) && result.content[0]?.text) {
          try {
            const errorData = JSON.parse(result.content[0].text)
            errorMessage = errorData.error || errorMessage
          } catch (e) {
            // If parsing fails, use the raw text
            errorMessage = result.content[0].text
          }
        }
        
        console.log(`[MCP Execute] Extracted error message: ${errorMessage}`)
        
        // Return as a retry-able error for the LLM (200 OK so Universal Tool Executor processes it)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorMessage,
            requires_retry: true,
            metadata: {
              tool_name,
              zapier_error: true,
              feedback_url: result.content?.[0]?.text ? JSON.parse(result.content[0].text).feedbackUrl : null
            }
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Log tool execution for analytics and health monitoring
      console.log(`[MCP Execute] Updating tool usage and connection health...`)
      try {
        // Record successful tool execution with parameters for learning
        console.log(`[MCP Execute] Recording successful parameters:`, JSON.stringify(parameters).substring(0, 200))
        await supabase.rpc('record_mcp_tool_execution', {
          p_connection_id: connection_id,
          p_tool_name: tool_name,
          p_parameters: parameters,
          p_success: true
        })
        
        // Also update connection health
        await supabase.rpc('record_mcp_tool_success', {
          p_connection_id: connection_id
        })
        
        console.log(`[MCP Execute] ✅ Successfully recorded tool execution and parameters`)
      } catch (err) {
        console.warn('[MCP Execute] Failed to update tool usage/health:', err)
        // Don't fail the request if logging fails
      }

      // Parse and format Zapier MCP responses for better LLM comprehension
      let formattedResult = result
      
      if (connection.connection_type === 'zapier' && result.content && Array.isArray(result.content)) {
        try {
          // Extract the nested JSON from the text field
          const textContent = result.content[0]?.text
          if (textContent && typeof textContent === 'string') {
            const parsedData = JSON.parse(textContent)
            
            // Format based on whether results were found
            if (parsedData.results && Array.isArray(parsedData.results)) {
              if (parsedData.results.length === 0) {
                // No results found - make this crystal clear to the LLM
                formattedResult = {
                  type: 'text',
                  text: `Search completed successfully but returned no results. The query "${JSON.stringify(parameters)}" did not match any records in the system.`
                }
              } else {
                // Results found - format them nicely
                formattedResult = {
                  type: 'text',
                  text: `Found ${parsedData.results.length} result(s):\n\n${JSON.stringify(parsedData.results, null, 2)}`
                }
              }
            } else {
              // Non-search result, keep formatted data
              formattedResult = {
                type: 'text',
                text: JSON.stringify(parsedData, null, 2)
              }
            }
            
            console.log(`[MCP Execute] Formatted Zapier response for LLM comprehension`)
          }
        } catch (parseError) {
          console.warn('[MCP Execute] Could not parse Zapier response for formatting:', parseError)
          // Keep original result if parsing fails
        }
      }

      console.log(`[MCP Execute] ✅ Returning success response`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: formattedResult 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )

    } catch (mcpError: any) {
      console.error(`[MCP Execute] MCP connection error:`, mcpError)
      console.error(`[MCP Execute] Error stack:`, mcpError.stack)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `MCP execution failed: ${mcpError.message}`,
          data: null
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error: any) {
    console.error('[MCP Execute] Top-level error:', error)
    console.error('[MCP Execute] Error stack:', error.stack)
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
