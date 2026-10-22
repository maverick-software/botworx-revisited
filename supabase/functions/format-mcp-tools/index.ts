import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import OpenAI from 'npm:openai@4.28.0'
import { corsHeaders } from '../_shared/cors.ts'

interface FormatToolsRequest {
  agentId: string;
}

interface FormatToolsResponse {
  success: boolean;
  formattedTools?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Parse request body
    const { agentId }: FormatToolsRequest = await req.json()

    if (!agentId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Agent ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[Format MCP Tools] Starting for agent: ${agentId}`)

    // Get authorization header from request to pass to get-agent-tools
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Extract user_id from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Use get-agent-tools to get ALL available tools (internal + MCP)
    console.log(`[Format MCP Tools] Fetching all tools for agent ${agentId}, user ${user.id}`)
    
    const { data: toolsResponse, error: toolsError } = await supabase.functions.invoke('get-agent-tools', {
      body: { agent_id: agentId, user_id: user.id }
    })

    if (toolsError) {
      throw new Error(`Failed to fetch tools: ${toolsError.message}`)
    }

    if (!toolsResponse?.success || !toolsResponse?.tools || toolsResponse.tools.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          formattedTools: 'No tools found for this agent. Connect services in the Tools or MCP tabs to enable tools.' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const allTools = toolsResponse.tools
    console.log(`[Format MCP Tools] Found ${allTools.length} total tools`)

    // Prepare data for LLM formatting
    const toolsData: any[] = allTools.map((tool: any) => ({
      name: tool.name,
      description: tool.description || 'No description available'
    }))

    // Use LLM to format the tools in a human-readable way
    const systemPrompt = `You are a technical writer helping format tool documentation for AI agents. 

Your task is to take a list of tools and format them in a clear, organized way that helps the agent understand what tools are available.

CRITICAL: Return PLAIN TEXT ONLY. Do NOT use markdown formatting (no bold, no italics, no special characters).

Format the output like this:

You have the following tools available:

## [System/Service Name] ##

tool_name - Brief description of what this tool does
another_tool - Brief description

Rules:
1. Group tools by their system/service (inferred from tool name patterns like "gmail_", "quickbooks_", "search_", etc.)
2. Use plain text only - no asterisks, no bold, no special formatting
3. Be concise but clear in descriptions
4. Use simple hyphens for separators
5. Keep section headers with ## markers only`

    const userPrompt = `Format these MCP tools for an AI agent:\n\n${JSON.stringify(toolsData, null, 2)}`

    console.log(`[Format MCP Tools] Calling OpenAI to format ${toolsData.length} tools`)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })

    const formattedTools = completion.choices[0]?.message?.content || 'Failed to format tools'

    console.log(`[Format MCP Tools] Successfully formatted tools`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        formattedTools 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('[Format MCP Tools] Error:', error)
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

