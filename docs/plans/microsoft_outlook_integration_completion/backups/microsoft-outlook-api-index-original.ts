import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface UserProfile {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseServiceRole = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { action, ...params } = await req.json()

    // Skip validation for exchange_code action
    if (action !== 'exchange_code') {
      // Validate required parameters for other actions
      const { agent_id, user_id } = params
      
      if (!agent_id || !user_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Missing agent context. Please retry with proper agent identification.' 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    switch (action) {
      case 'exchange_code':
        return await exchangeOAuthCode(supabaseServiceRole, params)
      
      case 'refresh_token':
        return await refreshAccessToken(supabaseServiceRole, params)
      
      case 'send_email':
        return await sendEmail(supabaseServiceRole, params)
      
      case 'get_emails':
        return await getEmails(supabaseServiceRole, params)
      
      case 'create_calendar_event':
        return await createCalendarEvent(supabaseServiceRole, params)
      
      case 'get_calendar_events':
        return await getCalendarEvents(supabaseServiceRole, params)
      
      case 'get_contacts':
        return await getContacts(supabaseServiceRole, params)
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }
  } catch (error) {
    console.error('[microsoft-outlook-api] Error:', error)
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

async function exchangeOAuthCode(supabaseServiceRole: any, params: any) {
  const { code, code_verifier, user_id, redirect_uri } = params

  if (!code || !code_verifier || !user_id || !redirect_uri) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required parameters' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get service provider configuration
    const { data: provider, error: providerError } = await supabaseServiceRole
      .from('service_providers')
      .select('*')
      .eq('name', 'microsoft-outlook')
      .single()

    if (providerError || !provider) {
      console.error('Provider fetch error:', providerError)
      return new Response(
        JSON.stringify({ success: false, error: 'Service provider not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(provider.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        code_verifier,
        client_id: Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_ID')!,
        client_secret: Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_SECRET')!,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return new Response(
        JSON.stringify({ success: false, error: `Token exchange failed: ${errorText}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokens: TokenResponse = await tokenResponse.json()

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!profileResponse.ok) {
      console.error('Failed to fetch user profile')
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch user profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const profile: UserProfile = await profileResponse.json()

    // Store access token in Vault
    const accessTokenName = `outlook_access_token_${user_id}_${Date.now()}`
    const { data: accessTokenVaultId, error: accessTokenError } = await supabaseServiceRole.rpc('create_vault_secret', {
      p_secret: tokens.access_token,
      p_name: accessTokenName,
      p_description: 'Microsoft Outlook access token'
    })

    if (accessTokenError) {
      console.error('Failed to store access token:', accessTokenError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store refresh token in Vault
    const refreshTokenName = `outlook_refresh_token_${user_id}_${Date.now()}`
    const { data: refreshTokenVaultId, error: refreshTokenError } = await supabaseServiceRole.rpc('create_vault_secret', {
      p_secret: tokens.refresh_token,
      p_name: refreshTokenName,
      p_description: 'Microsoft Outlook refresh token'
    })

    if (refreshTokenError) {
      console.error('Failed to store refresh token:', refreshTokenError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store refresh token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate expiry date
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))

    // Store connection in user_integration_credentials
    const { error: credentialError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .insert({
        user_id,
        oauth_provider_id: provider.id,
        external_user_id: profile.id,
        external_username: profile.mail || profile.userPrincipalName,
        connection_name: `${profile.displayName} (${profile.mail})`,
        access_token_vault_id: accessTokenVaultId,
        refresh_token_vault_id: refreshTokenVaultId,
        scopes_granted: tokens.scope.split(' '),
        token_expires_at: expiresAt.toISOString(),
        connection_status: 'active',
        credential_type: 'oauth2'
      })

    if (credentialError) {
      console.error('Failed to store credentials:', credentialError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_profile: {
          name: profile.displayName,
          email: profile.mail || profile.userPrincipalName
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('OAuth exchange error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function refreshAccessToken(supabaseServiceRole: any, params: any) {
  const { user_id, connection_id } = params

  try {
    // Get connection details
    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user_id)
      .single()

    if (connectionError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get refresh token from Vault
    const { data: refreshTokenData, error: refreshTokenError } = await supabaseServiceRole.rpc('vault_decrypt', {
      secret_id: connection.refresh_token_vault_id
    })

    if (refreshTokenError || !refreshTokenData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to retrieve refresh token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get service provider
    const { data: provider } = await supabaseServiceRole
      .from('service_providers')
      .select('*')
      .eq('name', 'microsoft-outlook')
      .single()

    // Refresh the token
    const refreshResponse = await fetch(provider.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenData,
        client_id: Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_ID')!,
        client_secret: Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_SECRET')!,
      }),
    })

    if (!refreshResponse.ok) {
      throw new Error(`Failed to refresh Microsoft Outlook token: ${refreshResponse.statusText}`)
    }

    const tokens: TokenResponse = await refreshResponse.json()

    // Store new access token
    const newAccessTokenName = `outlook_access_token_${user_id}_${Date.now()}`
    const { data: newAccessTokenVaultId } = await supabaseServiceRole.rpc('create_vault_secret', {
      p_secret: tokens.access_token,
      p_name: newAccessTokenName,
      p_description: 'Microsoft Outlook access token (refreshed)'
    })

    // Store new refresh token if provided
    let newRefreshTokenVaultId = connection.refresh_token_vault_id
    if (tokens.refresh_token) {
      const newRefreshTokenName = `outlook_refresh_token_${user_id}_${Date.now()}`
      const { data: refreshVaultId } = await supabaseServiceRole.rpc('create_vault_secret', {
        p_secret: tokens.refresh_token,
        p_name: newRefreshTokenName,
        p_description: 'Microsoft Outlook refresh token (refreshed)'
      })
      newRefreshTokenVaultId = refreshVaultId
    }

    // Update connection with new tokens
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000))
    await supabaseServiceRole
      .from('user_integration_credentials')
      .update({
        access_token_vault_id: newAccessTokenVaultId,
        refresh_token_vault_id: newRefreshTokenVaultId,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', connection_id)

    return new Response(
      JSON.stringify({ 
        success: true,
        expires_at: expiresAt.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Token refresh error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Placeholder functions for email, calendar, and contacts functionality
async function sendEmail(supabaseServiceRole: any, params: any) {
  return new Response(
    JSON.stringify({ success: false, error: 'Email functionality not yet implemented' }),
    { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getEmails(supabaseServiceRole: any, params: any) {
  return new Response(
    JSON.stringify({ success: false, error: 'Email functionality not yet implemented' }),
    { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function createCalendarEvent(supabaseServiceRole: any, params: any) {
  return new Response(
    JSON.stringify({ success: false, error: 'Calendar functionality not yet implemented' }),
    { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getCalendarEvents(supabaseServiceRole: any, params: any) {
  return new Response(
    JSON.stringify({ success: false, error: 'Calendar functionality not yet implemented' }),
    { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getContacts(supabaseServiceRole: any, params: any) {
  return new Response(
    JSON.stringify({ success: false, error: 'Contacts functionality not yet implemented' }),
    { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}