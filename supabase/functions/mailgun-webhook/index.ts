import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from "../_shared/cors.ts";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";

interface InboundEmailData {
  'Message-Id': string;
  recipient: string;
  sender: string;
  From: string;
  Subject: string;
  'body-plain': string;
  'body-html': string;
  timestamp: string;
  signature: string;
  token: string;
  'stripped-text'?: string;
  'stripped-html'?: string;
  'attachment-count'?: string;
}

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    console.log('[Mailgun Webhook] Processing inbound email');
    
    // Parse form data from Mailgun
    const formData = await req.formData();
    const emailData = parseInboundEmail(formData);
    
    // Verify webhook signature (simplified for now - implement full HMAC verification in production)
    const userAgent = req.headers.get('user-agent');
    const isValid = await verifyWebhookSignature(emailData, userAgent);
    
    if (!isValid) {
      console.warn('[Mailgun Webhook] Invalid webhook signature');
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process the inbound email
    await processInboundEmail(supabase, emailData);

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('[Mailgun Webhook] Processing error:', error);
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});

function parseInboundEmail(formData: FormData): InboundEmailData {
  const data: any = {};
  
  // Extract all form fields
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      data[key] = value;
    }
  }
  
  // Log received fields for debugging
  console.log('[Mailgun Webhook] Received fields:', Object.keys(data));
  
  return data as InboundEmailData;
}

async function verifyWebhookSignature(emailData: InboundEmailData, userAgent: string | null): Promise<boolean> {
  // Basic validation - check if request comes from Mailgun
  // In production, implement full HMAC-SHA256 signature verification
  // using the webhook signing key stored in mailgun_configurations
  
  // For now, just check user agent and presence of required fields
  if (!userAgent || !userAgent.toLowerCase().includes('mailgun')) {
    console.warn('[Mailgun Webhook] Invalid user agent:', userAgent);
    return false;
  }
  
  // Check for required Mailgun webhook fields
  if (!emailData.signature || !emailData.timestamp || !emailData.token) {
    console.warn('[Mailgun Webhook] Missing signature fields');
    return false;
  }
  
  // TODO: Implement full HMAC verification
  // const signingKey = await getWebhookSigningKey(emailData.recipient);
  // const expectedSignature = hmacSha256(timestamp + token, signingKey);
  // return signature === expectedSignature;
  
  return true;
}

async function processInboundEmail(supabase: any, emailData: InboundEmailData) {
  try {
    console.log(`[Mailgun Webhook] Processing email from ${emailData.From} to ${emailData.recipient}`);
    
    // Extract domain from recipient email
    const recipientDomain = emailData.recipient.split('@')[1];
    
    // Find matching route for the recipient
    const { data: routes, error: routeError } = await supabase
      .from('mailgun_routes')
      .select(`
        *,
        agent_id,
        mailgun_configurations!inner(
          user_id,
          domain
        )
      `)
      .eq('is_active', true)
      .eq('mailgun_configurations.domain', recipientDomain)
      .order('priority', { ascending: true });

    if (routeError) {
      console.error('[Mailgun Webhook] Error fetching routes:', routeError);
      await storeUnroutedEmail(supabase, emailData);
      return;
    }

    // Find matching route based on expression
    let matchedRoute = null;
    for (const route of routes || []) {
      if (evaluateRouteExpression(route.expression, emailData)) {
        matchedRoute = route;
        break;
      }
    }

    if (!matchedRoute) {
      console.log('[Mailgun Webhook] No matching route found, storing as unrouted');
      await storeUnroutedEmail(supabase, emailData);
      return;
    }

    console.log(`[Mailgun Webhook] Matched route: ${matchedRoute.description}`);
    
    // Log inbound email
    const { data: logEntry, error: logError } = await supabase
      .rpc('log_email_activity', {
        p_mailgun_message_id: emailData['Message-Id'],
        p_agent_id: matchedRoute.agent_id || null,
        p_user_id: matchedRoute.mailgun_configurations.user_id,
        p_direction: 'inbound',
        p_from_address: emailData.From,
        p_to_address: emailData.recipient,
        p_subject: emailData.Subject,
        p_status: 'received',
        p_event_data: emailData
      });

    if (logError) {
      console.error('[Mailgun Webhook] Failed to log email:', logError);
    }

    // If agent is assigned, create chat message for processing
    if (matchedRoute.agent_id) {
      await createAgentChatMessage(supabase, matchedRoute.agent_id, emailData);
    }
    
    // Execute route action
    await executeRouteAction(supabase, matchedRoute, emailData);
    
  } catch (error) {
    console.error('[Mailgun Webhook] Processing error:', error);
    throw error;
  }
}

