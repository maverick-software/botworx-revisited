import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OneDriveApiRequest {
  action: 'upload_file' | 'download_file' | 'share_file' | 'list_files' | 'search_files' | 'exchange_code'
  params?: {
    file_name?: string
    file_content?: string
    folder_path?: string
    conflict_behavior?: 'fail' | 'replace' | 'rename'
    file_id?: string
    file_path?: string
    link_type?: 'view' | 'edit' | 'embed'
    scope?: 'anonymous' | 'organization'
    limit?: number
    query?: string
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
    console.log(`[microsoft-onedrive-api] Raw request method: ${req.method}`)
    console.log(`[microsoft-onedrive-api] Raw request headers:`, Object.fromEntries(req.headers.entries()))
    
    let requestBody: OneDriveApiRequest
    try {
      const rawText = await req.text()
      console.log(`[microsoft-onedrive-api] Raw request body:`, rawText)
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Request body is empty')
      }
      
      requestBody = JSON.parse(rawText)
      console.log(`[microsoft-onedrive-api] Parsed request body:`, JSON.stringify(requestBody, null, 2))
    } catch (parseError) {
      console.error(`[microsoft-onedrive-api] JSON parse error:`, parseError)
      throw new Error(`Failed to parse request body: ${parseError.message}`)
    }
    
    const { action, params, agent_id, code, code_verifier, redirect_uri, user_id: oauth_user_id } = requestBody
    console.log('Microsoft OneDrive API request:', { action, agent_id })
    console.log('Params received:', JSON.stringify(params, null, 2))

    // Handle OAuth token exchange separately (doesn't need existing connection or agent_id)
    if (action === 'exchange_code') {
      if (!code || !code_verifier || !redirect_uri || !oauth_user_id) {
        throw new Error('Missing required OAuth parameters: code, code_verifier, redirect_uri, user_id')
      }

      console.log(`[microsoft-onedrive-api] Processing OAuth token exchange for user: ${oauth_user_id}`)
      
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

    // Validate required parameters for other actions (not needed for exchange_code)
    if (!action) {
      throw new Error('Question: What OneDrive action would you like me to perform? Please specify upload_file, download_file, share_file, list_files, or search_files.')
    }
    
    if (!params || !agent_id) {
      console.error('Missing parameters:', { action: !!action, params: !!params, agent_id: !!agent_id })
      
      if (!agent_id) {
        throw new Error('Missing agent context. Please retry with proper agent identification.')
      }
      if (!params) {
        throw new Error('Question: What OneDrive details would you like me to use? Please provide the required parameters for the action.')
      }
      
      throw new Error('Please provide the required OneDrive parameters: action, details, and agent context.')
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
    console.log(`[microsoft-onedrive-api] Processing request for user: ${user_id}, agent: ${agent_id}`)

    // Validate agent permissions
    const { data: permissionData, error: permissionError } = await supabaseServiceRole
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        user_integration_credentials!agent_integration_permissions_user_oauth_connection_id_fkey(
          oauth_provider_id,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('user_integration_credentials.service_providers.name', 'microsoft-onedrive')
      .eq('is_active', true)

    if (permissionError || !permissionData || permissionData.length === 0) {
      console.error('[microsoft-onedrive-api] Permission query error:', permissionError)
      console.log('[microsoft-onedrive-api] Permission data:', permissionData)
      throw new Error(`No Microsoft OneDrive permissions found for agent: ${permissionError?.message || 'None'}`)
    }

    // Use the first permission record if multiple exist
    const permission = Array.isArray(permissionData) ? permissionData[0] : permissionData

    // Get user's Microsoft OneDrive access token from integration credentials
    const { data: onedriveProvider, error: providerError } = await supabaseServiceRole
      .from('service_providers')
      .select('id')
      .eq('name', 'microsoft-onedrive')
      .single()

    if (providerError || !onedriveProvider) {
      throw new Error(`Microsoft OneDrive OAuth provider not found: ${providerError?.message || 'Not found'}`)
    }

    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .select('vault_access_token_id, vault_refresh_token_id, token_expires_at, connection_status, created_at, updated_at')
      .eq('user_id', user_id)
      .eq('oauth_provider_id', onedriveProvider.id)
      .eq('connection_status', 'active')
      .single()

    console.log('[microsoft-onedrive-api] Connection query result:', {
      connection,
      connectionError,
      user_id: user_id,
      onedrive_provider_id: onedriveProvider.id
    })

    if (connectionError || !connection) {
      const { data: allConnections } = await supabaseServiceRole
        .from('user_integration_credentials')
        .select('id, connection_status, oauth_provider_id, created_at, updated_at')
        .eq('user_id', user_id)
      
      console.log('[microsoft-onedrive-api] All user connections:', allConnections)
      
      throw new Error(`No active Microsoft OneDrive connection found: ${connectionError?.message || 'Not found'}`)
    }

    let accessToken: string
    
    // Check if token is expired and refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      console.log('[microsoft-onedrive-api] Access token expired, attempting refresh...')
      
      // Get refresh token from vault
      const { data: refreshTokenData, error: refreshTokenError } = await supabaseServiceRole
        .rpc('vault_decrypt', {
          vault_id: connection.vault_refresh_token_id
        })

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
          refresh_token: refreshTokenData,
          client_id: Deno.env.get('MICROSOFT_ONEDRIVE_CLIENT_ID')!,
          client_secret: Deno.env.get('MICROSOFT_ONEDRIVE_CLIENT_SECRET')!,
        }),
      })

      if (!refreshResponse.ok) {
        throw new Error(`Failed to refresh Microsoft OneDrive token: ${refreshResponse.statusText}`)
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update the access token in vault
      await supabaseServiceRole
        .rpc('create_vault_secret', {
          p_secret: accessToken,
          p_name: connection.vault_access_token_id,
          p_description: `Updated OneDrive access token for user ${user_id}`
        })

      // Update token expiry
      const newExpiryTime = new Date(Date.now() + refreshData.expires_in * 1000).toISOString()
      await supabaseServiceRole
        .from('user_integration_credentials')
        .update({ token_expires_at: newExpiryTime })
        .eq('user_id', user_id)
        .eq('oauth_provider_id', onedriveProvider.id)

      console.log('[microsoft-onedrive-api] Token refreshed successfully')
    } else {
      // Get current access token from vault
      const { data: tokenData, error: tokenError } = await supabaseServiceRole
        .rpc('vault_decrypt', {
          vault_id: connection.vault_access_token_id
        })

      if (tokenError || !tokenData) {
        throw new Error(`Failed to get access token: ${tokenError?.message || 'Not found'}`)
      }

      accessToken = tokenData
    }

    // Execute the requested action
    let result: any

    switch (action) {
      case 'upload_file':
        result = await uploadOneDriveFile(accessToken, params)
        break
      case 'download_file':
        result = await downloadOneDriveFile(accessToken, params)
        break
      case 'share_file':
        result = await shareOneDriveFile(accessToken, params)
        break
      case 'list_files':
        result = await listOneDriveFiles(accessToken, params)
        break
      case 'search_files':
        result = await searchOneDriveFiles(accessToken, params)
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
        tool_name: 'microsoft_onedrive_api',
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
    console.error('[microsoft-onedrive-api] Error:', error)
    
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

// Helper functions for Microsoft OneDrive API operations
async function uploadOneDriveFile(accessToken: string, params: any) {
  const { file_name, file_content, folder_path = '/', conflict_behavior = 'rename' } = params

  if (!file_name || !file_content) {
    throw new Error('File name and content are required')
  }

  // Decode base64 content
  let fileBuffer: Uint8Array
  try {
    fileBuffer = Uint8Array.from(atob(file_content), c => c.charCodeAt(0))
  } catch (error) {
    throw new Error('Invalid base64 file content')
  }

  // Construct the upload path
  const uploadPath = folder_path === '/' ? file_name : `${folder_path.replace(/^\/|\/$/g, '')}/${file_name}`
  
  // Handle conflict behavior
  let endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${uploadPath}:/content`
  if (conflict_behavior === 'replace') {
    endpoint += '?@microsoft.graph.conflictBehavior=replace'
  } else if (conflict_behavior === 'fail') {
    endpoint += '?@microsoft.graph.conflictBehavior=fail'
  } else {
    endpoint += '?@microsoft.graph.conflictBehavior=rename'
  }

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to upload OneDrive file: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function downloadOneDriveFile(accessToken: string, params: any) {
  const { file_id, file_path } = params

  if (!file_id && !file_path) {
    throw new Error('Either file_id or file_path is required')
  }

  let endpoint: string
  if (file_id) {
    endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${file_id}/content`
  } else {
    endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${file_path}:/content`
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to download OneDrive file: ${response.status} ${errorText}`)
  }

  // Get file content as base64
  const fileBuffer = await response.arrayBuffer()
  const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)))

  return {
    content: base64Content,
    contentType: response.headers.get('content-type'),
    size: fileBuffer.byteLength
  }
}

