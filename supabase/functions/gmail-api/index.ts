import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GmailAPIRequest {
  agent_id: string;
  action: string;
  parameters: Record<string, any>;
}

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Debug logging for incoming request
    console.log(`[gmail-api] Raw request method: ${req.method}`);
    console.log(`[gmail-api] Raw request headers:`, Object.fromEntries(req.headers.entries()));
    
    let requestBody;
    try {
      const rawText = await req.text();
      console.log(`[gmail-api] Raw request body:`, rawText);
      
      if (!rawText || rawText.trim() === '') {
        throw new Error('Request body is empty');
      }
      
      requestBody = JSON.parse(rawText);
      console.log(`[gmail-api] Parsed request body:`, JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error(`[gmail-api] JSON parse error:`, parseError);
      throw new Error(`Failed to parse request body: ${parseError.message}`);
    }
    
    const { action, params, agent_id } = requestBody;
    console.log('Gmail API request:', { action, agent_id })
    console.log('Params received:', JSON.stringify(params, null, 2))

    // Validate required parameters with LLM-friendly error messages
    if (!action || !params || !agent_id) {
      console.error('Missing parameters:', { action: !!action, params: !!params, agent_id: !!agent_id })
      
      // Return interactive error messages that trigger retry mechanism
      if (!action) {
        throw new Error('Question: What email action would you like me to perform? Please specify send_email, read_emails, or search_emails.')
      }
      if (!agent_id) {
        throw new Error('Missing agent context. Please retry with proper agent identification.')
      }
      if (!params) {
        throw new Error('Question: What email details would you like me to use? For sending emails, please provide recipient (to), subject, and message body.')
      }
      
      throw new Error('Please provide the required email parameters: action, recipient details, and message content.')
    }

    // Create a service role client for vault access
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user ID from request body (passed by Universal Tool Executor)
    const { user_id } = requestBody;
    if (!user_id) {
      throw new Error('Missing user_id in request body')
    }

    console.log('[gmail-api] Using user_id from request body:', user_id);

    // Validate agent permissions for Gmail
    const requiredScopes = getRequiredScopes(action)
    console.log('[gmail-api] Validating permissions:', {
      agent_id,
      user_id,
      action,
      requiredScopes
    });

    const { data: hasPermissions, error: permissionError } = await supabaseServiceRole.rpc(
      'validate_agent_gmail_permissions',
      {
        p_agent_id: agent_id,
        p_user_id: user_id,
        p_required_scopes: requiredScopes
      }
    )

    console.log('[gmail-api] Permission validation result:', {
      hasPermissions,
      permissionError
    });

    // Let's also manually check what permissions exist
    const { data: debugPermissions } = await supabaseServiceRole
      .from('agent_integration_permissions')
      .select(`
        allowed_scopes,
        is_active,
        permission_level,
        user_integration_credentials!inner(
          connection_status,
          service_providers!inner(name)
        )
      `)
      .eq('agent_id', agent_id)
      .eq('user_integration_credentials.user_id', user_id)
      .eq('user_integration_credentials.service_providers.name', 'gmail');

    console.log('[gmail-api] Debug - Agent Gmail permissions:', debugPermissions);

    if (permissionError || !hasPermissions) {
      console.error('[gmail-api] Permission validation failed:', {
        hasPermissions,
        permissionError,
        requiredScopes,
        debugPermissions
      });
      
      // Provide intelligent error message for the LLM
      let errorMessage = '';
      
      if (permissionError) {
        if (permissionError.message?.includes('upper bound of FOR loop cannot be null')) {
          errorMessage = 'Gmail integration configuration issue detected. The required scopes validation failed due to a database configuration problem.';
        } else {
          errorMessage = `Gmail permission validation error: ${permissionError.message}`;
        }
      } else if (!hasPermissions) {
        if (debugPermissions && debugPermissions.length === 0) {
          errorMessage = 'No Gmail integration found for this agent. Please configure Gmail access in the agent settings under the Channels tab.';
        } else {
          errorMessage = `This agent does not have the required Gmail permissions for '${action}'. Required permissions: ${requiredScopes.join(', ')}. Please check the agent's Gmail integration settings.`;
        }
      }
      
      // Add helpful context for the LLM
      errorMessage += ` To resolve this, the user should: 1) Go to Agent Settings → Channels tab, 2) Configure Gmail integration, 3) Grant the required permissions: ${requiredScopes.join(', ')}.`;
      
      throw new Error(errorMessage);
    }

    // Get user's Gmail access token from integration credentials
    // First get the Gmail provider ID
    const { data: gmailProvider, error: providerError } = await supabaseServiceRole
      .from('service_providers')
      .select('id')
      .eq('name', 'gmail')
      .single();

    if (providerError || !gmailProvider) {
      throw new Error(`Gmail OAuth provider not found: ${providerError?.message || 'Not found'}`);
    }

    const { data: connection, error: connectionError } = await supabaseServiceRole
      .from('user_integration_credentials')
      .select('id, vault_access_token_id, vault_refresh_token_id, token_expires_at, connection_status, connection_name, external_username, created_at, updated_at')
      .eq('user_id', user_id)
      .eq('oauth_provider_id', gmailProvider.id)
      .eq('connection_status', 'active')
      .single();

    console.log('[gmail-api] Connection query result:', {
      connection,
      connectionError,
      user_id: user_id,
      gmail_provider_id: gmailProvider.id
    });

    if (connectionError || !connection) {
      // Let's also check if there are any connections at all for this user
      const { data: allConnections } = await supabaseServiceRole
        .from('user_integration_credentials')
        .select('id, connection_status, oauth_provider_id, connection_name, external_username, created_at, updated_at, service_providers!inner(name)')
        .eq('user_id', user_id);
      
      console.log('[gmail-api] All user connections:', allConnections);
      
      // Check for inactive Gmail connections
      const { data: inactiveGmailConnections } = await supabaseServiceRole
        .from('user_integration_credentials')
        .select('id, connection_status, connection_name, external_username, created_at, updated_at')
        .eq('user_id', user_id)
        .eq('oauth_provider_id', gmailProvider.id);
      
      console.log('[gmail-api] All Gmail connections (including inactive):', inactiveGmailConnections);
      
      let errorMessage = 'No active Gmail connection found for this agent.';
      
      if (inactiveGmailConnections && inactiveGmailConnections.length > 0) {
        const statuses = inactiveGmailConnections.map(conn => conn.connection_status).join(', ');
        errorMessage = `Gmail connection exists but is not active (status: ${statuses}). The connection may have expired or been revoked.`;
      } else if (allConnections && allConnections.length === 0) {
        errorMessage = 'No integrations configured for this user.';
      }
      
      errorMessage += ' To resolve this: 1) Go to Agent Settings → Channels tab, 2) Configure Gmail integration, 3) Complete the OAuth authorization process.';
      
      throw new Error(errorMessage);
    }

    let accessToken: string;
    
    // Check if token is expired and refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) <= new Date()) {
      console.log('[gmail-api] Token expired, attempting refresh...');
      try {
        accessToken = await refreshGmailToken(supabaseServiceRole, connection, agent_id);
        console.log('[gmail-api] Token refreshed successfully');
      } catch (refreshError) {
        console.error('[gmail-api] Token refresh failed:', refreshError);
        throw new Error('Question: Your Gmail authentication has expired and could not be renewed automatically. Please reconnect your Gmail account in the integration settings.');
      }
    } else {
      // SECURITY: Get access token from Supabase Vault (not directly from connection)
      const vaultTokenId = connection.vault_access_token_id;
      console.log('[gmail-api] Connection details:', {
        vault_access_token_id: vaultTokenId,
        vault_refresh_token_id: connection.vault_refresh_token_id,
        connection_status: connection.connection_status,
        token_expires_at: connection.token_expires_at,
        created_at: connection.created_at,
        updated_at: connection.updated_at
      });
      
      if (!vaultTokenId) {
        throw new Error('Gmail access token not found in vault. The Gmail integration may need to be reconnected. Please go to Agent Settings → Channels → Gmail and reconnect your account.');
      }

      // Retrieve actual token from vault using service role client
      console.log('[gmail-api] Attempting to decrypt vault token:', vaultTokenId);
      const { data: decryptedToken, error: vaultError } = await supabaseServiceRole
        .rpc('vault_decrypt', { vault_id: vaultTokenId });

      console.log('[gmail-api] Vault decrypt result:', {
        success: !!decryptedToken,
        error: vaultError,
        token_length: decryptedToken ? decryptedToken.length : 0,
        vault_error_code: vaultError?.code,
        vault_error_details: vaultError?.details
      });

      if (vaultError || !decryptedToken) {
        let errorMessage = 'Failed to retrieve Gmail access token from vault.';
        
        if (vaultError) {
          if (vaultError.code === 'PGRST116' || vaultError.message?.includes('not found')) {
            errorMessage = 'Gmail access token not found in secure storage. This usually means the Gmail integration needs to be reconnected.';
          } else if (vaultError.code === 'PGRST301') {
            errorMessage = 'Gmail access token could not be decrypted. The token may be corrupted.';
          } else {
            errorMessage = `Gmail vault error: ${vaultError.message}`;
          }
        }
        
        errorMessage += ' To resolve this: 1) Go to Agent Settings → Channels tab, 2) Remove the existing Gmail integration, 3) Add Gmail integration again and complete the OAuth flow.';
        
        throw new Error(errorMessage);
      }
      
      accessToken = decryptedToken;
      console.log('[gmail-api] Access token retrieved successfully, length:', accessToken.length);
    }

    // Execute the requested Gmail API action
    let result: any
    let quotaConsumed = 0
    const startTime = Date.now()

    console.log(`Executing action: ${action}`)
    
    try {
      switch (action) {
        case 'send_email':
          console.log('Calling sendEmail with params:', params)
          result = await executeWithTokenRefresh(
            (token) => sendEmail(token, params as EmailMessage),
            supabaseServiceRole,
            connection,
            user_id,
            accessToken,
            'send_email'
          )
          console.log('sendEmail result:', result)
          quotaConsumed = 100 // Sending emails costs 100 quota units
          break
        
        case 'read_emails':
        case 'list_messages': // Handle list_messages as an alias for read_emails
          result = await executeWithTokenRefresh(
            (token) => readEmails(token, params),
            supabaseServiceRole,
            connection,
            user_id,
            accessToken,
            action
          )
          quotaConsumed = 5 * (params.max_results || 50) // 5 units per message
          break
        
        case 'search_emails':
          result = await executeWithTokenRefresh(
            (token) => searchEmails(token, params),
            supabaseServiceRole,
            connection,
            user_id,
            accessToken,
            'search_emails'
          )
          quotaConsumed = 5 * (params.max_results || 50)
          break
        
        case 'email_actions':
          result = await executeWithTokenRefresh(
            (token) => emailActions(token, params),
            supabaseServiceRole,
            connection,
            user_id,
            accessToken,
            'email_actions'
          )
          quotaConsumed = 5
          break

        case 'manage_labels':
          result = await executeWithTokenRefresh(
            (token) => manageLabels(token, params),
            supabaseServiceRole,
            connection,
            user_id,
            accessToken,
            'manage_labels'
          )
          quotaConsumed = 5 // Label operations cost 5 units
          break
        
        default:
          throw new Error(`Unsupported Gmail action: ${action}`)
      }

      const executionTime = Date.now() - startTime

      // Log successful operation
      await supabaseServiceRole.rpc('log_gmail_operation', {
        p_agent_id: agent_id,
        p_user_id: user_id,
        p_operation_type: action,
        p_operation_params: params,
        p_operation_result: result,
        p_status: 'success',
        p_quota_consumed: quotaConsumed,
        p_execution_time_ms: executionTime
      })

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          quota_consumed: quotaConsumed,
          execution_time_ms: executionTime
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } catch (operationError) {
      const executionTime = Date.now() - startTime
      
      // Log failed operation
      await supabaseServiceRole.rpc('log_gmail_operation', {
        p_agent_id: agent_id,
        p_user_id: user_id,
        p_operation_type: action,
        p_operation_params: params,
        p_operation_result: null,
        p_status: 'error',
        p_error_message: operationError.message,
        p_quota_consumed: 0,
        p_execution_time_ms: executionTime
      })

      throw operationError
    }

  } catch (error) {
    console.error('Gmail API error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

// Helper function to get required scopes for each action
function getRequiredScopes(action: string): string[] {
  // Return the mapped scope names that are stored in agent permissions,
  // not the raw OAuth scopes
  const scopeMap: Record<string, string[]> = {
    send_email: ['email.send'],
    read_emails: ['email.read'],
    search_emails: ['email.read', 'email.metadata'],
    list_messages: ['email.read'], // Add mapping for list_messages action
    manage_labels: ['email.labels', 'email.modify'],
    email_actions: ['email.modify'],
    compose_email: ['email.compose'],
    insert_email: ['email.insert'],
    get_profile: ['profile.email', 'profile.info'],
    manage_settings: ['email.settings.basic', 'email.settings.sharing'],
  };
  return scopeMap[action] || ['email.read']; // Default to email.read instead of empty array
}

// Gmail API Operations

async function sendEmail(accessToken: string, message: EmailMessage): Promise<any> {
  console.log('[sendEmail] Starting email send process')
  console.log('[sendEmail] Message details:', {
    to: message.to,
    subject: message.subject,
    hasBody: !!message.body,
    hasHtml: !!message.html,
    attachmentCount: message.attachments?.length || 0
  })

  // Create RFC 2822 email format
  const boundary = `boundary_${Date.now()}`
  let email = ''
  
  // Headers
  email += `To: ${message.to}\r\n`
  email += `Subject: ${message.subject}\r\n`
  email += 'MIME-Version: 1.0\r\n'
  
  if (message.attachments && message.attachments.length > 0) {
    email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`
    
    // Text/HTML body
    email += `--${boundary}\r\n`
    email += `Content-Type: ${message.html ? 'text/html' : 'text/plain'}; charset="UTF-8"\r\n\r\n`
    email += `${message.html || message.body}\r\n\r\n`
    
    // Attachments
    for (const attachment of message.attachments) {
      email += `--${boundary}\r\n`
      email += `Content-Type: ${attachment.contentType}\r\n`
      email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`
      email += 'Content-Transfer-Encoding: base64\r\n\r\n'
      email += `${attachment.content}\r\n\r\n`
    }
    
    email += `--${boundary}--`
  } else {
    email += `Content-Type: ${message.html ? 'text/html' : 'text/plain'}; charset="UTF-8"\r\n\r\n`
    email += `${message.html || message.body}`
  }

  // Convert to base64url with UTF-8 support to avoid InvalidCharacterError
  const encodedEmail = (() => {
    const bytes = new TextEncoder().encode(email);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  })()

  console.log('[sendEmail] Making request to Gmail API')
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedEmail
    }),
  })

  console.log('[sendEmail] Gmail API response:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorDetails = ''
    
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error) {
        errorDetails = errorJson.error.message || errorJson.error.code || errorText
      } else {
        errorDetails = errorText
      }
    } catch {
      errorDetails = errorText
    }
    
    console.error('Gmail API error response:', {
      status: response.status,
      statusText: response.statusText,
      error: errorDetails
    })
    
    // Provide user-friendly error messages
    if (response.status === 401) {
      throw new Error('401: Gmail authentication failed. Token may be expired.')
    } else if (response.status === 403) {
      throw new Error('Permission denied. Please ensure you granted email sending permissions.')
    } else if (response.status === 400) {
      throw new Error(`Invalid email format: ${errorDetails}`)
    } else {
      throw new Error(`Failed to send email: ${errorDetails}`)
    }
  }

  const result = await response.json()
  console.log('[sendEmail] Email sent successfully:', result)
  return result
}

