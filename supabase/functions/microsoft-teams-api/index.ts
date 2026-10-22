import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TeamsApiRequest {
  action: 'send_message' | 'create_meeting' | 'read_messages' | 'list_teams' | 'exchange_code'
  params?: {
    channel_id?: string
    chat_id?: string
    message?: string
    message_type?: 'text' | 'html'
    subject?: string
    start_time?: string
    end_time?: string
    attendees?: string[]
    limit?: number
  }
  agent_id?: string
  // OAuth token exchange parameters
  code?: string
  code_verifier?: string
  redirect_uri?: string
  user_id?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log(`[microsoft-teams-api] Raw request method: ${req.method}`)
    console.log(`[microsoft-teams-api] Raw request headers:`, Object.fromEntries(req.headers.entries()))
    
    let requestBody: TeamsApiRequest
    try {
      const rawText = await req.text()
      console.log(`[microsoft-teams-api] Raw request body:`, rawText)
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Request body is empty')
      }
      
      requestBody = JSON.parse(rawText)
      console.log(`[microsoft-teams-api] Parsed request body:`, JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error(`[microsoft-teams-api] JSON parse error:`, parseError)
      throw new Error(`Failed to parse request body: ${parseError.message}`)
    }
    
    const { action, params, agent_id, code, code_verifier, redirect_uri, user_id: oauth_user_id } = requestBody
    console.log('Microsoft Teams API request:', { action, agent_id })
    console.log('Params received:', JSON.stringify(params, null, 2))

    // Handle OAuth token exchange separately (doesn't need existing connection or agent_id)
    if (action === 'exchange_code') {
      if (!code || !code_verifier || !redirect_uri || !oauth_user_id) {
        throw new Error('Missing required OAuth parameters: code, code_verifier, redirect_uri, user_id')
      }

      console.log(`[microsoft-teams-api] Processing OAuth token exchange for user: ${oauth_user_id}`)
      
      const result = await exchangeOAuthCode(code, code_verifier, redirect_uri, oauth_user_id)
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Validate required parameters for other actions
    if (!action || !params || !agent_id) {
      console.error('Missing parameters:', { action: !!action, params: !!params, agent_id: !!agent_id })
      
      if (!action) {
        throw new Error('Question: What Teams action would you like me to perform? Please specify send_message, create_meeting, read_messages, or list_teams.')
      }
      if (!agent_id) {
        throw new Error('Missing agent context. Please retry with proper agent identification.')
      }
      if (!params) {
        throw new Error('Question: What Teams details would you like me to use? Please provide the required parameters for the action.')
      }
      
      throw new Error('Please provide the required Teams parameters: action, details, and agent context.')
    }

    // Create Supabase clients
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    const user_id = user.id
    console.log(`[microsoft-teams-api] Processing request for user: ${user_id}, agent: ${agent_id}`)

    // Validate agent permissions
    const { data: permissionData, error: permissionError } = await supabaseServiceRole
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        user_integration_credentials!inner(
          oauth_provider_id,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('user_integration_credentials.service_providers.name', 'microsoft-teams')
      .eq('is_active', true)
      .single()

    if (permissionError || !permissionData) {
      throw new Error(`No Microsoft Teams permissions found for agent: ${permissionError?.message || 'None'}`)
    }

    // Get user's Microsoft Teams access token from integration credentials
    const { data: teamsProvider, error: providerError } = await supabaseServiceRole
      .from('service_providers')
      .select('id')
      .eq('name', 'microsoft-teams')
      .single()

    if (providerError || !teamsProvider) {
      throw new Error(`Microsoft Teams OAuth provider not found: ${providerError?.message || 'Not found'}`)
    }

    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .select('vault_access_token_id, vault_refresh_token_id, token_expires_at, connection_status, created_at, updated_at')
      .eq('user_id', user_id)
      .eq('oauth_provider_id', teamsProvider.id)
      .eq('connection_status', 'active')
      .single()

    console.log('[microsoft-teams-api] Connection query result:', {
      connection,
      connectionError,
      user_id: user_id,
      teams_provider_id: teamsProvider.id
    })

    if (connectionError || !connection) {
      const { data: allConnections } = await supabaseServiceRole
        .from('user_integration_credentials')
        .select('id, connection_status, oauth_provider_id, created_at, updated_at')
        .eq('user_id', user_id)
      
      console.log('[microsoft-teams-api] All user connections:', allConnections)
      
      throw new Error(`No active Microsoft Teams connection found: ${connectionError?.message || 'Not found'}`)
    }

    let accessToken: string
    
    // Check if token is expired and refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      console.log('[microsoft-teams-api] Access token expired, attempting refresh...')
      
      // Get refresh token from vault
      const { data: refreshTokenData, error: refreshTokenError } = await supabaseServiceRole
        .from('vault.secrets')
        .select('secret')
        .eq('id', connection.vault_refresh_token_id)
        .single()

      if (refreshTokenError || !refreshTokenData) {
        throw new Error(`Failed to get refresh token: ${refreshTokenError?.message || 'Not found'}`)
      }

      // Refresh the access token using Microsoft Graph API
      const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshTokenData.secret,
          client_id: Deno.env.get('MICROSOFT_TEAMS_CLIENT_ID')!,
          client_secret: Deno.env.get('MICROSOFT_TEAMS_CLIENT_SECRET')!,
        }),
      })

      if (!refreshResponse.ok) {
        throw new Error(`Failed to refresh Microsoft Teams token: ${refreshResponse.statusText}`)
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update the access token in vault
      await supabaseServiceRole
        .from('vault.secrets')
        .update({ secret: accessToken })
        .eq('id', connection.vault_access_token_id)

      // Update token expiry
      const newExpiryTime = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
      await supabaseServiceRole
        .from('user_integration_credentials')
        .update({ token_expires_at: newExpiryTime })
        .eq('user_id', user_id)
        .eq('oauth_provider_id', teamsProvider.id)

      console.log('[microsoft-teams-api] Token refreshed successfully')
    } else {
      // Get current access token from vault
      const { data: tokenData, error: tokenError } = await supabaseServiceRole
        .from('vault.secrets')
        .select('secret')
        .eq('id', connection.vault_access_token_id)
        .single()

      if (tokenError || !tokenData) {
        throw new Error(`Failed to get access token: ${tokenError?.message || 'Not found'}`)
      }

      accessToken = tokenData.secret
    }

    // Execute the requested action
    let result: any

    switch (action) {
      case 'send_message':
        result = await sendTeamsMessage(accessToken, params)
        break
      case 'create_meeting':
        result = await createTeamsMeeting(accessToken, params)
        break
      case 'read_messages':
        result = await readTeamsMessages(accessToken, params)
        break
      case 'list_teams':
        result = await listUserTeams(accessToken, params)
        break
      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    // Log the operation
    await supabaseServiceRole
      .from('tool_execution_logs')
      .insert({
        user_id: user_id,
        agent_id: agent_id,
        tool_name: 'microsoft_teams_api',
        operation_type: action,
        operation_params: params,
        operation_result: result,
        status: 'success',
        execution_time_ms: Date.now() - parseInt(req.headers.get('x-request-start') || '0')
      })

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('[microsoft-teams-api] Error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})

// Helper functions for Microsoft Teams API operations
async function sendTeamsMessage(accessToken: string, params: any) {
  const { channel_id, chat_id, message, message_type = 'text' } = params

  if (!message) {
    throw new Error('Message content is required')
  }

  if (!channel_id && !chat_id) {
    throw new Error('Either channel_id or chat_id is required')
  }

  let endpoint: string
  if (channel_id) {
    endpoint = `https://graph.microsoft.com/v1.0/teams/${channel_id.split('@')[0]}/channels/${channel_id}/messages`
  } else {
    endpoint = `https://graph.microsoft.com/v1.0/chats/${chat_id}/messages`
  }

  const messageBody = {
    body: {
      contentType: message_type,
      content: message
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to send Teams message: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function createTeamsMeeting(accessToken: string, params: any) {
  const { subject, start_time, end_time, attendees = [] } = params

  if (!subject || !start_time || !end_time) {
    throw new Error('Subject, start_time, and end_time are required')
  }

  const meetingBody = {
    subject: subject,
    startDateTime: start_time,
    endDateTime: end_time,
    participants: {
      attendees: attendees.map((email: string) => ({
        identity: {
          user: {
            id: email
          }
        }
      }))
    }
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(meetingBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to create Teams meeting: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function readTeamsMessages(accessToken: string, params: any) {
  const { channel_id, chat_id, limit = 50 } = params

  if (!channel_id && !chat_id) {
    throw new Error('Either channel_id or chat_id is required')
  }

  let endpoint: string
  if (channel_id) {
    endpoint = `https://graph.microsoft.com/v1.0/teams/${channel_id.split('@')[0]}/channels/${channel_id}/messages?$top=${limit}`
  } else {
    endpoint = `https://graph.microsoft.com/v1.0/chats/${chat_id}/messages?$top=${limit}`
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to read Teams messages: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function listUserTeams(accessToken: string, params: any) {
  const { limit = 50 } = params

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/joinedTeams?$top=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to list user teams: ${response.status} ${errorText}`)
  }

  return await response.json()
}

// OAuth token exchange function
async function exchangeOAuthCode(code: string, codeVerifier: string, redirectUri: string, userId: string) {
  console.log(`[microsoft-teams-api] Starting OAuth token exchange for user: ${userId}`)

  // Create Supabase client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Get Microsoft Teams provider
  const { data: provider, error: providerError } = await supabaseServiceRole
    .from('service_providers')
    .select('id, token_endpoint')
    .eq('name', 'microsoft-teams')
    .single()

  if (providerError || !provider) {
    throw new Error(`Microsoft Teams provider not found: ${providerError?.message || 'Not found'}`)
  }

  // Exchange code for tokens using Microsoft Graph API
  const tokenResponse = await fetch(provider.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: Deno.env.get('MICROSOFT_TEAMS_CLIENT_ID')!,
      client_secret: Deno.env.get('MICROSOFT_TEAMS_CLIENT_SECRET')!,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text()
    throw new Error(`Token exchange failed: ${errorData}`)
  }

  const tokens = await tokenResponse.json()

  if (!tokens.access_token) {
    throw new Error('No access token received from Microsoft')
  }

  console.log(`[microsoft-teams-api] Successfully received tokens, storing in vault...`)

  // Store tokens in Supabase Vault
  const { data: accessTokenVault, error: accessTokenError } = await supabaseServiceRole
    .from('vault.secrets')
    .insert({
      name: `teams_access_token_${userId}_${Date.now()}`,
      secret: tokens.access_token
    })
    .select('id')
    .single()

  if (accessTokenError) {
    throw new Error(`Failed to store access token: ${accessTokenError.message}`)
  }

  let refreshTokenVaultId = null
  if (tokens.refresh_token) {
    const { data: refreshTokenVault, error: refreshTokenError } = await supabaseServiceRole
      .from('vault.secrets')
      .insert({
        name: `teams_refresh_token_${userId}_${Date.now()}`,
        secret: tokens.refresh_token
      })
      .select('id')
      .single()

    if (refreshTokenError) {
      throw new Error(`Failed to store refresh token: ${refreshTokenError.message}`)
    }
    refreshTokenVaultId = refreshTokenVault.id
  }

  // Store connection in user_integration_credentials
  const TEAMS_SCOPES = [
    'https://graph.microsoft.com/Chat.ReadWrite',
    'https://graph.microsoft.com/Team.ReadBasic.All', 
    'https://graph.microsoft.com/Channel.ReadBasic.All',
    'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
    'https://graph.microsoft.com/User.Read'
  ]

  const { data: connectionData, error: insertError } = await supabaseServiceRole
    .from('user_integration_credentials')
    .insert({
      user_id: userId,
      oauth_provider_id: provider.id,
      external_user_id: userId,
      external_username: 'teams_user', // Will be updated with actual username later
      connection_name: 'Microsoft Teams Connection',
      vault_access_token_id: accessTokenVault.id,
      vault_refresh_token_id: refreshTokenVaultId,
      scopes_granted: TEAMS_SCOPES,
      connection_status: 'active',
      credential_type: 'oauth',
      token_expires_at: tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      connection_metadata: {
        provider: 'microsoft-teams',
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope
      }
    })
    .select('*')
    .single()

  if (insertError) {
    throw new Error(`Failed to create connection: ${insertError.message}`)
  }

  console.log(`[microsoft-teams-api] Successfully created connection: ${connectionData.id}`)

  return {
    connection_id: connectionData.id,
    connection_name: connectionData.connection_name,
    scopes_granted: connectionData.scopes_granted,
    expires_at: connectionData.token_expires_at
  }
}
