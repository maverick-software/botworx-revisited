import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_BASE = 'https://api.sendgrid.com/v3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendGridAPIRequest {
  agent_id: string;
  action: string;
  parameters: Record<string, any>;
}

interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  from_name?: string;
  reply_to?: string;
  subject: string;
  text?: string;
  html?: string;
  template_id?: string;
  dynamic_template_data?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
    disposition?: string;
    content_id?: string;
  }>;
  categories?: string[];
  custom_args?: Record<string, string>;
}

interface BulkEmailMessage {
  from: string;
  from_name?: string;
  reply_to?: string;
  subject?: string;
  text?: string;
  html?: string;
  template_id?: string;
  personalizations: Array<{
    to: Array<{email: string, name?: string}>;
    cc?: Array<{email: string, name?: string}>;
    bcc?: Array<{email: string, name?: string}>;
    subject?: string;
    dynamic_template_data?: Record<string, any>;
    custom_args?: Record<string, string>;
  }>;
  categories?: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, params, agent_id } = await req.json()
    console.log('SendGrid API request:', { action, agent_id })
    console.log('Params received:', JSON.stringify(params, null, 2))

    // Validate required parameters
    if (!action || !params || !agent_id) {
      console.error('Missing parameters:', { action: !!action, params: !!params, agent_id: !!agent_id })
      throw new Error('Missing required parameters: action, params, and agent_id are required')
    }

    // Create a Supabase client with the auth context
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Create a service role client for vault access
    const supabaseServiceRole = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    // Validate agent permissions for SendGrid
    const requiredPermission = getRequiredPermission(action)
    const { data: hasPermissions, error: permissionError } = await supabase.rpc(
      'validate_agent_sendgrid_permissions',
      {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_permission: requiredPermission
      }
    )

    if (permissionError || !hasPermissions) {
      throw new Error(`Agent does not have required permissions for this SendGrid operation: ${requiredPermission}`)
    }

    // Get user's SendGrid configuration and API key
    const { data: sendgridConfig, error: configError } = await supabaseServiceRole
      .from('sendgrid_configurations')
      .select('id, api_key_vault_id, from_email, from_name, reply_to_email, max_emails_per_day, max_recipients_per_email, enable_tracking, allowed_domains, require_approval')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (configError || !sendgridConfig) {
      throw new Error(`No active SendGrid configuration found: ${configError?.message || 'Not found'}`)
    }

    // Get API key from vault (stored as text in vault_access_token_id for now)
    let apiKey: string
    try {
      // For now, api_key_vault_id contains the actual API key
      apiKey = sendgridConfig.api_key_vault_id
      if (!apiKey) {
        throw new Error('SendGrid API key not found')
      }
    } catch (vaultError) {
      throw new Error(`Failed to retrieve SendGrid API key: ${vaultError.message}`)
    }

    // Execute the requested SendGrid API action
    let result: any
    let recipientsCount = 0
    const startTime = Date.now()

    console.log(`Executing SendGrid action: ${action}`)
    
    try {
      switch (action) {
        case 'send_email':
          console.log('Calling sendEmail with params:', params)
          result = await sendEmail(apiKey, params as EmailMessage, sendgridConfig)
          console.log('sendEmail result:', result)
          recipientsCount = countRecipients(params as EmailMessage)
          break
        
        case 'send_bulk_email':
          result = await sendBulkEmail(apiKey, params as BulkEmailMessage, sendgridConfig)
          recipientsCount = countBulkRecipients(params as BulkEmailMessage)
          break
        
        case 'send_template_email':
          result = await sendTemplateEmail(apiKey, params as EmailMessage, sendgridConfig)
          recipientsCount = countRecipients(params as EmailMessage)
          break
        
        case 'get_email_status':
          result = await getEmailStatus(apiKey, params.message_id)
          recipientsCount = 0
          break
        
        case 'search_email_analytics':
          result = await searchEmailAnalytics(apiKey, params)
          recipientsCount = 0
          break
        
        case 'list_inbound_emails':
          result = await listInboundEmails(supabase, user.id, params)
          recipientsCount = 0
          break
        
        case 'create_email_template':
          result = await createEmailTemplate(apiKey, params, sendgridConfig.id)
          recipientsCount = 0
          break
        
        case 'create_agent_email_address':
          result = await createAgentEmailAddress(supabase, agent_id, sendgridConfig.id, params)
          recipientsCount = 0
          break
        
        case 'set_email_forwarding_rule':
          result = await setEmailForwardingRule(supabase, agent_id, sendgridConfig.id, params)
          recipientsCount = 0
          break
        
        default:
          throw new Error(`Unsupported SendGrid action: ${action}`)
      }

      const executionTime = Date.now() - startTime

      // Log successful operation
      await supabase.rpc('log_sendgrid_operation', {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_operation_type: action,
        p_operation_params: params,
        p_operation_result: result,
        p_status: 'success',
        p_message_id: result?.message_id || null,
        p_recipients_count: recipientsCount,
        p_execution_time_ms: executionTime
      })

      return new Response(
        JSON.stringify({
          success: true,
          data: result,
          recipients_count: recipientsCount,
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
      await supabase.rpc('log_sendgrid_operation', {
        p_agent_id: agent_id,
        p_user_id: user.id,
        p_operation_type: action,
        p_operation_params: params,
        p_operation_result: null,
        p_status: 'error',
        p_error_message: operationError.message,
        p_recipients_count: recipientsCount,
        p_execution_time_ms: executionTime
      })

      throw operationError
    }

  } catch (error) {
    console.error('SendGrid API error:', error)
    
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

// Helper function to get required permission for each action
function getRequiredPermission(action: string): string {
  const permissionMap: Record<string, string> = {
    'send_email': 'can_send_email',
    'send_bulk_email': 'can_send_bulk',
    'send_template_email': 'can_use_templates',
    'get_email_status': 'can_view_analytics',
    'search_email_analytics': 'can_view_analytics',
    'list_inbound_emails': 'can_receive_emails',
    'create_email_template': 'can_manage_templates',
    'create_agent_email_address': 'can_receive_emails',
    'set_email_forwarding_rule': 'can_receive_emails',
  }
  
  return permissionMap[action] || 'can_send_email'
}

// Helper functions to count recipients
function countRecipients(message: EmailMessage): number {
  let count = 0
  
  if (Array.isArray(message.to)) {
    count += message.to.length
  } else if (message.to) {
    count += 1
  }
  
  if (message.cc) {
    count += Array.isArray(message.cc) ? message.cc.length : 1
  }
  
  if (message.bcc) {
    count += Array.isArray(message.bcc) ? message.bcc.length : 1
  }
  
  return count
}

function countBulkRecipients(message: BulkEmailMessage): number {
  return message.personalizations.reduce((count, personalization) => {
    let personalCount = personalization.to.length
    if (personalization.cc) personalCount += personalization.cc.length
    if (personalization.bcc) personalCount += personalization.bcc.length
    return count + personalCount
  }, 0)
}

// SendGrid API Operations

async function sendEmail(apiKey: string, message: EmailMessage, config: any): Promise<any> {
  console.log('[sendEmail] Starting email send process')
  
  // Build SendGrid email payload
  const payload: any = {
    personalizations: [{
      to: normalizeEmailAddresses(message.to),
      subject: message.subject
    }],
    from: {
      email: message.from || config.from_email,
      name: message.from_name || config.from_name
    },
    content: []
  }
  
  // Add CC and BCC
  if (message.cc) {
    payload.personalizations[0].cc = normalizeEmailAddresses(message.cc)
  }
  if (message.bcc) {
    payload.personalizations[0].bcc = normalizeEmailAddresses(message.bcc)
  }
  
  // Add reply-to
  if (message.reply_to || config.reply_to_email) {
    payload.reply_to = { email: message.reply_to || config.reply_to_email }
  }
  
  // Add content
  if (message.text) {
    payload.content.push({
      type: 'text/plain',
      value: message.text
    })
  }
  
  if (message.html) {
    payload.content.push({
      type: 'text/html',
      value: message.html
    })
  }
  
  // Add attachments
  if (message.attachments && message.attachments.length > 0) {
    payload.attachments = message.attachments.map(att => ({
      filename: att.filename,
      content: att.content,
      type: att.type,
      disposition: att.disposition || 'attachment',
      content_id: att.content_id
    }))
  }
  
  // Add categories
  if (message.categories) {
    payload.categories = message.categories
  }
  
  // Add custom args
  if (message.custom_args) {
    payload.custom_args = message.custom_args
  }
  
  // Add tracking settings
  if (config.enable_tracking) {
    payload.tracking_settings = {
      click_tracking: { enable: config.enable_tracking.clicks || false },
      open_tracking: { enable: config.enable_tracking.opens || false },
      subscription_tracking: { enable: config.enable_tracking.unsubscribes || false }
    }
  }

  console.log('[sendEmail] Payload prepared:', JSON.stringify(payload, null, 2))

  // Send via SendGrid API
  const response = await fetch(`${SENDGRID_API_BASE}/mail/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    const errorBody = await response.text()
    console.error('[sendEmail] SendGrid API error:', response.status, errorBody)
    throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`)
  }
  
  // SendGrid returns 202 Accepted for successful sends
  const messageId = response.headers.get('X-Message-Id')
  
  return {
    message_id: messageId,
    status: 'sent',
    recipients_count: countRecipients(message)
  }
}

async function sendBulkEmail(apiKey: string, message: BulkEmailMessage, config: any): Promise<any> {
  console.log('[sendBulkEmail] Starting bulk email send process')
  
  const payload: any = {
    personalizations: message.personalizations,
    from: {
      email: message.from,
      name: message.from_name
    },
    content: []
  }
  
  // Add reply-to
  if (message.reply_to) {
    payload.reply_to = { email: message.reply_to }
  }
  
  // Add template or content
  if (message.template_id) {
    payload.template_id = message.template_id
  } else {
    if (message.text) {
      payload.content.push({
        type: 'text/plain',
        value: message.text
      })
    }
    
    if (message.html) {
      payload.content.push({
        type: 'text/html',
        value: message.html
      })
    }
    
    if (message.subject) {
      payload.subject = message.subject
    }
  }
  
  // Add categories
  if (message.categories) {
    payload.categories = message.categories
  }

  const response = await fetch(`${SENDGRID_API_BASE}/mail/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`)
  }
  
  const messageId = response.headers.get('X-Message-Id')
  
  return {
    message_id: messageId,
    status: 'sent',
    recipients_count: countBulkRecipients(message)
  }
}

async function sendTemplateEmail(apiKey: string, message: EmailMessage, config: any): Promise<any> {
  console.log('[sendTemplateEmail] Starting template email send process')
  
  if (!message.template_id) {
    throw new Error('Template ID is required for template emails')
  }
  
  const payload: any = {
    personalizations: [{
      to: normalizeEmailAddresses(message.to),
      dynamic_template_data: message.dynamic_template_data || {}
    }],
    from: {
      email: message.from || config.from_email,
      name: message.from_name || config.from_name
    },
    template_id: message.template_id
  }
  
  // Add CC and BCC
  if (message.cc) {
    payload.personalizations[0].cc = normalizeEmailAddresses(message.cc)
  }
  if (message.bcc) {
    payload.personalizations[0].bcc = normalizeEmailAddresses(message.bcc)
  }
  
  if (message.reply_to || config.reply_to_email) {
    payload.reply_to = { email: message.reply_to || config.reply_to_email }
  }

  const response = await fetch(`${SENDGRID_API_BASE}/mail/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`)
  }
  
  const messageId = response.headers.get('X-Message-Id')
  
  return {
    message_id: messageId,
    status: 'sent',
    template_id: message.template_id,
    recipients_count: countRecipients(message)
  }
}

