# SendGrid Webhook Implementation & Security Research

## Date: August 2, 2025
## Related WBS Items: 3.2, 4.2, 5.3

## Overview
This document outlines the implementation and security considerations for SendGrid webhooks, particularly the Inbound Parse webhook for receiving emails and Event webhooks for tracking email status.

## Webhook Types

### 1. Inbound Parse Webhook
Receives incoming emails sent to configured domains.

### 2. Event Webhook
Receives notifications about email events (delivered, opened, clicked, etc.).

## Inbound Parse Webhook Implementation

### Endpoint Structure
```typescript
// Location: supabase/functions/sendgrid-inbound/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface InboundParsePayload {
  // Headers
  headers: string;
  dkim: string;
  SPF: string;
  
  // Email metadata
  email: string;          // Raw email content
  from: string;          // Sender email
  to: string;            // Recipient email(s)
  cc?: string;           // CC recipients
  subject: string;       // Email subject
  
  // Content
  text?: string;         // Plain text body
  html?: string;         // HTML body
  
  // Attachments
  attachments?: string;  // Number of attachments
  'attachment-info'?: string; // JSON string with attachment details
  
  // Additional data
  envelope: string;      // JSON envelope data
  charsets: string;      // Character encoding info
  spam_score?: string;   // Spam score if enabled
  spam_report?: string;  // Detailed spam report
  
  // Custom data
  [key: string]: any;    // Additional fields
}
```

### Webhook Handler Implementation
```typescript
serve(async (req) => {
  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('X-Twilio-Email-Event-Webhook-Signature');
    const timestamp = req.headers.get('X-Twilio-Email-Event-Webhook-Timestamp');
    
    if (!await verifyWebhookSignature(req, signature, timestamp)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const payload = Object.fromEntries(formData.entries()) as InboundParsePayload;
    
    // Extract configuration from recipient address
    const { configId, agentId } = await parseRecipientAddress(payload.to);
    
    if (!configId) {
      return new Response(
        JSON.stringify({ error: 'Unknown recipient domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process attachments if present
    const attachments = await processAttachments(formData);
    
    // Store email in database
    const emailId = await storeInboundEmail(configId, agentId, payload, attachments);
    
    // Apply routing rules
    await applyRoutingRules(emailId, configId, payload);
    
    // Trigger any webhooks or scheduled actions
    await triggerEmailActions(emailId, agentId, payload);
    
    return new Response(
      JSON.stringify({ success: true, email_id: emailId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

## Security Implementation

### 1. Webhook Signature Verification
SendGrid supports ECDSA signatures for webhook verification.

```typescript
async function verifyWebhookSignature(
  req: Request, 
  signature: string | null, 
  timestamp: string | null
): Promise<boolean> {
  if (!signature || !timestamp) {
    return false;
  }
  
  // Get public key from SendGrid configuration
  const publicKey = await getPublicKeyFromConfig();
  if (!publicKey) {
    console.error('No public key configured');
    return false;
  }
  
  // Verify timestamp is recent (prevent replay attacks)
  const timestampNum = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - timestampNum) > 300) { // 5 minutes
    console.error('Timestamp too old');
    return false;
  }
  
  // Reconstruct the signed payload
  const rawBody = await req.text();
  const signedPayload = `${timestamp}.${rawBody}`;
  
  // Verify signature using public key
  try {
    const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
    const publicKeyBuffer = base64ToArrayBuffer(publicKey);
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      algorithm,
      false,
      ['verify']
    );
    
    const signatureBuffer = base64ToArrayBuffer(signature);
    const payloadBuffer = new TextEncoder().encode(signedPayload);
    
    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signatureBuffer,
      payloadBuffer
    );
    
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
```

### 2. OAuth-Based Webhook Security (Alternative)
SendGrid also supports OAuth for webhook authentication.

```typescript
interface OAuthSecurityPolicy {
  oauth: {
    client_id: string;
    client_secret: string;  // Stored in Vault
    token_url: string;
    scopes: string[];
  };
}