async function readEmails(accessToken: string, parameters: any): Promise<any> {
  const { query = '', max_results = 50, label_ids = [], include_body = false } = parameters

  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max_results}`

  if (query) {
    url += `&q=${encodeURIComponent(query)}`
  }

  if (label_ids.length > 0) {
    label_ids.forEach((labelId: string) => {
      url += `&labelIds=${encodeURIComponent(labelId)}`
    })
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    if (response.status === 401) {
      throw new Error('401: Gmail authentication failed. Token may be expired.')
    }
    throw new Error(`Failed to read emails: ${error}`)
  }

  const list = await response.json()

  // Helper to decode body content from parts
  const decodeBody = (parts: any[]): string | null => {
    try {
      const findPart = (ps: any[]): any | null => {
        for (const p of ps || []) {
          if ((p.mimeType || '').startsWith('text/plain') && p.body?.data) return p
          if ((p.mimeType || '').startsWith('text/html') && p.body?.data) return p
          if (p.parts) {
            const inner = findPart(p.parts)
            if (inner) return inner
          }
        }
        return null
      }
      const part = findPart(parts)
      if (!part?.body?.data) return null
      const b64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = atob(b64)
      return decoded.slice(0, 2000)
    } catch (_) {
      return null
    }
  }

  // Get details and produce simplified payload the model can use reliably
  const simplified: any[] = []
  if (list.messages && Array.isArray(list.messages) && list.messages.length > 0) {
    const details = await Promise.all(
      list.messages.slice(0, Math.min(10, list.messages.length)).map(async (m: any) => {
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}` , {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        if (!res.ok && res.status === 401) {
          throw new Error('401: Gmail authentication failed. Token may be expired.')
        }
        return res.ok ? await res.json() : m
      })
    )

    for (const d of details) {
      const headers = (d.payload?.headers || []) as Array<{ name: string; value: string }>
      const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n) ?.value || ''
      const subject = get('subject')
      const from = get('from')
      const date = get('date')
      const body_preview = include_body ? decodeBody(d.payload?.parts || []) : null
      simplified.push({ id: d.id, threadId: d.threadId, subject, from, date, snippet: d.snippet, body_preview })
    }
  }

  return {
    success: true,
    total: simplified.length,
    messages: simplified,
    // include raw for debugging when needed
    raw_count: Array.isArray(list.messages) ? list.messages.length : 0,
  }
}