async function shareOneDriveFile(accessToken: string, params: any) {
  const { file_id, file_path, link_type = 'view', scope = 'anonymous' } = params

  if (!file_id && !file_path) {
    throw new Error('Either file_id or file_path is required')
  }

  let endpoint: string
  if (file_id) {
    endpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${file_id}/createLink`
  } else {
    endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${file_path}:/createLink`
  }

  const linkBody = {
    type: link_type,
    scope: scope
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(linkBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to share OneDrive file: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function listOneDriveFiles(accessToken: string, params: any) {
  const { folder_path = '/', limit = 100 } = params

  let endpoint: string
  if (folder_path === '/') {
    endpoint = `https://graph.microsoft.com/v1.0/me/drive/root/children?$top=${limit}`
  } else {
    endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${folder_path}:/children?$top=${limit}`
  }

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to list OneDrive files: ${response.status} ${errorText}`)
  }

  return await response.json()
}

async function searchOneDriveFiles(accessToken: string, params: any) {
  const { query, limit = 50 } = params

  if (!query) {
    throw new Error('Search query is required')
  }

  const endpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=${limit}`

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to search OneDrive files: ${response.status} ${errorText}`)
  }

  return await response.json()
}

// OAuth token exchange function
async function exchangeOAuthCode(code: string, codeVerifier: string, redirectUri: string, userId: string) {
  console.log(`[microsoft-onedrive-api] Starting OAuth token exchange for user: ${userId}`)

  // Create Supabase client
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Get Microsoft OneDrive provider
  const { data: provider, error: providerError } = await supabaseServiceRole
    .from('service_providers')
    .select('id, token_endpoint')
    .eq('name', 'microsoft-onedrive')
    .single()

  if (providerError || !provider) {
    throw new Error(`Microsoft OneDrive provider not found: ${providerError?.message || 'Not found'}`)
  }

  // Exchange code for tokens using Microsoft Graph API
  const tokenResponse = await fetch(provider.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
        client_id: Deno.env.get('MICROSOFT_ONEDRIVE_CLIENT_ID')!,
        client_secret: Deno.env.get('MICROSOFT_ONEDRIVE_CLIENT_SECRET')!,
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

  console.log(`[microsoft-onedrive-api] Successfully received tokens, storing in vault...`)

  // Store tokens in Supabase Vault using the vault API
  const accessTokenName = `onedrive_access_token_${userId}_${Date.now()}`
  const { data: accessTokenVault, error: accessTokenError } = await supabaseServiceRole
    .rpc('create_vault_secret', {
      p_secret: tokens.access_token,
      p_name: accessTokenName,
      p_description: `OneDrive access token for user ${userId}`
    })

  if (accessTokenError) {
    throw new Error(`Failed to store access token: ${accessTokenError.message}`)
  }

  let refreshTokenVaultId = null
  if (tokens.refresh_token) {
    const refreshTokenName = `onedrive_refresh_token_${userId}_${Date.now()}`
    const { data: refreshTokenVault, error: refreshTokenError } = await supabaseServiceRole
      .rpc('create_vault_secret', {
        p_secret: tokens.refresh_token,
        p_name: refreshTokenName,
        p_description: `OneDrive refresh token for user ${userId}`
      })

    if (refreshTokenError) {
      throw new Error(`Failed to store refresh token: ${refreshTokenError.message}`)
    }
    refreshTokenVaultId = refreshTokenName
  }

  // Store connection in user_integration_credentials
  const ONEDRIVE_SCOPES = [
    'https://graph.microsoft.com/Files.Read',
    'https://graph.microsoft.com/Files.ReadWrite',
    'https://graph.microsoft.com/Files.Read.All',
    'https://graph.microsoft.com/Files.ReadWrite.All',
    'https://graph.microsoft.com/Sites.Read.All',
    'https://graph.microsoft.com/Sites.ReadWrite.All',
    'https://graph.microsoft.com/User.Read'
  ]

  const { data: connectionData, error: insertError } = await supabaseServiceRole
    .from('user_integration_credentials')
    .insert({
      user_id: userId,
      oauth_provider_id: provider.id,
      external_user_id: userId,
      external_username: 'onedrive_user', // Will be updated with actual username later
      connection_name: 'Microsoft OneDrive Connection',
      vault_access_token_id: accessTokenName,
      vault_refresh_token_id: refreshTokenVaultId,
      scopes_granted: ONEDRIVE_SCOPES,
      connection_status: 'active',
      credential_type: 'oauth',
      token_expires_at: tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null,
      connection_metadata: {
        provider: 'microsoft-onedrive',
        token_type: tokens.token_type || 'Bearer',
        scope: tokens.scope
      }
    })
    .select('*')
    .single()

  if (insertError) {
    throw new Error(`Failed to create connection: ${insertError.message}`)
  }

  console.log(`[microsoft-onedrive-api] Successfully created connection: ${connectionData.id}`)

  return {
    connection_id: connectionData.id,
    connection_name: connectionData.connection_name,
    scopes_granted: connectionData.scopes_granted,
    expires_at: connectionData.token_expires_at
  }
}