async function verifyOAuthToken(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  
  // Verify token with OAuth provider
  try {
    const response = await fetch('https://oauth.provider.com/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error('OAuth verification error:', error);
    return false;
  }
}
```

### 3. Input Validation & Sanitization
```typescript
async function validateAndSanitizePayload(
  payload: InboundParsePayload
): Promise<InboundParsePayload> {
  // Validate email addresses
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(payload.from)) {
    throw new Error('Invalid from email address');
  }
  
  // Validate recipient addresses
  const recipients = payload.to.split(',').map(e => e.trim());
  for (const recipient of recipients) {
    if (!emailRegex.test(recipient)) {
      throw new Error(`Invalid recipient email: ${recipient}`);
    }
  }
  
  // Sanitize HTML content
  if (payload.html) {
    payload.html = sanitizeHtml(payload.html, {
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      allowedAttributes: {
        'a': ['href']
      }
    });
  }
  
  // Validate attachment info
  if (payload['attachment-info']) {
    try {
      const attachmentInfo = JSON.parse(payload['attachment-info']);
      // Validate each attachment
      for (const attachment of attachmentInfo) {
        validateAttachment(attachment);
      }
    } catch (error) {
      throw new Error('Invalid attachment info');
    }
  }
  
  return payload;
}
```

### 4. Rate Limiting Implementation
```typescript
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxEmailSizeBytes: number;
}

async function checkRateLimit(
  configId: string,
  ipAddress: string
): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Check IP-based rate limit
  const ipKey = `rate_limit:ip:${ipAddress}`;
  const ipCount = await incrementCounter(ipKey, 60); // 1 minute TTL
  
  if (ipCount > 100) { // 100 requests per minute per IP
    return false;
  }
  
  // Check config-based rate limit
  const configKey = `rate_limit:config:${configId}`;
  const configCount = await incrementCounter(configKey, 3600); // 1 hour TTL
  
  const { data: config } = await supabase
    .from('sendgrid_configurations')
    .select('max_emails_per_day')
    .eq('id', configId)
    .single();
  
  if (configCount > (config?.max_emails_per_day || 1000)) {
    return false;
  }
  
  return true;
}
```

### 5. Attachment Security
```typescript
interface AttachmentConfig {
  maxSizeBytes: number;
  allowedTypes: string[];
  virusScanEnabled: boolean;
}