async function searchEmails(accessToken: string, parameters: any): Promise<any> {
  const { query, labels = [], max_results = 50 } = parameters
  
  let searchQuery = query
  if (labels.length > 0) {
    searchQuery += ` label:(${labels.join(' OR ')})`
  }

  return await readEmails(accessToken, { query: searchQuery, max_results })
}

async function manageLabels(accessToken: string, parameters: any): Promise<any> {
  const { action, label_name, label_id, message_ids = [] } = parameters
  
  switch (action) {
    case 'create':
      const createResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: label_name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }),
      })
      
      if (!createResponse.ok) {
        const error = await createResponse.text()
        if (createResponse.status === 401) {
          throw new Error('401: Gmail authentication failed. Token may be expired.')
        }
        throw new Error(`Failed to create label: ${error}`)
      }
      
      return await createResponse.json()
    
    case 'list':
      const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      
      if (!listResponse.ok) {
        const error = await listResponse.text()
        if (listResponse.status === 401) {
          throw new Error('401: Gmail authentication failed. Token may be expired.')
        }
        throw new Error(`Failed to list labels: ${error}`)
      }
      
      return await listResponse.json()
    
    case 'apply':
      if (!label_id || message_ids.length === 0) {
        throw new Error('label_id and message_ids are required for apply action')
      }
      
      const results = await Promise.all(
        message_ids.map(async (messageId: string) => {
          const response = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                addLabelIds: [label_id]
              }),
            }
          )
          
          return {
            messageId,
            success: response.ok,
            result: response.ok ? await response.json() : await response.text()
          }
        })
      )
      
      return { applied_to_messages: results }
    
    default:
      throw new Error(`Unsupported label action: ${action}`)
  }
}

