// Edge Function: Temporary Chat MCP Tools
// Description: MCP tool interface for managing temporary chat links
// Authentication: Requires JWT token (authenticated users only)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

/**
 * Get the base URL for the frontend application
 * Dynamically detects environment based on request headers and Supabase URL
 */
function getBaseUrl(req?: Request): string {
  console.log(`[getBaseUrl] Starting URL detection...`);
  
  // Try to get origin from request headers first (most reliable)
  if (req) {
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const host = req.headers.get('host');
    
    console.log(`[getBaseUrl] Headers - Origin: ${origin}, Referer: ${referer}, Host: ${host}`);
    
    // Try origin header first
    if (origin) {
      try {
        const url = new URL(origin);
        console.log(`[getBaseUrl] Origin hostname: ${url.hostname}`);
        
        // Only use trusted domains
        if (url.hostname === 'localhost' || 
            url.hostname === '127.0.0.1' || 
            url.hostname.endsWith('.netlify.app') ||
            url.hostname.endsWith('.agentopia.com') ||
            url.hostname.endsWith('.vercel.app')) {
          console.log(`[getBaseUrl] Using origin: ${origin}`);
          return origin;
        }
      } catch (e) {
        console.log(`[getBaseUrl] Invalid origin header: ${origin}`, e);
      }
    }
    
    // Try referer header as fallback
    if (referer) {
      try {
        const url = new URL(referer);
        const baseUrl = `${url.protocol}//${url.host}`;
        console.log(`[getBaseUrl] Referer hostname: ${url.hostname}, base: ${baseUrl}`);
        
        // Only use trusted domains
        if (url.hostname === 'localhost' || 
            url.hostname === '127.0.0.1' || 
            url.hostname.endsWith('.netlify.app') ||
            url.hostname.endsWith('.agentopia.com') ||
            url.hostname.endsWith('.vercel.app')) {
          console.log(`[getBaseUrl] Using referer base: ${baseUrl}`);
          return baseUrl;
        }
      } catch (e) {
        console.log(`[getBaseUrl] Invalid referer header: ${referer}`, e);
      }
    }
  }
  
  // Fallback to environment detection
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  console.log(`[getBaseUrl] Supabase URL: ${supabaseUrl}`);
  
  // Local development detection
  if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    console.log(`[getBaseUrl] Detected local development environment`);
    return 'http://localhost:5173';
  }
  
  // Production environment fallback
  console.log(`[getBaseUrl] Using production fallback`);
  return 'https://agentopia.netlify.app';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface MCPToolRequest {
  action: string
  agent_id: string
  user_id: string
  tool_name: string
  [key: string]: any // Additional parameters
}

interface MCPToolResponse {
  success: boolean
  data?: any
  error?: string
  metadata?: Record<string, any>
}