async function processAttachments(
  formData: FormData
): Promise<ProcessedAttachment[]> {
  const attachments: ProcessedAttachment[] = [];
  const config: AttachmentConfig = {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ],
    virusScanEnabled: true
  };
  
  // Process each attachment
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('attachment') && value instanceof File) {
      // Validate file size
      if (value.size > config.maxSizeBytes) {
        throw new Error(`Attachment ${value.name} exceeds size limit`);
      }
      
      // Validate file type
      if (!config.allowedTypes.includes(value.type)) {
        throw new Error(`File type ${value.type} not allowed`);
      }
      
      // Virus scan if enabled
      if (config.virusScanEnabled) {
        const isSafe = await scanFileForVirus(value);
        if (!isSafe) {
          throw new Error(`Attachment ${value.name} failed security scan`);
        }
      }
      
      // Store attachment securely
      const storedAttachment = await storeAttachment(value);
      attachments.push(storedAttachment);
    }
  }
  
  return attachments;
}
```

## Email Routing Security

### Address Parsing and Validation
```typescript
async function parseRecipientAddress(
  toAddress: string
): Promise<{ configId: string | null; agentId: string | null }> {
  // Handle plus addressing: agent+data@domain.com
  const plusMatch = toAddress.match(/^([^+]+)\+([^@]+)@(.+)$/);
  if (plusMatch) {
    const [, localPart, data, domain] = plusMatch;
    
    // Verify domain is configured
    const config = await getConfigByDomain(domain);
    if (!config) {
      return { configId: null, agentId: null };
    }
    
    // Parse agent ID from data
    const agentId = parseAgentIdFromData(data);
    
    return { configId: config.id, agentId };
  }
  
  // Handle direct agent addresses: agent-123@domain.com
  const directMatch = toAddress.match(/^agent-([^@]+)@(.+)$/);
  if (directMatch) {
    const [, agentId, domain] = directMatch;
    
    const config = await getConfigByDomain(domain);
    if (!config) {
      return { configId: null, agentId: null };
    }
    
    // Verify agent exists and is active
    const agentExists = await verifyAgentEmail(agentId, config.id);
    if (!agentExists) {
      return { configId: config.id, agentId: null };
    }
    
    return { configId: config.id, agentId };
  }
  
  // Handle catch-all addresses
  const domain = toAddress.split('@')[1];
  const config = await getConfigByDomain(domain);
  
  return { configId: config?.id || null, agentId: null };
}
```

## Scheduled Actions Implementation

### Rule Processing Engine
```typescript
async function applyRoutingRules(
  emailId: string,
  configId: string,
  payload: InboundParsePayload
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Get active routing rules
  const { data: rules } = await supabase
    .from('email_routing_rules')
    .select('*')
    .eq('sendgrid_config_id', configId)
    .eq('is_active', true)
    .order('priority', { ascending: true });
  
  if (!rules || rules.length === 0) {
    return;
  }
  
  // Process each rule
  const appliedRules: string[] = [];
  
  for (const rule of rules) {
    if (await evaluateRuleConditions(rule.conditions, payload)) {
      // Execute rule actions
      await executeRuleActions(rule.actions, emailId, payload);
      appliedRules.push(rule.id);
      
      // Update rule statistics
      await supabase
        .from('email_routing_rules')
        .update({
          last_matched_at: new Date().toISOString(),
          match_count: rule.match_count + 1
        })
        .eq('id', rule.id);
      
      // Stop processing if rule is terminal
      if (rule.actions.stop_processing) {
        break;
      }
    }
  }
  
  // Update email with applied rules
  await supabase
    .from('inbound_emails')
    .update({ routing_rules_applied: appliedRules })
    .eq('id', emailId);
}
```

### Scheduled Action Triggers
```typescript
async function triggerEmailActions(
  emailId: string,
  agentId: string | null,
  payload: InboundParsePayload
): Promise<void> {
  // Check for scheduled actions based on email content
  const triggers = await identifyTriggers(payload);
  
  for (const trigger of triggers) {
    switch (trigger.type) {
      case 'agent_notification':
        await notifyAgent(agentId, emailId, trigger.data);
        break;
        
      case 'auto_reply':
        await sendAutoReply(payload.from, trigger.template_id);
        break;
        
      case 'webhook':
        await callWebhook(trigger.url, { emailId, payload });
        break;
        
      case 'schedule_task':
        await scheduleTask(trigger.task_type, trigger.schedule_at, { emailId });
        break;
        
      default:
        console.warn(`Unknown trigger type: ${trigger.type}`);
    }
  }
}
```

## Error Handling & Recovery

### Webhook Retry Logic
```typescript
async function handleWebhookFailure(
  error: Error,
  payload: InboundParsePayload,
  retryCount: number = 0
): Promise<void> {
  const maxRetries = 3;
  const retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
  
  // Log error
  console.error(`Webhook processing failed (attempt ${retryCount + 1}):`, error);
  
  // Store failed webhook for manual processing
  await storeFailedWebhook(payload, error.message);
  
  // Retry if within limit
  if (retryCount < maxRetries) {
    const delay = retryDelays[retryCount];
    console.log(`Retrying in ${delay}ms...`);
    
    setTimeout(async () => {
      try {
        await processWebhook(payload);
      } catch (retryError) {
        await handleWebhookFailure(retryError, payload, retryCount + 1);
      }
    }, delay);
  } else {
    // Send alert after max retries
    await sendAdminAlert('Webhook processing failed', {
      error: error.message,
      payload_summary: {
        from: payload.from,
        to: payload.to,
        subject: payload.subject
      }
    });
  }
}
```

## Monitoring & Logging

### Comprehensive Logging
```typescript
interface WebhookLog {
  webhook_type: 'inbound_parse' | 'event';
  status: 'success' | 'failure' | 'retry';
  payload_size: number;
  processing_time_ms: number;
  ip_address: string;
  signature_valid: boolean;
  error_message?: string;
  retry_count?: number;
}

async function logWebhookEvent(log: WebhookLog): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  await supabase
    .from('webhook_logs')
    .insert({
      ...log,
      created_at: new Date().toISOString()
    });
}
```

## Security Best Practices Summary

1. **Always verify webhook signatures**
2. **Implement rate limiting at multiple levels**
3. **Validate and sanitize all input data**
4. **Use secure attachment handling**
5. **Log all webhook events for audit**
6. **Implement retry logic with backoff**
7. **Monitor for suspicious patterns**
8. **Use HTTPS for all webhook endpoints**
9. **Rotate webhook signing keys periodically**
10. **Implement IP whitelisting where possible**