// Perform common mailbox actions on messages
async function emailActions(accessToken: string, parameters: any): Promise<any> {
  const { action, message_ids = [] } = parameters
  if (!Array.isArray(message_ids) || message_ids.length === 0) {
    throw new Error('message_ids is required and must be a non-empty array')
  }

  const modifyUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify'
  const deleteUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete'

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  const doModify = async (addLabelIds: string[] = [], removeLabelIds: string[] = []) => {
    const resp = await fetch(modifyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: message_ids, addLabelIds, removeLabelIds }),
    })
    if (!resp.ok) {
      const err = await resp.text()
      if (resp.status === 401) {
        throw new Error('401: Gmail authentication failed. Token may be expired.')
      }
      throw new Error(`Failed to modify messages: ${err}`)
    }
    return { success: true, modified: message_ids.length }
  }

  switch (action) {
    case 'mark_read':
      return await doModify([], ['UNREAD'])
    case 'mark_unread':
      return await doModify(['UNREAD'], [])
    case 'archive':
      return await doModify([], ['INBOX'])
    case 'unarchive':
      return await doModify(['INBOX'], [])
    case 'star':
      return await doModify(['STARRED'], [])
    case 'unstar':
      return await doModify([], ['STARRED'])
    case 'delete':
      // Move to Trash via label
      return await doModify(['TRASH'], [])
    case 'delete_forever':
      // Permanently delete
      {
        const resp = await fetch(deleteUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ids: message_ids }),
        })
        if (!resp.ok) {
          const err = await resp.text()
          if (resp.status === 401) {
            throw new Error('401: Gmail authentication failed. Token may be expired.')
          }
          throw new Error(`Failed to delete messages: ${err}`)
        }
        return { success: true, deleted: message_ids.length }
      }
    default:
      throw new Error(`Unsupported email action: ${action}`)
  }
}