function evaluateRouteExpression(expression: string, emailData: InboundEmailData): boolean {
  try {
    // Simple expression evaluation
    // Supports: match_recipient("email@domain.com")
    //          match_recipient(".*@domain.com")
    //          match_header("subject", ".*urgent.*")
    
    if (expression.includes('match_recipient')) {
      const match = expression.match(/match_recipient\("(.+?)"\)/);
      if (match) {
        const pattern = match[1];
        const regex = new RegExp(pattern);
        return regex.test(emailData.recipient);
      }
    }
    
    if (expression.includes('match_header')) {
      const match = expression.match(/match_header\("(.+?)",\s*"(.+?)"\)/);
      if (match) {
        const header = match[1];
        const pattern = match[2];
        const regex = new RegExp(pattern, 'i');
        
        if (header === 'subject') {
          return regex.test(emailData.Subject);
        }
        if (header === 'from') {
          return regex.test(emailData.From);
        }
      }
    }
    
    // Default: no match
    return false;
    
  } catch (error) {
    console.error('[Mailgun Webhook] Error evaluating expression:', error);
    return false;
  }
}

async function executeRouteAction(supabase: any, route: any, emailData: InboundEmailData) {
  try {
    // Parse action (e.g., forward("url"), store(), stop())
    if (route.action.includes('forward')) {
      const match = route.action.match(/forward\("(.+?)"\)/);
      if (match) {
        const url = match[1];
        
        // Forward to webhook URL if it's an HTTP endpoint
        if (url.startsWith('http')) {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(emailData)
          });
          
          if (!response.ok) {
            console.error(`[Mailgun Webhook] Failed to forward to ${url}: ${response.status}`);
          }
        }
      }
    }
    
    if (route.action.includes('store')) {
      // Email is already stored in email_logs
      console.log('[Mailgun Webhook] Email stored');
    }
    
    if (route.action.includes('stop')) {
      // Stop processing
      console.log('[Mailgun Webhook] Processing stopped by route action');
    }
    
  } catch (error) {
    console.error('[Mailgun Webhook] Error executing route action:', error);
  }
}

async function createAgentChatMessage(supabase: any, agentId: string, emailData: InboundEmailData) {
  try {
    // Create a formatted message for the agent
    const messageContent = `📧 **New Email Received**

**From:** ${emailData.From}
**To:** ${emailData.recipient}
**Subject:** ${emailData.Subject}
**Received:** ${new Date(parseInt(emailData.timestamp) * 1000).toLocaleString()}

**Message:**
${emailData['stripped-text'] || emailData['body-plain']}

---
*This email was automatically routed to you for processing. You can reply using the mailgun_send_email tool.*`;

    // Create chat message
    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        agent_id: agentId,
        content: messageContent,
        role: 'user',
        metadata: {
          type: 'email_inbound',
          email_data: {
            message_id: emailData['Message-Id'],
            from: emailData.From,
            to: emailData.recipient,
            subject: emailData.Subject,
            body: emailData['body-plain'],
            html: emailData['body-html'],
            timestamp: emailData.timestamp
          },
          requires_response: true,
          original_message_id: emailData['Message-Id']
        }
      })
      .select()
      .single();

    if (error) {
      console.error('[Mailgun Webhook] Failed to create chat message:', error);
      return;
    }

    console.log(`[Mailgun Webhook] Created chat message ${message.id} for agent ${agentId}`);
    
  } catch (error) {
    console.error('[Mailgun Webhook] Error creating agent message:', error);
  }
}

async function storeUnroutedEmail(supabase: any, emailData: InboundEmailData) {
  try {
    // Store unrouted emails for manual processing
    const { error } = await supabase
      .from('email_logs')
      .insert({
        mailgun_message_id: emailData['Message-Id'],
        direction: 'inbound',
        from_address: emailData.From,
        to_address: emailData.recipient,
        subject: emailData.Subject,
        status: 'unrouted',
        event_data: emailData
      });

    if (error) {
      console.error('[Mailgun Webhook] Failed to store unrouted email:', error);
    } else {
      console.log('[Mailgun Webhook] Stored unrouted email for manual processing');
    }
    
  } catch (error) {
    console.error('[Mailgun Webhook] Error storing unrouted email:', error);
  }
}
