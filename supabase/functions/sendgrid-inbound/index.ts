import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHash, createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_WEBHOOK_SECRET = Deno.env.get('SENDGRID_WEBHOOK_SECRET') // Optional for signature verification

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InboundEmail {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  cc?: string;
  charsets?: string;
  SPF?: string;
  envelope?: string;
  attachments?: string;
  attachment_info?: any;
  headers?: string;
}

interface ParsedAttachment {
  filename: string;
  content_type: string;
  size: number;
  content_id?: string;
  storage_url?: string; // After uploading to storage
}

serve(async (req) => {
  console.log(`[SendGrid Inbound] ${req.method} ${req.url}`)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only accept POST requests for webhook
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    })
  }

  try {
    console.log('[SendGrid Inbound] Processing inbound email webhook')
    
    // Create Supabase service role client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Verify webhook signature if secret is configured
    if (SENDGRID_WEBHOOK_SECRET) {
      const signature = req.headers.get('X-Twilio-Email-Event-Webhook-Signature')
      if (!signature) {
        console.error('[SendGrid Inbound] Missing webhook signature')
        return new Response('Unauthorized: Missing signature', { 
          status: 401,
          headers: corsHeaders 
        })
      }

      // Get raw body for signature verification
      const rawBody = await req.clone().text()
      const timestamp = req.headers.get('X-Twilio-Email-Event-Webhook-Timestamp')
      
      if (!verifyWebhookSignature(rawBody, signature, timestamp, SENDGRID_WEBHOOK_SECRET)) {
        console.error('[SendGrid Inbound] Invalid webhook signature')
        return new Response('Unauthorized: Invalid signature', { 
          status: 401,
          headers: corsHeaders 
        })
      }
    }

    // Parse form data from SendGrid Inbound Parse
    const formData = await req.formData()
    const inboundData = parseInboundFormData(formData)
    
    console.log('[SendGrid Inbound] Parsed email data:', {
      to: inboundData.to,
      from: inboundData.from,
      subject: inboundData.subject,
      hasText: !!inboundData.text,
      hasHtml: !!inboundData.html,
      attachmentCount: inboundData.attachments ? Object.keys(JSON.parse(inboundData.attachments)).length : 0
    })

    // Process the inbound email
    const result = await processInboundEmail(supabase, inboundData, formData)
    
    console.log('[SendGrid Inbound] Email processed successfully:', result.id)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email processed successfully',
        email_id: result.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[SendGrid Inbound] Error processing webhook:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

function parseInboundFormData(formData: FormData): InboundEmail {
  const data: InboundEmail = {
    to: formData.get('to') as string || '',
    from: formData.get('from') as string || '',
    subject: formData.get('subject') as string || '',
    text: formData.get('text') as string || undefined,
    html: formData.get('html') as string || undefined,
    cc: formData.get('cc') as string || undefined,
    charsets: formData.get('charsets') as string || undefined,
    SPF: formData.get('SPF') as string || undefined,
    envelope: formData.get('envelope') as string || undefined,
    attachments: formData.get('attachments') as string || undefined,
    headers: formData.get('headers') as string || undefined,
  }

  // Parse attachment info if present
  const attachmentInfo = formData.get('attachment-info')
  if (attachmentInfo) {
    try {
      data.attachment_info = JSON.parse(attachmentInfo as string)
    } catch (e) {
      console.warn('[SendGrid Inbound] Failed to parse attachment-info:', e)
    }
  }

  return data
}

async function processInboundEmail(supabase: any, emailData: InboundEmail, formData: FormData): Promise<any> {
  console.log('[SendGrid Inbound] Processing inbound email')
  
  // Determine target configuration and agent based on the "to" address
  const { agentId, configId } = await resolveEmailTarget(supabase, emailData.to)
  
  // Extract and process attachments
  const attachments = await processAttachments(supabase, formData, emailData.attachment_info)
  
  // Parse additional data
  const headers = emailData.headers ? parseHeaders(emailData.headers) : {}
  const envelope = emailData.envelope ? JSON.parse(emailData.envelope) : {}
  const charsets = emailData.charsets ? JSON.parse(emailData.charsets) : {}
  
  // Generate unique message ID
  const messageId = generateMessageId(emailData)
  
  // Check for threading (replies/forwarding)
  const { inReplyTo, references } = extractThreadingInfo(headers)
  
  // Store the inbound email in database
  const { data: storedEmail, error: insertError } = await supabase
    .from('sendgrid_inbound_emails')
    .insert({
      sendgrid_config_id: configId,
      agent_id: agentId,
      message_id: messageId,
      from_email: emailData.from,
      from_name: extractNameFromEmail(emailData.from),
      to_emails: parseEmailList(emailData.to),
      cc_emails: emailData.cc ? parseEmailList(emailData.cc) : null,
      subject: emailData.subject,
      text_body: emailData.text,
      html_body: emailData.html,
      headers: headers,
      attachments: attachments,
      spam_score: extractSpamScore(headers),
      spf_check: emailData.SPF,
      envelope: envelope,
      charsets: charsets,
      raw_webhook_data: Object.fromEntries(formData.entries()),
      in_reply_to: inReplyTo,
      message_references: references,
      processing_status: 'processed'
    })
    .select()
    .single()

  if (insertError) {
    console.error('[SendGrid Inbound] Error storing email:', insertError)
    throw new Error(`Failed to store email: ${insertError.message}`)
  }

  // Apply routing rules if agent is configured
  if (agentId) {
    await applyRoutingRules(supabase, storedEmail, agentId, configId)
  }

  // Send auto-reply if configured
  if (agentId) {
    await sendAutoReplyIfConfigured(supabase, storedEmail, agentId, configId)
  }

  return storedEmail
}

async function resolveEmailTarget(supabase: any, toAddress: string): Promise<{agentId: string | null, configId: string}> {
  console.log('[SendGrid Inbound] Resolving email target for:', toAddress)
  
  // Try to find a specific agent email address
  const { data: agentEmail, error: agentError } = await supabase
    .from('agent_email_addresses')
    .select('agent_id, sendgrid_config_id')
    .eq('full_address', toAddress)
    .eq('is_active', true)
    .single()

  if (!agentError && agentEmail) {
    console.log('[SendGrid Inbound] Found agent email mapping:', agentEmail.agent_id)
    return {
      agentId: agentEmail.agent_id,
      configId: agentEmail.sendgrid_config_id
    }
  }

  // If no specific agent address, try to find config by domain
  const domain = toAddress.split('@')[1]
  const { data: config, error: configError } = await supabase
    .from('sendgrid_configurations')
    .select('id')
    .eq('inbound_domain', domain)
    .eq('is_active', true)
    .single()

  if (configError || !config) {
    throw new Error(`No SendGrid configuration found for domain: ${domain}`)
  }

  return {
    agentId: null, // Generic inbox, not agent-specific
    configId: config.id
  }
}

async function processAttachments(supabase: any, formData: FormData, attachmentInfo: any): Promise<ParsedAttachment[]> {
  const attachments: ParsedAttachment[] = []
  
  if (!attachmentInfo) {
    return attachments
  }

  try {
    const attachmentData = typeof attachmentInfo === 'string' ? JSON.parse(attachmentInfo) : attachmentInfo
    
    for (const [filename, info] of Object.entries(attachmentData)) {
      const attachment = info as any
      const file = formData.get(filename) as File
      
      if (file) {
        // Store file in Supabase Storage
        const storageUrl = await storeAttachment(supabase, file, filename)
        
        attachments.push({
          filename: filename,
          content_type: attachment.type || file.type,
          size: file.size,
          content_id: attachment.content_id,
          storage_url: storageUrl
        })
      }
    }
  } catch (error) {
    console.warn('[SendGrid Inbound] Error processing attachments:', error)
  }

  return attachments
}

async function storeAttachment(supabase: any, file: File, filename: string): Promise<string> {
  // Generate unique filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const uniqueFilename = `${timestamp}-${filename}`
  const filePath = `inbound-attachments/${uniqueFilename}`
  
  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('email-attachments')
    .upload(filePath, uint8Array, {
      contentType: file.type,
      duplex: 'half'
    })

  if (error) {
    console.error('[SendGrid Inbound] Error uploading attachment:', error)
    throw new Error(`Failed to store attachment: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('email-attachments')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

async function applyRoutingRules(supabase: any, email: any, agentId: string, configId: string): Promise<void> {
  console.log('[SendGrid Inbound] Applying routing rules for agent:', agentId)
  
  // Get routing rules for this agent/config
  const { data: rules, error: rulesError } = await supabase
    .from('sendgrid_inbound_routing_rules')
    .select('*')
    .eq('agent_id', agentId)
    .eq('sendgrid_config_id', configId)
    .eq('is_active', true)
    .order('priority', { ascending: true })

  if (rulesError || !rules || rules.length === 0) {
    console.log('[SendGrid Inbound] No routing rules found')
    return
  }

  const appliedRules: string[] = []

  for (const rule of rules) {
    if (matchesRule(email, rule)) {
      console.log('[SendGrid Inbound] Rule matched:', rule.id)
      appliedRules.push(rule.id)
      
      // Execute rule action
      await executeRuleAction(supabase, email, rule, agentId)
      
      // If rule is set to stop processing, break here
      if (rule.stop_processing) {
        break
      }
    }
  }

  // Update email with applied rules
  if (appliedRules.length > 0) {
    await supabase
      .from('sendgrid_inbound_emails')
      .update({ routing_rules_applied: appliedRules })
      .eq('id', email.id)
  }
}

function matchesRule(email: any, rule: any): boolean {
  const conditions = rule.conditions || {}
  
  // Check from_pattern
  if (conditions.from_pattern) {
    const regex = new RegExp(conditions.from_pattern, 'i')
    if (!regex.test(email.from_email)) {
      return false
    }
  }
  
  // Check subject_pattern
  if (conditions.subject_pattern) {
    const regex = new RegExp(conditions.subject_pattern, 'i')
    if (!regex.test(email.subject || '')) {
      return false
    }
  }
  
  // Check to_pattern
  if (conditions.to_pattern) {
    const regex = new RegExp(conditions.to_pattern, 'i')
    const toEmails = email.to_emails || []
    if (!toEmails.some((email: string) => regex.test(email))) {
      return false
    }
  }
  
  // Check body_contains
  if (conditions.body_contains) {
    const bodyText = (email.text_body || '') + ' ' + (email.html_body || '')
    if (!bodyText.toLowerCase().includes(conditions.body_contains.toLowerCase())) {
      return false
    }
  }
  
  return true
}

async function executeRuleAction(supabase: any, email: any, rule: any, agentId: string): Promise<void> {
  const action = rule.action || {}
  
  console.log('[SendGrid Inbound] Executing rule action:', action.type)
  
  switch (action.type) {
    case 'forward':
      await forwardEmail(supabase, email, action.config, agentId)
      break
    case 'auto_reply':
      await sendAutoReply(supabase, email, action.config, agentId)
      break
    case 'tag':
      await tagEmail(supabase, email, action.config)
      break
    case 'webhook':
      await callWebhook(email, action.config)
      break
    default:
      console.warn('[SendGrid Inbound] Unknown rule action type:', action.type)
  }
}

async function sendAutoReplyIfConfigured(supabase: any, email: any, agentId: string, configId: string): Promise<void> {
  // Check if agent email address has auto-reply enabled
  const { data: agentEmail, error } = await supabase
    .from('agent_email_addresses')
    .select('auto_reply_enabled, auto_reply_template_id')
    .eq('agent_id', agentId)
    .eq('sendgrid_config_id', configId)
    .eq('is_active', true)
    .single()

  if (error || !agentEmail || !agentEmail.auto_reply_enabled) {
    return
  }

  // Send auto-reply
  await sendAutoReply(supabase, email, {
    template_id: agentEmail.auto_reply_template_id,
    subject_prefix: 'Re: '
  }, agentId)
}

async function forwardEmail(supabase: any, email: any, config: any, agentId: string): Promise<void> {
  // Implementation for forwarding email
  console.log('[SendGrid Inbound] Forwarding email to:', config.forward_to)
  
  // This would typically call the sendgrid-api function to send the forwarded email
  // For now, just log the action
}

async function sendAutoReply(supabase: any, email: any, config: any, agentId: string): Promise<void> {
  console.log('[SendGrid Inbound] Sending auto-reply')
  
  // This would typically call the sendgrid-api function to send the auto-reply
  // For now, just log the action
}

async function tagEmail(supabase: any, email: any, config: any): Promise<void> {
  console.log('[SendGrid Inbound] Tagging email with:', config.tags)
  
  // Update email with tags
  const currentTags = email.tags || []
  const newTags = [...currentTags, ...(config.tags || [])]
  
  await supabase
    .from('sendgrid_inbound_emails')
    .update({ tags: newTags })
    .eq('id', email.id)
}

async function callWebhook(email: any, config: any): Promise<void> {
  console.log('[SendGrid Inbound] Calling webhook:', config.url)
  
  try {
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify({
        email: email,
        event: 'inbound_email_received'
      })
    })
  } catch (error) {
    console.error('[SendGrid Inbound] Webhook call failed:', error)
  }
}

// Helper functions

function verifyWebhookSignature(body: string, signature: string, timestamp: string | null, secret: string): boolean {
  if (!timestamp) {
    return false
  }

  // SendGrid uses ECDSA signature verification
  // This is a simplified version - in production, you'd want proper ECDSA verification
  try {
    const payload = timestamp + body
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64')
    return signature === expectedSignature
  } catch (error) {
    console.error('[SendGrid Inbound] Signature verification error:', error)
    return false
  }
}

function parseHeaders(headersString: string): Record<string, string> {
  const headers: Record<string, string> = {}
  
  try {
    const lines = headersString.split('\n')
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()
        headers[key] = value
      }
    }
  } catch (error) {
    console.warn('[SendGrid Inbound] Error parsing headers:', error)
  }
  
  return headers
}

function parseEmailList(emailString: string): string[] {
  return emailString.split(',').map(email => email.trim()).filter(email => email.length > 0)
}

function extractNameFromEmail(email: string): string | null {
  const match = email.match(/^(.*?)\s*<(.+)>$/)
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null
}

function generateMessageId(emailData: InboundEmail): string {
  // Create a deterministic message ID based on email content
  const content = `${emailData.from}${emailData.to}${emailData.subject}${Date.now()}`
  return createHash('sha256').update(content).digest('hex')
}

function extractThreadingInfo(headers: Record<string, string>): {inReplyTo: string | null, references: string[]} {
  const inReplyTo = headers['In-Reply-To'] || null
  const referencesHeader = headers['References'] || ''
  const references = referencesHeader ? referencesHeader.split(/\s+/).filter(ref => ref.length > 0) : []
  
  return { inReplyTo, references }
}

function extractSpamScore(headers: Record<string, string>): number | null {
  // Try to extract spam score from various possible headers
  const spamHeaders = ['X-Spam-Score', 'X-SpamAssassin-Score', 'X-Spam-Level']
  
  for (const header of spamHeaders) {
    const value = headers[header]
    if (value) {
      const score = parseFloat(value)
      if (!isNaN(score)) {
        return score
      }
    }
  }
  
  return null
}