async function refreshGmailToken(supabase: any, connection: any, userId: string): Promise<string> {
  console.log('[refreshGmailToken] Starting token refresh process');
  
  // Decrypt refresh token
  const { data: refreshToken, error: decryptError } = await supabase.rpc(
    'vault_decrypt',
    { vault_id: connection.vault_refresh_token_id }
  )

  if (decryptError || !refreshToken) {
    console.error('[refreshGmailToken] Failed to decrypt refresh token:', decryptError);
    throw new Error('Failed to decrypt refresh token')
  }

  // Get Google OAuth credentials
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!

  console.log('[refreshGmailToken] Making token refresh request to Google');
  
  // Refresh the token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('[refreshGmailToken] Token refresh failed:', error);
    throw new Error(`Token refresh failed: ${error}`)
  }

  const tokens = await tokenResponse.json()
  console.log('[refreshGmailToken] Token refresh successful, expires in:', tokens.expires_in);

  // Encrypt new access token
  const { data: encryptedAccessToken, error: encryptError } = await supabase.rpc(
    'vault_encrypt',
    {
      secret: tokens.access_token,
      key_id: 'gmail_oauth_tokens'
    }
  )

  if (encryptError) {
    console.error('[refreshGmailToken] Failed to encrypt new token:', encryptError);
    throw new Error('Failed to encrypt refreshed access token')
  }

  console.log('[refreshGmailToken] Updating database with new token');
  
  // Update the connection with new token
  const { error: updateError } = await supabase
    .from('user_integration_credentials')
    .update({
      vault_access_token_id: encryptedAccessToken,
      token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('vault_access_token_id', connection.vault_access_token_id); // Use the old token ID to find the record

  if (updateError) {
    console.error('[refreshGmailToken] Failed to update database:', updateError);
    throw new Error('Failed to update token in database');
  }

  console.log('[refreshGmailToken] Token refresh completed successfully');
  return tokens.access_token
}

// Helper function to execute Gmail API operations with automatic token refresh
async function executeWithTokenRefresh<T>(
  operation: (accessToken: string) => Promise<T>,
  supabaseServiceRole: any,
  connection: any,
  user_id: string,
  currentAccessToken: string,
  operationName: string
): Promise<T> {
  try {
    console.log(`[executeWithTokenRefresh] Executing ${operationName} with current token`);
    return await operation(currentAccessToken);
  } catch (error: any) {
    console.log(`[executeWithTokenRefresh] ${operationName} failed:`, error.message);
    
    // Check if it's a 401 authentication error
    if (error.message.includes('401') || error.message.includes('authentication') || error.message.includes('unauthorized')) {
      console.log(`[executeWithTokenRefresh] Detected authentication error, attempting token refresh`);
      
      try {
        // Attempt to refresh the token
        const newAccessToken = await refreshGmailToken(supabaseServiceRole, connection, user_id);
        console.log(`[executeWithTokenRefresh] Token refreshed, retrying ${operationName}`);
        
        // Retry the operation with the new token
        return await operation(newAccessToken);
      } catch (refreshError: any) {
        console.error(`[executeWithTokenRefresh] Token refresh failed:`, refreshError.message);
        throw new Error(`Gmail authentication expired and could not be renewed automatically: ${refreshError.message}. Please reconnect your Gmail account in the integration settings.`);
      }
    } else {
      // Re-throw non-authentication errors
      throw error;
    }
  }
} 