async function getEmailStatus(apiKey: string, messageId: string): Promise<any> {
  // SendGrid doesn't have a direct message status API, but we can check events
  const response = await fetch(`${SENDGRID_API_BASE}/messages/${messageId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (response.status === 404) {
    return { message_id: messageId, status: 'not_found' }
  }
  
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`)
  }
  
  const data = await response.json()
  return data
}

async function searchEmailAnalytics(apiKey: string, params: any): Promise<any> {
  const { start_date, end_date, categories, limit = 500 } = params
  
  let url = `${SENDGRID_API_BASE}/stats?limit=${limit}`
  
  if (start_date) {
    url += `&start_date=${start_date}`
  }
  if (end_date) {
    url += `&end_date=${end_date}`
  }
  if (categories && categories.length > 0) {
    url += `&categories=${categories.join(',')}`
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`)
  }
  
  const data = await response.json()
  return data
}

async function listInboundEmails(supabase: any, userId: string, params: any): Promise<any> {
  const { agent_id, limit = 50, offset = 0, since } = params
  
  let query = supabase
    .from('sendgrid_inbound_emails')
    .select('*')
    .eq('user_id', userId)
    .order('processed_at', { ascending: false })
    .limit(limit)
    .range(offset, offset + limit - 1)
  
  if (agent_id) {
    query = query.eq('agent_id', agent_id)
  }
  
  if (since) {
    query = query.gte('processed_at', since)
  }
  
  const { data, error } = await query
  
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }
  
  return { emails: data || [], count: data?.length || 0 }
}

async function createEmailTemplate(apiKey: string, params: any, configId: string): Promise<any> {
  const { name, subject, html_content, plain_content } = params
  
  const payload = {
    name,
    generation: 'dynamic'
  }
  
  // First create the template
  const templateResponse = await fetch(`${SENDGRID_API_BASE}/templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  
  if (!templateResponse.ok) {
    const errorBody = await templateResponse.text()
    throw new Error(`SendGrid API error: ${templateResponse.status} - ${errorBody}`)
  }
  
  const template = await templateResponse.json()
  
  // Then create a version
  const versionPayload = {
    template_id: template.id,
    active: 1,
    name: `${name} v1`,
    html_content: html_content || '',
    plain_content: plain_content || '',
    subject: subject || '{{subject}}'
  }
  
  const versionResponse = await fetch(`${SENDGRID_API_BASE}/templates/${template.id}/versions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(versionPayload)
  })
  
  if (!versionResponse.ok) {
    const errorBody = await versionResponse.text()
    throw new Error(`SendGrid API error: ${versionResponse.status} - ${errorBody}`)
  }
  
  const version = await versionResponse.json()
  
  return {
    template_id: template.id,
    version_id: version.id,
    name: template.name,
    active: true
  }
}

async function createAgentEmailAddress(supabase: any, agentId: string, configId: string, params: any): Promise<any> {
  const { local_part, domain, auto_reply_enabled = false, auto_reply_template_id } = params
  
  const { data, error } = await supabase
    .from('agent_email_addresses')
    .insert({
      agent_id: agentId,
      sendgrid_config_id: configId,
      local_part,
      domain,
      auto_reply_enabled,
      auto_reply_template_id
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }
  
  return {
    id: data.id,
    email_address: data.full_address,
    auto_reply_enabled: data.auto_reply_enabled
  }
}

async function setEmailForwardingRule(supabase: any, agentId: string, configId: string, params: any): Promise<any> {
  const { from_pattern, subject_pattern, action_type, action_config } = params
  
  // This would typically involve creating routing rules in the sendgrid_inbound_routing_rules table
  // For now, return a placeholder response
  return {
    rule_id: 'placeholder',
    agent_id: agentId,
    from_pattern,
    subject_pattern,
    action_type,
    status: 'active'
  }
}

// Helper function to normalize email addresses
function normalizeEmailAddresses(emails: string | string[]): Array<{email: string, name?: string}> {
  if (typeof emails === 'string') {
    return [{ email: emails }]
  }
  
  return emails.map(email => ({ email }))
}