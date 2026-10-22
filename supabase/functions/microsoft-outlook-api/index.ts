/**
 * Microsoft Outlook Integration - Main Handler
 * Routes requests to appropriate operation modules
 * Follows existing Gmail integration patterns with modular architecture
 * Version: Added support for custom connection names
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Import modular components
import { validateRequest, formatResponse, getRequiredScopes, OutlookAPIRequest } from './outlook-utils.ts'
import { createOutlookGraphClient } from './outlook-graph-client.ts'
import { handleEmailOperation } from './outlook-email-operations.ts'
import { handleCalendarOperation } from './outlook-calendar-operations.ts'
import { handleContactOperation } from './outlook-contact-operations.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Legacy OAuth interfaces for backward compatibility
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

/**
 * Action routing configuration
 */
const ACTION_ROUTING = {
  // Email actions
  'send_email': { module: 'email', handler: handleEmailOperation },
  'get_emails': { module: 'email', handler: handleEmailOperation },
  'search_emails': { module: 'email', handler: handleEmailOperation },
  
  // Calendar actions
  'create_calendar_event': { module: 'calendar', handler: handleCalendarOperation },
  'get_calendar_events': { module: 'calendar', handler: handleCalendarOperation },
  
  // Contact actions
  'get_contacts': { module: 'contact', handler: handleContactOperation },
  'search_contacts': { module: 'contact', handler: handleContactOperation }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client with service role key
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Debug logging for incoming request
    console.log(`[outlook-api] Raw request method: ${req.method}`);
    console.log(`[outlook-api] Raw request headers:`, Object.fromEntries(req.headers.entries()));
    
    let requestBody: any;
    try {
      const rawText = await req.text();
      console.log(`[outlook-api] Raw request body:`, rawText);
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Request body is empty');
      }
      
      requestBody = JSON.parse(rawText);
      console.log(`[outlook-api] Parsed request body:`, JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error(`[outlook-api] JSON parse error:`, parseError);
      throw new Error(`Failed to parse request body: ${parseError.message}`);
    }

    const { action, params: rawParams, ...otherParams } = requestBody;
    
    // Handle parameter format - check if params.input contains JSON string
    let params = rawParams || {};
    if (params.input && typeof params.input === 'string') {
      try {
        // Parse the JSON string in the input field
        const parsedInput = JSON.parse(params.input);
        params = { ...params, ...parsedInput };
        delete params.input; // Remove the input field after parsing
      } catch (parseError) {
        console.warn('[outlook-api] Failed to parse params.input as JSON:', parseError);
        // Keep original params if parsing fails
      }
    }
    
    const fullRequest = { action, params, ...otherParams };
    console.log('Outlook API request:', fullRequest);

    // Handle legacy OAuth actions first (maintain backward compatibility)
    if (action === 'initiate_oauth') {
      return await initiateOAuthFlow(fullRequest);
    }
    
    if (action === 'exchange_code') {
      return await exchangeOAuthCode(supabaseServiceRole, fullRequest);
    }
    
    if (action === 'refresh_token') {
      return await refreshAccessToken(supabaseServiceRole, fullRequest);
    }

    // For all other actions, use the new modular system
    const { agent_id, user_id } = fullRequest;

    // Validate request structure for tool actions
    const toolRequest: OutlookAPIRequest = {
      action,
      params,
      agent_id,
      user_id
    };

    const validation = validateRequest(toolRequest);
    if (!validation.valid) {
      const errorMessage = validation.errors[0]; // Return first error as LLM-friendly message
      console.error('Request validation failed:', validation.errors);
      
      // Check if this is an interactive question that should trigger retry
      const isInteractiveQuestion = errorMessage.toLowerCase().startsWith('question:');
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          requires_retry: isInteractiveQuestion  // Enable retry mechanism for questions
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate agent permissions for Outlook
    const requiredScopes = getRequiredScopes(action);
    console.log('[outlook-api] Validating permissions:', {
      agent_id,
      user_id,
      action,
      requiredScopes
    });

    const { data: hasPermissions, error: permissionError } = await supabaseServiceRole.rpc(
      'validate_agent_outlook_permissions',
      {
        p_agent_id: agent_id,
        p_user_id: user_id,
        p_required_scopes: requiredScopes
      }
    );

    if (permissionError) {
      console.error('[outlook-api] Permission validation error:', permissionError);
      throw new Error('Question: I had trouble checking your Outlook permissions. Please ensure your Outlook account is properly connected.');
    }

    if (!hasPermissions) {
      console.error('[outlook-api] Agent lacks required permissions');
      throw new Error('Question: I don\'t have permission to access your Outlook account. Please grant the necessary permissions in your agent settings.');
    }

    // Create Microsoft Graph API client
    console.log('[outlook-api] Creating Graph API client');
    const graphClient = await createOutlookGraphClient(user_id, agent_id, supabaseServiceRole);

    // Route action to appropriate handler
    const routing = ACTION_ROUTING[action as keyof typeof ACTION_ROUTING];
    if (!routing) {
      throw new Error(`Question: I don't recognize the Outlook action "${action}". Available actions are: ${Object.keys(ACTION_ROUTING).join(', ')}.`);
    }

    console.log(`[outlook-api] Routing action "${action}" to ${routing.module} module`);
    
    // Execute the operation
    const result = await routing.handler(action, params, graphClient, {
      agentId: agent_id,
      userId: user_id
    });

    // Format and return successful response
    const response = formatResponse(result, action, { agentId: agent_id, userId: user_id });
    response.metadata!.execution_time = Date.now() - startTime;
    
    console.log(`[outlook-api] Request completed successfully in ${response.metadata!.execution_time}ms`);
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[outlook-api] Request failed:', error);
    
    // Format error response
    const errorResponse = {
      success: false,
      error: error.message || 'An unexpected error occurred',
      metadata: {
        execution_time: Date.now() - startTime,
        error_type: error.constructor.name
      }
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})

// Legacy OAuth functions (maintain backward compatibility)
async function initiateOAuthFlow(params: any) {
  const { user_id, redirect_uri } = params;

  if (!user_id || !redirect_uri) {
    return new Response(
      JSON.stringify({ success: false, error: 'Missing required parameters: user_id, redirect_uri' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get client ID from Supabase secrets (not from database)
    const clientId = Deno.env.get('MICROSOFT_OUTLOOK_CLIENT_ID');
    
    if (!clientId) {
      console.error('Microsoft Outlook Client ID not configured in secrets');
      return new Response(
        JSON.stringify({ success: false, error: 'Microsoft Outlook integration not properly configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Required scopes for Microsoft Graph API
    const requiredScopes = [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send', 
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Calendars.Read',
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Contacts.Read',
      'https://graph.microsoft.com/User.Read',
      'offline_access'  // Required for refresh tokens
    ];

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      scope: requiredScopes.join(' '),
      redirect_uri: redirect_uri,
      response_type: 'code',
      state: `outlook_${user_id}_${Date.now()}`,
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
    
    return new Response(
      JSON.stringify({
        success: true,
        auth_url: authUrl,
        code_verifier: codeVerifier,
        state: `outlook_${user_id}_${Date.now()}`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    return new Response(
      JSON.stringify({ success: false, error: `Failed to initiate OAuth flow: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// PKCE helper functions
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function exchangeOAuthCode(supabaseServiceRole: any, params: any) {
  const { code, code_verifier, user_id, connection_name, redirect_uri } = params

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
    
    // Debug: Check if refresh_token exists
    console.log('Refresh token exists:', !!tokens.refresh_token)
    console.log('Refresh token type:', typeof tokens.refresh_token)
    
    if (!tokens.refresh_token) {
      console.error('Warning: No refresh token received from Microsoft')
      // Some OAuth flows don't return refresh tokens on every exchange
      // We'll use a placeholder for now
    }
    
    const vaultParams = {
      p_secret: tokens.refresh_token || 'NO_REFRESH_TOKEN_PROVIDED',
      p_name: refreshTokenName,
      p_description: 'Microsoft Outlook refresh token'
    }
    
    console.log('Calling create_vault_secret with params:', JSON.stringify(vaultParams))
    
    const { data: refreshTokenVaultId, error: refreshTokenError } = await supabaseServiceRole.rpc('create_vault_secret', vaultParams)

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
    const { data: insertedCredential, error: credentialError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .insert({
        user_id,
        oauth_provider_id: provider.id,
        external_user_id: profile.id,
        external_username: profile.mail || profile.userPrincipalName,
        connection_name: connection_name || `${profile.displayName} (${profile.mail})`,
        vault_access_token_id: accessTokenVaultId,
        vault_refresh_token_id: refreshTokenVaultId,
        scopes_granted: tokens.scope.split(' '),
        token_expires_at: expiresAt.toISOString(),
        connection_status: 'active',
        credential_type: 'oauth'
      })
      .select('id')
      .single()

    if (credentialError) {
      console.error('Failed to store credentials:', credentialError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Automatically grant permissions to all user's agents
    try {
      console.log('[outlook-api] Auto-granting permissions to user agents')
      
      // Get all agents that the user has access to
      const { data: userAgents, error: agentsError } = await supabaseServiceRole
        .from('agents')
        .select('id')
        .eq('user_id', user_id)

      if (agentsError) {
        console.error('Failed to fetch user agents:', agentsError)
        // Don't fail the OAuth flow, just log the error
      } else if (userAgents && userAgents.length > 0) {
        // Use the Microsoft Graph API scopes that were requested and granted
        // These should match what getRequiredScopes() returns for validation
        const grantedScopes = [
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/Mail.Send', 
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/Calendars.Read',
          'https://graph.microsoft.com/Calendars.ReadWrite',
          'https://graph.microsoft.com/Contacts.Read',
          'https://graph.microsoft.com/User.Read'
        ]
        
        // Create permission records for all user's agents
        const permissionInserts = userAgents.map(agent => ({
          agent_id: agent.id,
          user_oauth_connection_id: insertedCredential.id,
          granted_by_user_id: user_id,
          permission_level: 'custom',
          allowed_scopes: grantedScopes,
          is_active: true
        }))

        const { error: permissionsError } = await supabaseServiceRole
          .from('agent_integration_permissions')
          .insert(permissionInserts)

        if (permissionsError) {
          console.error('Failed to auto-grant agent permissions:', permissionsError)
          // Don't fail the OAuth flow, just log the error
        } else {
          console.log(`[outlook-api] Successfully granted permissions to ${userAgents.length} agents`)
        }
      }
    } catch (autoGrantError) {
      console.error('Error during auto-grant permissions:', autoGrantError)
      // Don't fail the OAuth flow, just log the error
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
      secret_id: connection.vault_refresh_token_id
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
    let newRefreshTokenVaultId = connection.vault_refresh_token_id
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
        vault_access_token_id: newAccessTokenVaultId,
        vault_refresh_token_id: newRefreshTokenVaultId,
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