serve(async (req) => {
  console.log(`[temporary-chat-mcp] === REQUEST START ===`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[temporary-chat-mcp] Handling CORS preflight`)
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[temporary-chat-mcp] Initializing...`)
    
    // Test basic functionality first
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[temporary-chat-mcp] Parsing request body...`)
    const requestBody = await req.json()
    console.log(`[temporary-chat-mcp] Request body:`, JSON.stringify(requestBody, null, 2))

    const { action, agent_id, user_id, tool_name, ...parameters } = requestBody as MCPToolRequest

    console.log(`[temporary-chat-mcp] Action: ${action || tool_name}`)
    console.log(`[temporary-chat-mcp] Agent: ${agent_id}`)
    console.log(`[temporary-chat-mcp] User: ${user_id}`)

    // Route to appropriate handler based on action/tool_name
    let result: MCPToolResponse

    switch (action || tool_name) {
      case 'create_temporary_chat_link':
        console.log(`[temporary-chat-mcp] Calling createTemporaryChatLink`)
        result = await createTemporaryChatLink(supabase, req, { agent_id, user_id, ...parameters })
        break

      case 'list_temporary_chat_links':
        console.log(`[temporary-chat-mcp] Calling listTemporaryChatLinks`)
        result = await listTemporaryChatLinks(supabase, { agent_id, user_id, ...parameters })
        break

      case 'update_temporary_chat_link':
        console.log(`[temporary-chat-mcp] Calling updateTemporaryChatLink`)
        result = await updateTemporaryChatLink(supabase, { user_id, ...parameters })
        break

      case 'delete_temporary_chat_link':
        console.log(`[temporary-chat-mcp] Calling deleteTemporaryChatLink`)
        result = await deleteTemporaryChatLink(supabase, { user_id, ...parameters })
        break

      case 'get_temporary_chat_analytics':
        console.log(`[temporary-chat-mcp] Calling getTemporaryChatAnalytics`)
        result = await getTemporaryChatAnalytics(supabase, { agent_id, user_id, ...parameters })
        break

      case 'manage_temporary_chat_session':
        console.log(`[temporary-chat-mcp] Calling manageTemporaryChatSession`)
        result = await manageTemporaryChatSession(supabase, { user_id, ...parameters })
        break

      default:
        console.warn(`[temporary-chat-mcp] Unknown action: ${action || tool_name}`)
        result = {
          success: false,
          error: `Unknown action: ${action || tool_name}`,
          metadata: { available_actions: [
            'create_temporary_chat_link',
            'list_temporary_chat_links', 
            'update_temporary_chat_link',
            'delete_temporary_chat_link',
            'get_temporary_chat_analytics',
            'manage_temporary_chat_session'
          ]}
        }
    }

    console.log(`[temporary-chat-mcp] Result:`, JSON.stringify(result, null, 2))
    console.log(`[temporary-chat-mcp] === REQUEST END ===`)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      }
    )

  } catch (error) {
    console.error('[temporary-chat-mcp] CRITICAL ERROR:', error)
    console.error('[temporary-chat-mcp] Error stack:', error.stack)
    console.error('[temporary-chat-mcp] Error name:', error.name)
    console.error('[temporary-chat-mcp] Error message:', error.message)
    
    const errorResponse = {
      success: false,
      error: error.message || 'Internal server error',
      metadata: { 
        timestamp: new Date().toISOString(),
        error_type: error.name,
        stack: error.stack
      }
    };

    console.log(`[temporary-chat-mcp] Error response:`, JSON.stringify(errorResponse, null, 2))
    console.log(`[temporary-chat-mcp] === REQUEST END (ERROR) ===`)
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// =============================================================================
// MCP TOOL IMPLEMENTATIONS
// =============================================================================

async function createTemporaryChatLink(
  supabase: any,
  req: Request,
  params: {
    agent_id: string
    user_id: string
    title?: string
    description?: string
    welcome_message?: string
    expires_in_hours?: number
    max_sessions?: number
    max_messages_per_session?: number
    session_timeout_minutes?: number
    rate_limit_per_minute?: number
    allowed_domains?: string[]
    ui_customization?: Record<string, any>
    // ✅ NEW: Context preservation fields
    source_conversation_id?: string
    chat_intent?: string
    system_prompt_override?: string
    initial_agent_message?: string
    send_initial_message?: boolean
  }
): Promise<MCPToolResponse> {
  console.log(`[createTemporaryChatLink] Starting with params:`, JSON.stringify(params, null, 2))
  
  try {
    // Validate required parameters (only agent_id and user_id are truly required)
    if (!params.agent_id || !params.user_id) {
      console.error(`[createTemporaryChatLink] Missing required parameters`)
      console.error(`[createTemporaryChatLink] agent_id: ${params.agent_id}`)
      console.error(`[createTemporaryChatLink] user_id: ${params.user_id}`)
      
      return {
        success: false,
        error: 'Missing required parameters: agent_id, user_id'
      }
    }

    console.log(`[createTemporaryChatLink] Parameters validated successfully`)

    // Verify user owns the agent
    console.log(`[createTemporaryChatLink] Verifying agent ownership`)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, user_id')
      .eq('id', params.agent_id)
      .eq('user_id', params.user_id)
      .single()

    if (agentError) {
      console.error(`[createTemporaryChatLink] Agent query error:`, agentError)
      return {
        success: false,
        error: `Agent verification failed: ${agentError.message}`
      }
    }

    if (!agent) {
      console.error(`[createTemporaryChatLink] Agent not found for id: ${params.agent_id}, user: ${params.user_id}`)
      return {
        success: false,
        error: 'Agent not found or not owned by user'
      }
    }

    console.log(`[createTemporaryChatLink] Agent verified: ${agent.name} (${agent.id})`)

    // Generate defaults for missing parameters
    const defaults = generateTemporaryChatDefaults(agent.name, params)
    console.log(`[createTemporaryChatLink] Generated defaults:`, JSON.stringify(defaults, null, 2))

    // Generate secure token using database function
    console.log(`[createTemporaryChatLink] Generating secure token`)
    const { data: tokenResult, error: tokenError } = await supabase
      .rpc('generate_temp_chat_token')

    if (tokenError) {
      console.error(`[createTemporaryChatLink] Token generation error:`, tokenError)
      return {
        success: false,
        error: `Failed to generate secure token: ${tokenError.message}`
      }
    }

    if (!tokenResult) {
      console.error(`[createTemporaryChatLink] Token generation returned null`)
      return {
        success: false,
        error: 'Failed to generate secure token - null result'
      }
    }

    console.log(`[createTemporaryChatLink] Token generated successfully: ${tokenResult}`)

    // Calculate expiration time with buffer to ensure it's after created_at
    const now = new Date()
    const expiresAt = new Date(now.getTime() + (defaults.expires_in_hours * 60 * 60 * 1000))
    
    console.log(`[createTemporaryChatLink] Current time: ${now.toISOString()}`)
    console.log(`[createTemporaryChatLink] Expires at: ${expiresAt.toISOString()}`)
    console.log(`[createTemporaryChatLink] Hours difference: ${(expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)}`)

    // Create the temporary chat link using defaults
    const insertData = {
      agent_id: params.agent_id,
      user_id: params.user_id,
      vault_link_token_id: tokenResult,
      title: defaults.title,
      description: defaults.description,
      welcome_message: defaults.welcome_message,
      expires_at: expiresAt.toISOString(),
      max_sessions: defaults.max_sessions,
      max_messages_per_session: defaults.max_messages_per_session,
      session_timeout_minutes: defaults.session_timeout_minutes,
      rate_limit_per_minute: defaults.rate_limit_per_minute,
      allowed_domains: defaults.allowed_domains,
      ui_customization: defaults.ui_customization,
      // ✅ NEW: Context preservation fields
      source_conversation_id: params.source_conversation_id || null,
      chat_intent: params.chat_intent || null,
      system_prompt_override: params.system_prompt_override || null,
      initial_agent_message: params.initial_agent_message || null,
      send_initial_message: params.send_initial_message !== undefined ? params.send_initial_message : true
    }
    
    console.log(`[createTemporaryChatLink] Inserting data:`, JSON.stringify(insertData, null, 2))
    
    const { data: link, error: linkError } = await supabase
      .from('temporary_chat_links')
      .insert(insertData)
      .select('id, title, expires_at, max_sessions, created_at')
      .single()

    if (linkError) {
      return {
        success: false,
        error: `Failed to create temporary chat link: ${linkError.message}`
      }
    }

    // Get the actual token for the response (decrypt from vault)
    console.log(`[createTemporaryChatLink] Attempting to decrypt token: ${tokenResult}`)
    
    let actualToken = null;
    try {
      const { data: decryptedToken, error: decryptError } = await supabase
        .rpc('vault_decrypt', { vault_id: tokenResult })
      
      if (decryptError) {
        console.error(`[createTemporaryChatLink] Vault decrypt error:`, decryptError)
      } else {
        // Remove ALL newlines and whitespace from the token
        actualToken = decryptedToken?.replace(/[\r\n\s]/g, '');
        console.log(`[createTemporaryChatLink] Token decrypted successfully: ${actualToken?.substring(0, 20)}...`)
      }
    } catch (vaultError) {
      console.error(`[createTemporaryChatLink] Vault access error:`, vaultError)
    }

    return {
      success: true,
      data: {
        link_id: link.id,
        title: link.title,
        agent_name: agent.name,
        expires_at: link.expires_at,
        max_sessions: link.max_sessions,
        created_at: link.created_at,
        public_url: actualToken ? `${getBaseUrl(req)}/temp-chat/${actualToken.trim()}` : null,
        token_hint: actualToken ? actualToken.substring(0, 8) + '...' : 'Token created securely',
        // ✅ NEW: Include context preservation info
        source_conversation_id: params.source_conversation_id || null,
        chat_intent: params.chat_intent || null,
        has_system_prompt_override: !!params.system_prompt_override,
        has_initial_message: !!params.initial_agent_message,
        send_initial_message: params.send_initial_message !== undefined ? params.send_initial_message : true
      },
      metadata: {
        agent_id: params.agent_id,
        user_id: params.user_id,
        vault_token_id: tokenResult
      }
    }

  } catch (error) {
    return {
      success: false,
      error: `Error creating temporary chat link: ${error.message}`
    }
  }
}

async function listTemporaryChatLinks(
  supabase: any,
  params: {
    agent_id?: string
    user_id: string
    include_inactive?: boolean
    limit?: number
    offset?: number
  }
): Promise<MCPToolResponse> {
  try {
    let query = supabase
      .from('temporary_chat_links')
      .select(`
        id,
        agent_id,
        title,
        description,
        expires_at,
        max_sessions,
        session_count,
        total_messages,
        last_accessed_at,
        is_active,
        created_at,
        agents!inner(name)
      `)
      .eq('user_id', params.user_id)
      .order('created_at', { ascending: false })

    // Filter by agent if specified
    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id)
    }

    // Filter by active status if not including inactive
    if (!params.include_inactive) {
      query = query.eq('is_active', true)
    }

    // Apply pagination
    if (params.limit) {
      query = query.limit(params.limit)
    }
    if (params.offset) {
      query = query.range(params.offset, (params.offset + (params.limit || 20)) - 1)
    }

    const { data: links, error: linksError } = await query

    if (linksError) {
      return {
        success: false,
        error: `Failed to fetch temporary chat links: ${linksError.message}`
      }
    }

    // Format the response
    const formattedLinks = links?.map(link => ({
      id: link.id,
      agent_id: link.agent_id,
      agent_name: link.agents.name,
      title: link.title,
      description: link.description,
      expires_at: link.expires_at,
      is_expired: new Date(link.expires_at) < new Date(),
      max_sessions: link.max_sessions,
      session_count: link.session_count,
      total_messages: link.total_messages,
      last_accessed_at: link.last_accessed_at,
      is_active: link.is_active,
      created_at: link.created_at,
      status: getStatusForLink(link)
    })) || []

    return {
      success: true,
      data: {
        links: formattedLinks,
        total_count: formattedLinks.length,
        has_more: params.limit ? formattedLinks.length === params.limit : false
      },
      metadata: {
        user_id: params.user_id,
        agent_id: params.agent_id,
        include_inactive: params.include_inactive || false
      }
    }

  } catch (error) {
    return {
      success: false,
      error: `Error listing temporary chat links: ${error.message}`
    }
  }
}

async function updateTemporaryChatLink(
  supabase: any,
  params: {
    user_id: string
    link_id: string
    title?: string
    description?: string
    is_active?: boolean
    max_sessions?: number
  }
): Promise<MCPToolResponse> {
  try {
    if (!params.link_id) {
      return {
        success: false,
        error: 'Missing required parameter: link_id'
      }
    }

    // Verify user owns the link
    const { data: existingLink, error: verifyError } = await supabase
      .from('temporary_chat_links')
      .select('id, title, user_id')
      .eq('id', params.link_id)
      .eq('user_id', params.user_id)
      .single()

    if (verifyError || !existingLink) {
      return {
        success: false,
        error: 'Temporary chat link not found or not owned by user'
      }
    }

    // Build update object
    const updates: any = {}
    if (params.title !== undefined) updates.title = params.title
    if (params.description !== undefined) updates.description = params.description
    if (params.is_active !== undefined) updates.is_active = params.is_active
    if (params.max_sessions !== undefined) updates.max_sessions = params.max_sessions

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: 'No update parameters provided'
      }
    }

    // Perform update
    const { data: updatedLink, error: updateError } = await supabase
      .from('temporary_chat_links')
      .update(updates)
      .eq('id', params.link_id)
      .select('id, title, description, is_active, max_sessions, updated_at')
      .single()

    if (updateError) {
      return {
        success: false,
        error: `Failed to update temporary chat link: ${updateError.message}`
      }
    }

    return {
      success: true,
      data: {
        link_id: updatedLink.id,
        title: updatedLink.title,
        description: updatedLink.description,
        is_active: updatedLink.is_active,
        max_sessions: updatedLink.max_sessions,
        updated_at: updatedLink.updated_at
      },
      metadata: {
        user_id: params.user_id,
        updates_applied: Object.keys(updates)
      }
    }

  } catch (error) {
    return {
      success: false,
      error: `Error updating temporary chat link: ${error.message}`
    }
  }
}

async function deleteTemporaryChatLink(
  supabase: any,
  params: {
    user_id: string
    link_id: string
  }
): Promise<MCPToolResponse> {
  try {
    if (!params.link_id) {
      return {
        success: false,
        error: 'Missing required parameter: link_id'
      }
    }

    // Verify user owns the link and get session count
    const { data: existingLink, error: verifyError } = await supabase
      .from('temporary_chat_links')
      .select('id, title, user_id, session_count')
      .eq('id', params.link_id)
      .eq('user_id', params.user_id)
      .single()

    if (verifyError || !existingLink) {
      return {
        success: false,
        error: 'Temporary chat link not found or not owned by user'
      }
    }

    // Check if there are active sessions
    const { data: activeSessions, error: sessionsError } = await supabase
      .from('temporary_chat_sessions')
      .select('id')
      .eq('link_id', params.link_id)
      .eq('status', 'active')

    if (sessionsError) {
      return {
        success: false,
        error: 'Failed to check for active sessions'
      }
    }

    // End active sessions before deletion
    if (activeSessions && activeSessions.length > 0) {
      await supabase
        .from('temporary_chat_sessions')
        .update({ 
          status: 'terminated', 
          ended_at: new Date().toISOString(),
          end_reason: 'link_deleted'
        })
        .eq('link_id', params.link_id)
        .eq('status', 'active')
    }

    // Delete the link (CASCADE will handle related sessions)
    const { error: deleteError } = await supabase
      .from('temporary_chat_links')
      .delete()
      .eq('id', params.link_id)

    if (deleteError) {
      return {
        success: false,
        error: `Failed to delete temporary chat link: ${deleteError.message}`
      }
    }

    return {
      success: true,
      data: {
        link_id: params.link_id,
        title: existingLink.title,
        sessions_terminated: activeSessions?.length || 0,
        deleted_at: new Date().toISOString()
      },
      metadata: {
        user_id: params.user_id,
        had_sessions: existingLink.session_count > 0
      }
    }

  } catch (error) {
    return {
      success: false,
      error: `Error deleting temporary chat link: ${error.message}`
    }
  }
}

async function getTemporaryChatAnalytics(
  supabase: any,
  params: {
    agent_id?: string
    user_id: string
    days_back?: number
    include_session_details?: boolean
  }
): Promise<MCPToolResponse> {
  try {
    const daysBack = params.days_back || 30

    // Get analytics using database function
    const { data: analytics, error: analyticsError } = await supabase
      .rpc('get_temp_chat_analytics', {
        p_agent_id: params.agent_id || null,
        p_user_id: params.user_id,
        p_days_back: daysBack
      })

    if (analyticsError) {
      return {
        success: false,
        error: `Failed to get analytics: ${analyticsError.message}`
      }
    }

    const result = analytics?.[0] || {}

    // Get session details if requested
    let sessionDetails = null
    if (params.include_session_details && params.agent_id) {
      const { data: sessions, error: sessionsError } = await supabase
        .from('temporary_chat_links')
        .select(`
          id,
          title,
          session_count,
          total_messages,
          created_at,
          temporary_chat_sessions!inner(
            id,
            started_at,
            ended_at,
            message_count,
            status,
            satisfaction_rating
          )
        `)
        .eq('agent_id', params.agent_id)
        .eq('user_id', params.user_id)
        .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())

      if (!sessionsError) {
        sessionDetails = sessions
      }
    }

    return {
      success: true,
      data: {
        summary: {
          total_links: result.total_links || 0,
          active_links: result.active_links || 0,
          total_sessions: result.total_sessions || 0,
          active_sessions: result.active_sessions || 0,
          total_messages: result.total_messages || 0,
          average_session_duration: result.avg_session_duration || '0 seconds',
          top_countries: result.top_countries || [],
          satisfaction_average: result.satisfaction_avg || 0
        },
        session_details: sessionDetails,
        time_period: {
          days_back: daysBack,
          from_date: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
          to_date: new Date().toISOString()
        }
      },
      metadata: {
        user_id: params.user_id,
        agent_id: params.agent_id,
        include_session_details: params.include_session_details || false
      }
    }

  } catch (error) {
    return {
      success: false,
      error: `Error getting temporary chat analytics: ${error.message}`
    }
  }
}

async function manageTemporaryChatSession(
  supabase: any,
  params: {
    user_id: string
    session_id: string
    action: 'end' | 'extend' | 'get_status'
    extend_minutes?: number
  }
): Promise<MCPToolResponse> {
  try {
    if (!params.session_id || !params.action) {
      return {
        success: false,
        error: 'Missing required parameters: session_id, action'
      }
    }

    // Verify user owns the session through the link
    const { data: session, error: sessionError } = await supabase
      .from('temporary_chat_sessions')
      .select(`
        id,
        status,
        started_at,
        ended_at,
        message_count,
        temporary_chat_links!inner(
          id,
          user_id,
          title,
          agent_id
        )
      `)
      .eq('id', params.session_id)
      .single()

    if (sessionError || !session || session.temporary_chat_links.user_id !== params.user_id) {
      return {
        success: false,
        error: 'Session not found or not owned by user'
      }
    }

    switch (params.action) {
      case 'get_status':
        return {
          success: true,
          data: {
            session_id: session.id,
            status: session.status,
            started_at: session.started_at,
            ended_at: session.ended_at,
            message_count: session.message_count,
            duration_seconds: session.ended_at 
              ? Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
              : Math.floor((new Date().getTime() - new Date(session.started_at).getTime()) / 1000),
            link_title: session.temporary_chat_links.title
          }
        }

      case 'end':
        if (session.status !== 'active') {
          return {
            success: false,
            error: `Cannot end session with status: ${session.status}`
          }
        }

        const { data: endedSession, error: endError } = await supabase
          .from('temporary_chat_sessions')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            end_reason: 'manually_ended'
          })
          .eq('id', params.session_id)
          .select('id, status, ended_at')
          .single()

        if (endError) {
          return {
            success: false,
            error: `Failed to end session: ${endError.message}`
          }
        }

        return {
          success: true,
          data: {
            session_id: endedSession.id,
            status: endedSession.status,
            ended_at: endedSession.ended_at,
            message: 'Session ended successfully'
          }
        }

      case 'extend':
        if (!params.extend_minutes || params.extend_minutes < 1 || params.extend_minutes > 1440) {
          return {
            success: false,
            error: 'extend_minutes must be between 1 and 1440 (24 hours)'
          }
        }

        // This would require updating the parent link's expiration
        // For now, return a message indicating this feature is not yet implemented
        return {
          success: false,
          error: 'Session extension is not yet implemented. Consider creating a new link instead.'
        }

      default:
        return {
          success: false,
          error: `Unknown action: ${params.action}. Available actions: end, extend, get_status`
        }
    }

  } catch (error) {
    return {
      success: false,
      error: `Error managing temporary chat session: ${error.message}`
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateTemporaryChatDefaults(agentName: string, params: any) {
  // Generate a randomized sequence for the title
  const randomSequence = Math.random().toString(36).substring(2, 8).toUpperCase()
  
  // Create defaults based on your specifications
  const defaults = {
    title: params.title || `${agentName} temp_chat ${randomSequence}`,
    description: params.description || 'A temporary chat',
    welcome_message: params.welcome_message || `This is a temporary chat. It will end in ${params.expires_in_hours || 1} hour${(params.expires_in_hours || 1) > 1 ? 's' : ''}.`,
    expires_in_hours: params.expires_in_hours || 1, // 60 minutes by default
    max_sessions: params.max_sessions || 1, // 1 concurrent chat session, can be reopened until expired
    max_messages_per_session: params.max_messages_per_session || 100, // 100 default
    session_timeout_minutes: params.session_timeout_minutes || 60, // Same as expiry time (60 minutes)
    rate_limit_per_minute: params.rate_limit_per_minute || 10, // Default is 10
    allowed_domains: params.allowed_domains || null, // No restrictions
    ui_customization: params.ui_customization || {}
  }
  
  return defaults
}

function getStatusForLink(link: any): string {
  const now = new Date()
  const expires = new Date(link.expires_at)
  
  if (!link.is_active) {
    return 'inactive'
  } else if (expires < now) {
    return 'expired'
  } else if (link.session_count >= link.max_sessions) {
    return 'full'
  } else {
    return 'active'
  }
}
