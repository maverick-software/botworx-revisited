// Edge Function: Temporary Chat Public API
// Description: Public API for session validation, creation, and management (no authentication required)
// Authentication: Anonymous access allowed (verify_jwt: false)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface ValidateSessionRequest {
  session_token: string
}

interface CreateSessionRequest {
  link_token: string
  participant_identifier?: string
  participant_name?: string
  metadata?: Record<string, any>
}

interface SessionResponse {
  session_id: string
  agent_id: string
  agent_name: string
  conversation_id: string
  title: string
  description?: string
  welcome_message?: string
  max_messages: number
  current_messages: number
  rate_limit: number
  expires_at: string
  // ✅ NEW: Context preservation fields
  initial_agent_message?: string
  should_send_initial?: boolean
  chat_intent?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const path = url.pathname

    // Route handling
    switch (path) {
      case '/temporary-chat-api/validate':
      case '/validate':
        return await handleValidateLinkToken(req, supabase)
      
      case '/temporary-chat-api/validate-session':
      case '/validate-session':
        return await handleValidateSession(req, supabase)
      
      case '/temporary-chat-api/create-session':
      case '/create-session':
        return await handleCreateSession(req, supabase)
      
      case '/temporary-chat-api/end-session':
      case '/end-session':
        return await handleEndSession(req, supabase)

      case '/temporary-chat-api/health':
      case '/temporary-chat-api':  // Handle function base path for health check
      case '/health':
      case '/':  // Handle root path for health check
      case '':   // Handle empty path for health check
        return await handleHealthCheck(supabase)
      
      default:
        return new Response(
          JSON.stringify({ 
            error: 'Not Found',
            requested_path: path,
            available_endpoints: ['/validate', '/create-session', '/end-session', '/health'],
            debug: {
              full_url: req.url,
              pathname: url.pathname,
              method: req.method
            }
          }), 
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }
  } catch (error) {
    console.error('[temporary-chat-api] Global error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// =============================================================================
// ENDPOINT HANDLERS
// =============================================================================

async function handleValidateLinkToken(req: Request, supabase: any): Promise<Response> {
  try {
    const { token } = await req.json()
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Validating link token: ${token.substring(0, 8)}...`)
    console.log(`[temporary-chat-api] Token length: ${token.length}, contains newline: ${token.includes('\n')}`)

    // Query all active temporary_chat_links to find the matching token
    const { data: allLinks, error: linkError } = await supabase
      .from('temporary_chat_links')
      .select(`
        id,
        title,
        description,
        welcome_message,
        expires_at,
        max_sessions,
        max_messages_per_session,
        session_timeout_minutes,
        is_active,
        session_count,
        vault_link_token_id,
        agent_id,
        agents(name)
      `)
      .eq('is_active', true)

    if (linkError) {
      console.error('[temporary-chat-api] Link query error:', linkError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to validate chat link',
          details: linkError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!allLinks || allLinks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active chat links found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find the matching link by decrypting and comparing tokens
    let linkData = null;
    for (const link of allLinks) {
      try {
        const { data: decryptedToken, error: decryptError } = await supabase
          .rpc('vault_decrypt', { vault_id: link.vault_link_token_id })

        // Remove ALL whitespace and newlines for comparison
        const cleanDecrypted = decryptedToken?.replace(/[\r\n\s]/g, '');
        const cleanToken = token?.replace(/[\r\n\s]/g, '');
        
        if (!decryptError && cleanDecrypted && cleanDecrypted === cleanToken) {
          linkData = link;
          break;
        }
      } catch (err) {
        console.warn(`[temporary-chat-api] Failed to decrypt token for link ${link.id}:`, err)
        continue;
      }
    }

    if (!linkData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired chat link' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if link has expired
    const now = new Date()
    const expiresAt = new Date(linkData.expires_at)
    if (expiresAt < now) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Chat link has expired' 
        }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if max sessions reached
    if (linkData.session_count >= linkData.max_sessions) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Maximum number of chat sessions reached' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Link token validated successfully: ${linkData.title}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          link: {
            id: linkData.id,
            title: linkData.title,
            description: linkData.description,
            welcome_message: linkData.welcome_message,
            agent_name: linkData.agents?.name || 'AI Assistant',
            expires_at: linkData.expires_at,
            max_messages_per_session: linkData.max_messages_per_session,
            session_timeout_minutes: linkData.session_timeout_minutes,
            is_active: linkData.is_active
          }
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[temporary-chat-api] Link validation error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to validate chat link',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleValidateSession(req: Request, supabase: any): Promise<Response> {
  try {
    const { session_token }: ValidateSessionRequest = await req.json()
    
    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Missing session_token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Validating session token: ${session_token.substring(0, 8)}...`)

    // Use database function to validate session
    const { data, error } = await supabase.rpc('validate_temp_chat_session', {
      p_session_token: session_token
    })

    if (error) {
      console.error('[temporary-chat-api] Validation error:', error)
      return new Response(
        JSON.stringify({ error: 'Session validation failed', details: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!data || data.length === 0 || !data[0].is_valid) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired session',
          valid: false,
          reason: data?.[0] ? 'Session not valid' : 'Session not found'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sessionInfo = data[0]
    
    return new Response(
      JSON.stringify({
        valid: true,
        session_id: sessionInfo.session_id,
        agent_id: sessionInfo.agent_id,
        agent_name: sessionInfo.agent_name,
        conversation_id: sessionInfo.conversation_id,
        title: sessionInfo.title,
        description: sessionInfo.description,
        welcome_message: sessionInfo.welcome_message,
        max_messages: sessionInfo.max_messages_per_session,
        current_messages: sessionInfo.current_message_count,
        rate_limit: sessionInfo.rate_limit_per_minute,
        expires_at: sessionInfo.expires_at
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[temporary-chat-api] Validate session error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to validate session',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleCreateSession(req: Request, supabase: any): Promise<Response> {
  try {
    const { 
      link_token, 
      participant_identifier, 
      participant_name,
      metadata = {}
    }: CreateSessionRequest = await req.json()
    
    if (!link_token) {
      return new Response(
        JSON.stringify({ error: 'Missing link_token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Creating session for token: ${link_token.substring(0, 8)}...`)

    // Get client information for security tracking
    const clientIP = req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = req.headers.get('user-agent') || ''
    const referrer = req.headers.get('referer') || ''

    // Use database function to create session
    const { data, error } = await supabase.rpc('create_temp_chat_session', {
      p_link_token: link_token,
      p_participant_identifier: participant_identifier,
      p_participant_name: participant_name,
      p_ip_address: clientIP,
      p_user_agent: userAgent,
      p_referrer: referrer
    })

    if (error || !data || data.length === 0) {
      console.error('[temporary-chat-api] Create session error:', error)
      return new Response(
        JSON.stringify({ 
          error: data?.[0]?.error_message || 'Failed to create session',
          details: error?.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sessionData = data[0]
    
    if (!sessionData.is_valid) {
      return new Response(
        JSON.stringify({ 
          error: sessionData.error_message || 'Could not create valid session',
          valid: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Session created successfully: ${sessionData.session_id}`)
    console.log(`[temporary-chat-api] Initial message info - has_message: ${!!sessionData.initial_agent_message}, should_send: ${sessionData.should_send_initial}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          session: {
            id: sessionData.session_id,
            session_token: sessionData.session_token,
            conversation_id: sessionData.conversation_id,
            agent_id: sessionData.agent_id,
            agent_name: sessionData.agent_name,
            message_count: 0,
            status: 'active',
            // ✅ NEW: Include initial message info for frontend
            initial_agent_message: sessionData.initial_agent_message || null,
            should_send_initial: sessionData.should_send_initial || false
          }
        }
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[temporary-chat-api] Create session error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create session',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleEndSession(req: Request, supabase: any): Promise<Response> {
  try {
    const { 
      session_token,
      satisfaction_rating,
      feedback_text,
      end_reason = 'completed'
    } = await req.json()
    
    if (!session_token) {
      return new Response(
        JSON.stringify({ error: 'Missing session_token parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Ending session: ${session_token.substring(0, 8)}...`)

    // Use database function to end session
    const { data: success, error } = await supabase.rpc('end_temp_chat_session', {
      p_session_token: session_token,
      p_end_reason: end_reason,
      p_satisfaction_rating: satisfaction_rating,
      p_feedback_text: feedback_text
    })

    if (error) {
      console.error('[temporary-chat-api] End session error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to end session',
          details: error.message
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!success) {
      return new Response(
        JSON.stringify({ 
          error: 'Session not found or already ended',
          ended: false
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[temporary-chat-api] Session ended successfully`)

    return new Response(
      JSON.stringify({
        success: true,
        ended: true,
        end_reason: end_reason,
        ended_at: new Date().toISOString(),
        message: 'Session ended successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[temporary-chat-api] End session error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to end session',
        message: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function handleHealthCheck(supabase: any): Promise<Response> {
  try {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        message: 'Temporary Chat API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: {
          supabase_url: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
          service_role_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? 'configured' : 'missing'
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[temporary-chat-api] Health check error:', error)
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}
