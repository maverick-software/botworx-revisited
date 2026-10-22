# Mailgun Integration Plan for Agentopia MCP Architecture

**Project:** Mailgun Email Service Integration  
**Date:** January 25, 2025  
**Objective:** Integrate Mailgun Email API and Inbound Routing into Agentopia's existing MCP architecture and credentialing system

---

## 🎯 **Executive Summary**

This plan integrates Mailgun's comprehensive email services into Agentopia's existing MCP (Multi-Cloud Proxy) architecture and OAuth credentialing system. The integration follows established patterns for API key management, agent tool registration, and secure credential storage while adding powerful email capabilities to agents.

**Key Integration Points:**
- **MCP Tool Registration**: Mailgun tools registered alongside Gmail/SendGrid in function_calling.ts
- **Credential Management**: API keys stored securely via existing VaultService and user_oauth_connections
- **Agent Permissions**: Leverages existing agent_oauth_permissions for granular access control
- **Frontend Integration**: Follows established patterns from web search and Gmail integrations

---

## 📋 **Phase 1: Database Schema Integration**

### 1.1 OAuth Provider Registration

**Objective**: Register Mailgun as an API key provider in the existing OAuth system

**Database Changes:**
```sql
-- Insert Mailgun provider into existing oauth_providers table
INSERT INTO oauth_providers (
    id,
    name,
    display_name,
    provider_type,
    auth_url,
    token_url,
    scope,
    created_at
) VALUES (
    gen_random_uuid(),
    'mailgun',
    'Mailgun Email Service',
    'api_key',  -- Using existing credential_type enum
    NULL,       -- No OAuth URLs for API key providers
    NULL,
    'email_send,email_receive,email_analytics', -- Custom scopes for Mailgun
    NOW()
);
```

**Configuration Table:**
```sql
-- Create Mailgun-specific configuration table
CREATE TABLE mailgun_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_oauth_connection_id UUID REFERENCES user_oauth_connections(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    region VARCHAR(50) DEFAULT 'us',
    webhook_signing_key_id UUID REFERENCES vault.secrets(id),
    smtp_username VARCHAR(255),
    smtp_password_id UUID REFERENCES vault.secrets(id),
    webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_mailgun UNIQUE(user_id)
);
```

**Email Routing Rules:**
```sql
-- Mailgun inbound routing configuration
CREATE TABLE mailgun_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailgun_config_id UUID REFERENCES mailgun_configurations(id) ON DELETE CASCADE,
    mailgun_route_id VARCHAR(255), -- Mailgun's route ID
    priority INTEGER NOT NULL DEFAULT 0,
    expression TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Email Activity Logging:**
```sql
-- Email activity tracking
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailgun_message_id VARCHAR(255),
    agent_id UUID REFERENCES agents(id),
    user_id UUID REFERENCES auth.users(id),
    direction email_direction_enum NOT NULL, -- 'inbound' | 'outbound'
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    subject TEXT,
    status VARCHAR(50),
    event_data JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_email_logs_agent (agent_id),
    INDEX idx_email_logs_user (user_id),
    INDEX idx_email_logs_direction (direction),
    INDEX idx_email_logs_processed (processed_at)
);

-- Email direction enum
CREATE TYPE email_direction_enum AS ENUM ('inbound', 'outbound');
```

---

## 📋 **Phase 2: Backend Integration**

### 2.1 MCP Tool Registration

**File**: `supabase/functions/chat/function_calling.ts`

**Add Mailgun Tools Registry:**
```typescript
/**
 * Mailgun MCP Tools Registry
 */
export const MAILGUN_MCP_TOOLS: Record<string, MCPTool> = {
  send_email: {
    name: 'mailgun_send_email',
    description: 'Send an email via Mailgun Email API. Use when user requests email sending with high deliverability requirements.',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        text: {
          type: 'string',
          description: 'Plain text email body',
        },
        html: {
          type: 'string',
          description: 'HTML email body (optional)',
        },
        from: {
          type: 'string',
          description: 'From email address (must be from verified domain)',
        },
        cc: {
          type: 'array',
          description: 'CC recipients',
          items: { type: 'string' }
        },
        bcc: {
          type: 'array', 
          description: 'BCC recipients',
          items: { type: 'string' }
        },
        attachments: {
          type: 'array',
          description: 'Email attachments',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string', description: 'Base64 encoded content' },
              contentType: { type: 'string' }
            }
          }
        },
        template: {
          type: 'string',
          description: 'Mailgun template name (optional)'
        },
        template_variables: {
          type: 'object',
          description: 'Template variables for personalization'
        },
        scheduled_time: {
          type: 'string',
          description: 'Schedule email for future delivery (RFC 2822 format)'
        },
        tags: {
          type: 'array',
          description: 'Email tags for tracking',
          items: { type: 'string' }
        }
      },
      required: ['to', 'subject', 'from'],
    },
    required_scopes: ['email_send'],
  },

  validate_email: {
    name: 'mailgun_validate_email',
    description: 'Validate an email address using Mailgun validation service.',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address to validate'
        }
      },
      required: ['email']
    },
    required_scopes: ['email_validate'],
  },

  get_email_stats: {
    name: 'mailgun_get_stats',
    description: 'Get email delivery statistics and analytics.',
    parameters: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date for stats (YYYY-MM-DD)'
        },
        end_date: {
          type: 'string', 
          description: 'End date for stats (YYYY-MM-DD)'
        },
        resolution: {
          type: 'string',
          enum: ['hour', 'day', 'month'],
          description: 'Time resolution for stats'
        }
      }
    },
    required_scopes: ['email_analytics'],
  },

  manage_suppressions: {
    name: 'mailgun_manage_suppressions',
    description: 'Manage email suppressions (bounces, unsubscribes, complaints).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'add', 'remove'],
          description: 'Action to perform'
        },
        type: {
          type: 'string',
          enum: ['bounces', 'unsubscribes', 'complaints'],
          description: 'Suppression list type'
        },
        email: {
          type: 'string',
          description: 'Email address for add/remove actions'
        }
      },
      required: ['action', 'type']
    },
    required_scopes: ['email_manage'],
  }
};
```

**Update FunctionCallingManager:**
```typescript
export class FunctionCallingManager {
  // ... existing code ...

  async getAvailableTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    const tools: OpenAIFunction[] = [];
    
    // ... existing Gmail and Web Search tools ...
    
    // Add Mailgun tools
    const mailgunTools = await this.getMailgunTools(agentId, userId);
    tools.push(...mailgunTools);
    
    return tools;
  }

  /**
   * Get available Mailgun tools for agent
   */
  private async getMailgunTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
    try {
      // Check if user has Mailgun API key configured
      const { data: connections, error } = await this.supabase
        .from('user_oauth_connections')
        .select(`
          id,
          connection_status,
          oauth_providers!inner(name),
          agent_oauth_permissions!inner(permissions)
        `)
        .eq('user_id', userId)
        .eq('oauth_providers.name', 'mailgun')
        .eq('credential_type', 'api_key')
        .eq('connection_status', 'connected')
        .eq('agent_oauth_permissions.agent_id', agentId)
        .eq('agent_oauth_permissions.is_active', true);

      if (error || !connections?.length) {
        console.log(`No Mailgun credentials found for agent ${agentId}`);
        return [];
      }

      // Convert Mailgun tools to OpenAI function format
      const availableTools: OpenAIFunction[] = [];
      const permissions = connections[0].agent_oauth_permissions?.permissions || [];

      Object.values(MAILGUN_MCP_TOOLS).forEach(tool => {
        // Check if agent has required scopes
        const hasRequiredScopes = tool.required_scopes?.every(scope => 
          permissions.includes(scope)
        ) ?? true;

        if (hasRequiredScopes) {
          availableTools.push({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          });
        }
      });

      console.log(`Found ${availableTools.length} Mailgun tools for agent ${agentId}`);
      return availableTools;

    } catch (error) {
      console.error('Error fetching Mailgun tools:', error);
      return [];
    }
  }

  /**
   * Execute function call - Update routing
   */
  async executeFunction(
    agentId: string,
    userId: string, 
    functionName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    // ... existing routing logic ...
    
    // Add Mailgun routing
    if (Object.keys(MAILGUN_MCP_TOOLS).includes(functionName)) {
      return await this.executeMailgunTool(agentId, userId, functionName, parameters);
    }
    
    // ... rest of existing logic ...
  }

  /**
   * Execute Mailgun tool
   */
  private async executeMailgunTool(
    agentId: string,
    userId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[Mailgun] Executing ${toolName} for agent ${agentId}`);
      
      // Call Mailgun service function
      const { data, error } = await this.supabase.functions.invoke('mailgun-service', {
        body: {
          action: toolName.replace('mailgun_', ''), // Remove prefix
          agent_id: agentId,
          user_id: userId,
          parameters
        }
      });

      if (error) {
        throw new Error(`Mailgun API error: ${error.message}`);
      }

      return {
        success: true,
        data: data,
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'mailgun',
          tool_name: toolName
        }
      };

    } catch (error) {
      console.error(`[Mailgun] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          execution_time_ms: Date.now() - startTime,
          provider: 'mailgun',
          tool_name: toolName
        }
      };
    }
  }
}
```

### 2.2 Mailgun Service Function

**File**: `supabase/functions/mailgun-service/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from "../_shared/cors.ts";

interface MailgunRequest {
  action: 'send_email' | 'validate_email' | 'get_stats' | 'manage_suppressions';
  agent_id: string;
  user_id: string;
  parameters: Record<string, any>;
}

interface MailgunConfig {
  domain: string;
  api_key: string;
  region: string;
  webhook_signing_key?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, agent_id, user_id, parameters }: MailgunRequest = await req.json();
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Mailgun configuration for user
    const config = await getMailgunConfig(supabase, user_id);
    if (!config) {
      throw new Error('Mailgun not configured for this user');
    }

    // Route to appropriate handler
    let result;
    switch (action) {
      case 'send_email':
        result = await handleSendEmail(config, parameters, agent_id, user_id, supabase);
        break;
      case 'validate_email':
        result = await handleValidateEmail(config, parameters);
        break;
      case 'get_stats':
        result = await handleGetStats(config, parameters);
        break;
      case 'manage_suppressions':
        result = await handleManageSuppressions(config, parameters);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Mailgun service error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function getMailgunConfig(supabase: any, userId: string): Promise<MailgunConfig | null> {
  // Get user's Mailgun configuration
  const { data: config, error: configError } = await supabase
    .from('mailgun_configurations')
    .select(`
      domain,
      region,
      user_oauth_connections!inner(
        vault_access_token_id,
        oauth_providers!inner(name)
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('user_oauth_connections.oauth_providers.name', 'mailgun')
    .single();

  if (configError || !config) {
    console.error('Failed to get Mailgun config:', configError);
    return null;
  }

  // Get API key from vault
  const { data: apiKey, error: keyError } = await supabase
    .rpc('get_secret', { 
      secret_id: config.user_oauth_connections.vault_access_token_id 
    });

  if (keyError || !apiKey) {
    console.error('Failed to get Mailgun API key:', keyError);
    return null;
  }

  return {
    domain: config.domain,
    api_key: apiKey,
    region: config.region || 'us'
  };
}

async function handleSendEmail(
  config: MailgunConfig, 
  params: any, 
  agentId: string, 
  userId: string,
  supabase: any
) {
  const apiUrl = `https://api.mailgun.net/v3/${config.domain}/messages`;
  
  // Prepare form data for Mailgun API
  const formData = new FormData();
  formData.append('from', params.from);
  formData.append('to', params.to);
  formData.append('subject', params.subject);
  
  if (params.text) formData.append('text', params.text);
  if (params.html) formData.append('html', params.html);
  if (params.cc) params.cc.forEach((cc: string) => formData.append('cc', cc));
  if (params.bcc) params.bcc.forEach((bcc: string) => formData.append('bcc', bcc));
  
  // Add optional parameters
  if (params.template) formData.append('template', params.template);
  if (params.template_variables) {
    formData.append('h:X-Mailgun-Variables', JSON.stringify(params.template_variables));
  }
  if (params.scheduled_time) formData.append('o:deliverytime', params.scheduled_time);
  if (params.tags) params.tags.forEach((tag: string) => formData.append('o:tag', tag));
  
  // Handle attachments
  if (params.attachments) {
    params.attachments.forEach((attachment: any, index: number) => {
      const blob = new Blob([Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0))], {
        type: attachment.contentType
      });
      formData.append('attachment', blob, attachment.filename);
    });
  }

  // Send email via Mailgun
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
    },
    body: formData
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun API error: ${result.message || 'Unknown error'}`);
  }

  // Log email activity
  await logEmailActivity(supabase, {
    mailgun_message_id: result.id,
    agent_id: agentId,
    user_id: userId,
    direction: 'outbound',
    from_address: params.from,
    to_address: params.to,
    subject: params.subject,
    status: 'sent',
    event_data: result
  });

  return {
    success: true,
    message_id: result.id,
    message: result.message
  };
}

async function handleValidateEmail(config: MailgunConfig, params: any) {
  const apiUrl = `https://api.mailgun.net/v4/address/validate`;
  
  const response = await fetch(`${apiUrl}?address=${encodeURIComponent(params.email)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
    }
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun validation error: ${result.message || 'Unknown error'}`);
  }

  return {
    success: true,
    is_valid: result.is_valid,
    address: result.address,
    did_you_mean: result.did_you_mean,
    is_disposable_address: result.is_disposable_address,
    is_role_address: result.is_role_address,
    reason: result.reason,
    risk: result.risk
  };
}

async function handleGetStats(config: MailgunConfig, params: any) {
  const apiUrl = `https://api.mailgun.net/v3/${config.domain}/stats/total`;
  const queryParams = new URLSearchParams();
  
  if (params.start_date) queryParams.append('start', params.start_date);
  if (params.end_date) queryParams.append('end', params.end_date);
  if (params.resolution) queryParams.append('resolution', params.resolution);
  
  const response = await fetch(`${apiUrl}?${queryParams}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
    }
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun stats error: ${result.message || 'Unknown error'}`);
  }

  return {
    success: true,
    stats: result.stats
  };
}

async function handleManageSuppressions(config: MailgunConfig, params: any) {
  const { action, type, email } = params;
  const apiUrl = `https://api.mailgun.net/v3/${config.domain}/${type}`;
  
  let response;
  switch (action) {
    case 'get':
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
        }
      });
      break;
      
    case 'add':
      if (!email) throw new Error('Email required for add action');
      const formData = new FormData();
      formData.append('address', email);
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
        },
        body: formData
      });
      break;
      
    case 'remove':
      if (!email) throw new Error('Email required for remove action');
      response = await fetch(`${apiUrl}/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`
        }
      });
      break;
      
    default:
      throw new Error(`Invalid suppression action: ${action}`);
  }

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`Mailgun suppression error: ${result.message || 'Unknown error'}`);
  }

  return {
    success: true,
    data: result
  };
}

async function logEmailActivity(supabase: any, logData: any) {
  const { error } = await supabase
    .from('email_logs')
    .insert(logData);
    
  if (error) {
    console.error('Failed to log email activity:', error);
  }
}
```

### 2.3 Inbound Email Webhook Handler

**File**: `supabase/functions/mailgun-webhook/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from "../_shared/cors.ts";

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
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Parse form data from Mailgun
    const formData = await req.formData();
    const emailData = parseInboundEmail(formData);
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(emailData, req.headers.get('user-agent'));
    if (!isValid) {
      console.warn('Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find matching route and process email
    await processInboundEmail(supabase, emailData);

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Internal Server Error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});

function parseInboundEmail(formData: FormData): InboundEmailData {
  const data: any = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      data[key] = value;
    }
  }
  return data as InboundEmailData;
}

async function verifyWebhookSignature(emailData: InboundEmailData, userAgent: string | null): Promise<boolean> {
  // Implement Mailgun webhook signature verification
  // This is a simplified version - implement proper HMAC verification in production
  return userAgent?.includes('Mailgun') ?? false;
}

async function processInboundEmail(supabase: any, emailData: InboundEmailData) {
  // Find matching route for the recipient
  const { data: route, error: routeError } = await supabase
    .from('mailgun_routes')
    .select(`
      *,
      agent_id,
      mailgun_configurations!inner(user_id)
    `)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1);

  if (routeError || !route?.length) {
    console.log('No matching route found, storing as unrouted email');
    await storeUnroutedEmail(supabase, emailData);
    return;
  }

  const matchedRoute = route[0];
  
  // Log inbound email
  await supabase
    .from('email_logs')
    .insert({
      mailgun_message_id: emailData['Message-Id'],
      agent_id: matchedRoute.agent_id,
      user_id: matchedRoute.mailgun_configurations.user_id,
      direction: 'inbound',
      from_address: emailData.From,
      to_address: emailData.recipient,
      subject: emailData.Subject,
      status: 'received',
      event_data: emailData
    });

  // If agent is assigned, create chat message for processing
  if (matchedRoute.agent_id) {
    await createAgentChatMessage(supabase, matchedRoute.agent_id, emailData);
  }
}

async function createAgentChatMessage(supabase: any, agentId: string, emailData: InboundEmailData) {
  // Create a chat message for the agent to process
  const messageContent = `📧 **New Email Received**

**From:** ${emailData.From}
**Subject:** ${emailData.Subject}
**Received:** ${new Date(parseInt(emailData.timestamp) * 1000).toLocaleString()}

**Message:**
${emailData['body-plain']}

---
*This email was automatically routed to you for processing. You can reply using the send_email tool.*`;

  const { data: message, error } = await supabase
    .from('chat_messages')
    .insert({
      agent_id: agentId,
      content: messageContent,
      message_type: 'email_inbound',
      metadata: {
        email_data: emailData,
        requires_response: true,
        original_message_id: emailData['Message-Id']
      }
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create chat message:', error);
    return;
  }

  // Optionally trigger agent processing
  console.log(`Created chat message ${message.id} for agent ${agentId}`);
}

async function storeUnroutedEmail(supabase: any, emailData: InboundEmailData) {
  // Store unrouted emails for manual processing
  await supabase
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
}
```

---

## 📋 **Phase 3: Frontend Integration**

### 3.1 Mailgun Configuration Hook

**File**: `src/hooks/useMailgunIntegration.ts`

```typescript
import { useState, useEffect } from 'react';
import { useSupabaseClient } from './useSupabaseClient';
import { VaultService } from '../services/VaultService';
import { toast } from 'react-hot-toast';

interface MailgunConfig {
  id?: string;
  domain: string;
  region: string;
  webhook_url?: string;
  is_active: boolean;
}

interface MailgunRoute {
  id?: string;
  priority: number;
  expression: string;
  action: string;
  description: string;
  agent_id?: string;
  is_active: boolean;
}

export function useMailgunIntegration() {
  const supabase = useSupabaseClient();
  const [configuration, setConfiguration] = useState<MailgunConfig | null>(null);
  const [routes, setRoutes] = useState<MailgunRoute[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing configuration
  useEffect(() => {
    loadConfiguration();
    loadRoutes();
  }, []);

  const loadConfiguration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('mailgun_configurations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        console.error('Error loading Mailgun config:', error);
        return;
      }

      if (data) {
        setConfiguration(data);
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const loadRoutes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('mailgun_routes')
        .select(`
          *,
          mailgun_configurations!inner(user_id)
        `)
        .eq('mailgun_configurations.user_id', user.id)
        .order('priority', { ascending: true });

      if (error) {
        console.error('Error loading routes:', error);
        return;
      }

      setRoutes(data || []);
    } catch (error) {
      console.error('Error loading routes:', error);
    }
  };

  const saveConfiguration = async (config: {
    domain: string;
    apiKey: string;
    region?: string;
    webhookUrl?: string;
  }) => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Store API key in vault
      const vaultService = new VaultService(supabase);
      const apiKeyId = await vaultService.createSecret(
        `mailgun_api_key_${user.id}`,
        config.apiKey,
        `Mailgun API key for domain ${config.domain}`
      );

      // Create OAuth provider connection
      const { data: provider } = await supabase
        .from('oauth_providers')
        .select('id')
        .eq('name', 'mailgun')
        .single();

      if (!provider) {
        throw new Error('Mailgun provider not found in database');
      }

      // Create user OAuth connection
      const { data: connection, error: connectionError } = await supabase
        .from('user_oauth_connections')
        .insert({
          user_id: user.id,
          provider_id: provider.id,
          credential_type: 'api_key',
          connection_status: 'connected',
          vault_access_token_id: apiKeyId
        })
        .select()
        .single();

      if (connectionError) throw connectionError;

      // Create or update Mailgun configuration
      const configData = {
        user_id: user.id,
        user_oauth_connection_id: connection.id,
        domain: config.domain,
        region: config.region || 'us',
        webhook_url: config.webhookUrl,
        is_active: true
      };

      const { data, error } = await supabase
        .from('mailgun_configurations')
        .upsert(configData)
        .select()
        .single();

      if (error) throw error;

      setConfiguration(data);
      toast.success('Mailgun configuration saved successfully');
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error(`Failed to save configuration: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createRoute = async (route: Omit<MailgunRoute, 'id'>) => {
    setIsLoading(true);
    
    try {
      if (!configuration) {
        throw new Error('Mailgun not configured');
      }

      // First create route in Mailgun via API
      const { data: mailgunRoute, error: apiError } = await supabase.functions.invoke('mailgun-service', {
        body: {
          action: 'create_route',
          parameters: {
            priority: route.priority,
            expression: route.expression,
            action: route.action,
            description: route.description
          }
        }
      });

      if (apiError) throw apiError;

      // Store route in database
      const { data, error } = await supabase
        .from('mailgun_routes')
        .insert({
          mailgun_config_id: configuration.id,
          mailgun_route_id: mailgunRoute.id,
          ...route
        })
        .select()
        .single();

      if (error) throw error;

      setRoutes(prev => [...prev, data]);
      toast.success('Route created successfully');
      
    } catch (error) {
      console.error('Error creating route:', error);
      toast.error(`Failed to create route: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoute = async (routeId: string) => {
    setIsLoading(true);
    
    try {
      const route = routes.find(r => r.id === routeId);
      if (!route) throw new Error('Route not found');

      // Delete from Mailgun first
      await supabase.functions.invoke('mailgun-service', {
        body: {
          action: 'delete_route',
          parameters: {
            route_id: route.mailgun_route_id
          }
        }
      });

      // Delete from database
      const { error } = await supabase
        .from('mailgun_routes')
        .delete()
        .eq('id', routeId);

      if (error) throw error;

      setRoutes(prev => prev.filter(r => r.id !== routeId));
      toast.success('Route deleted successfully');
      
    } catch (error) {
      console.error('Error deleting route:', error);
      toast.error(`Failed to delete route: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('mailgun-service', {
        body: {
          action: 'test_connection',
          parameters: {}
        }
      });

      if (error) throw error;

      toast.success('Mailgun connection test successful');
      return true;
      
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error(`Connection test failed: ${error.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    configuration,
    routes,
    isLoading,
    saveConfiguration,
    createRoute,
    deleteRoute,
    testConnection,
    loadConfiguration,
    loadRoutes
  };
}
```

### 3.2 Mailgun Configuration Component

**File**: `src/components/integrations/MailgunIntegration.tsx`

```typescript
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMailgunIntegration } from '@/hooks/useMailgunIntegration';
import { Mail, Key, Settings, Route, TestTube } from 'lucide-react';

export const MailgunIntegration: React.FC = () => {
  const {
    configuration,
    routes,
    isLoading,
    saveConfiguration,
    createRoute,
    deleteRoute,
    testConnection
  } = useMailgunIntegration();

  const [configForm, setConfigForm] = useState({
    domain: configuration?.domain || '',
    apiKey: '',
    region: configuration?.region || 'us',
    webhookUrl: configuration?.webhook_url || ''
  });

  const [routeForm, setRouteForm] = useState({
    priority: 0,
    expression: '',
    action: '',
    description: '',
    agent_id: ''
  });

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveConfiguration(configForm);
  };

  const handleRouteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRoute(routeForm);
    setRouteForm({
      priority: 0,
      expression: '',
      action: '',
      description: '',
      agent_id: ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Mail className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Mailgun Integration</h2>
            <p className="text-muted-foreground">
              Configure Mailgun for high-deliverability email sending and inbound routing
            </p>
          </div>
        </div>
        
        {configuration && (
          <div className="flex items-center space-x-2">
            <Badge variant={configuration.is_active ? "default" : "secondary"}>
              {configuration.is_active ? "Active" : "Inactive"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={isLoading}
            >
              <TestTube className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="configuration" className="space-y-6">
        <TabsList>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="routing">
            <Route className="h-4 w-4 mr-2" />
            Email Routing
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="h-5 w-5" />
                <span>API Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure your Mailgun domain and API credentials for email sending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleConfigSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Mailgun Domain</Label>
                    <Input
                      id="domain"
                      value={configForm.domain}
                      onChange={(e) => setConfigForm(prev => ({ ...prev, domain: e.target.value }))}
                      placeholder="mail.yourdomain.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select 
                      value={configForm.region}
                      onValueChange={(value) => setConfigForm(prev => ({ ...prev, region: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us">US</SelectItem>
                        <SelectItem value="eu">EU</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={configForm.apiKey}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="key-your-mailgun-api-key"
                    required={!configuration}
                  />
                  {configuration && (
                    <p className="text-sm text-muted-foreground">
                      Leave empty to keep existing API key
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL (Optional)</Label>
                  <Input
                    id="webhookUrl"
                    value={configForm.webhookUrl}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://your-app.com/webhook/mailgun"
                  />
                </div>

                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : 'Save Configuration'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Routing Tab */}
        <TabsContent value="routing">
          <div className="space-y-6">
            {/* Create Route Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create Email Route</CardTitle>
                <CardDescription>
                  Define rules for routing inbound emails to specific agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRouteSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Input
                        id="priority"
                        type="number"
                        value={routeForm.priority}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                        placeholder="0"
                        min="0"
                        max="32767"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agentId">Assign to Agent (Optional)</Label>
                      <Select
                        value={routeForm.agent_id}
                        onValueChange={(value) => setRouteForm(prev => ({ ...prev, agent_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* TODO: Load agents from useAgents hook */}
                          <SelectItem value="">No Agent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expression">Route Expression</Label>
                    <Input
                      id="expression"
                      value={routeForm.expression}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, expression: e.target.value }))}
                      placeholder='match_recipient("support@yourdomain.com")'
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="action">Action</Label>
                    <Input
                      id="action"
                      value={routeForm.action}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, action: e.target.value }))}
                      placeholder='forward("https://your-app.com/webhook")'
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={routeForm.description}
                      onChange={(e) => setRouteForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Route description"
                    />
                  </div>

                  <Button type="submit" disabled={isLoading || !configuration}>
                    Create Route
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Existing Routes */}
            <Card>
              <CardHeader>
                <CardTitle>Email Routes</CardTitle>
                <CardDescription>
                  Manage your inbound email routing rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                {routes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No email routes configured
                  </p>
                ) : (
                  <div className="space-y-3">
                    {routes.map((route) => (
                      <div
                        key={route.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">Priority: {route.priority}</Badge>
                            <Badge variant={route.is_active ? "default" : "secondary"}>
                              {route.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="font-medium mt-1">{route.description}</p>
                          <p className="text-sm text-muted-foreground">
                            Expression: {route.expression}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Action: {route.action}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteRoute(route.id!)}
                          disabled={isLoading}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
```

### 3.3 Integration into Existing Pages

**Update**: `src/pages/IntegrationsPage.tsx`

```typescript
// Add Mailgun to the integrations list
const integrations = [
  // ... existing integrations ...
  {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'High-deliverability email sending and inbound routing',
    icon: Mail,
    color: 'orange',
    status: 'available',
    category: 'Email',
    component: MailgunIntegration
  },
  // ... rest of integrations
];
```

**Update**: `src/pages/agents/[agentId]/edit.tsx`

Add Mailgun permissions to the agent permissions section:

```typescript
// In the agent permissions/tools section
const availableMailgunScopes = [
  'email_send',
  'email_receive', 
  'email_analytics',
  'email_validate',
  'email_manage'
];

// Add to the permissions UI
{userConnections.filter(conn => conn.oauth_providers.name === 'mailgun').map(connection => (
  <PermissionCard
    key={connection.id}
    connection={connection}
    availableScopes={availableMailgunScopes}
    onPermissionChange={handlePermissionChange}
  />
))}
```

---

## 📋 **Phase 4: Testing & Validation**

### 4.1 Integration Testing Checklist

**Database Schema Testing:**
- [ ] Mailgun provider inserted into oauth_providers
- [ ] mailgun_configurations table created with proper constraints
- [ ] mailgun_routes table created with foreign keys
- [ ] email_logs table created with indexes
- [ ] All RLS policies applied correctly

**Backend Function Testing:**
- [ ] mailgun-service function handles all tool actions
- [ ] API key retrieval from Vault works correctly
- [ ] Email sending via Mailgun API successful
- [ ] Email validation API integration working
- [ ] Statistics retrieval functional
- [ ] Suppression management working
- [ ] Webhook signature verification implemented
- [ ] Inbound email parsing and routing functional

**Frontend Integration Testing:**
- [ ] Mailgun configuration form saves correctly
- [ ] API keys stored securely in Vault
- [ ] Route creation and management working
- [ ] Agent permission assignment functional
- [ ] Integration status displays correctly
- [ ] Connection testing works

**Agent Tool Testing:**
- [ ] Mailgun tools appear in agent tool list
- [ ] Tool permissions filter correctly
- [ ] Email sending tool executes successfully
- [ ] Email validation tool returns correct results
- [ ] Statistics tool provides analytics data
- [ ] Suppression management tools functional

### 4.2 Security Validation

**Credential Security:**
- [ ] API keys stored only in Supabase Vault
- [ ] No credentials exposed in client-side code
- [ ] Webhook signature verification prevents spoofing
- [ ] RLS policies prevent cross-user data access
- [ ] Agent permissions properly scoped

**Data Privacy:**
- [ ] Email content processed server-side only
- [ ] Sensitive data encrypted at rest
- [ ] Audit trails for all email operations
- [ ] GDPR compliance for EU users
- [ ] Data retention policies implemented

### 4.3 Performance Testing

**Load Testing:**
- [ ] Bulk email sending performance
- [ ] Webhook processing under load
- [ ] Database query optimization
- [ ] API rate limit handling
- [ ] Error recovery mechanisms

---

## 📋 **Phase 5: Documentation & Deployment**

### 5.1 User Documentation

**Integration Guide:**
- Step-by-step Mailgun setup instructions
- Domain verification process
- Webhook configuration guide
- Route expression examples
- Troubleshooting common issues

**Agent Usage Guide:**
- How to assign Mailgun tools to agents
- Email sending best practices
- Inbound email processing workflows
- Analytics and monitoring usage

### 5.2 Developer Documentation

**API Reference:**
- Mailgun service function endpoints
- Database schema documentation
- Webhook payload specifications
- Error handling guidelines

**Extension Points:**
- Adding new Mailgun features
- Custom route expressions
- Advanced email templates
- Integration with other services

### 5.3 Deployment Checklist

**Production Readiness:**
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Supabase functions deployed
- [ ] Webhook URLs configured in Mailgun
- [ ] DNS records verified for domains
- [ ] SSL certificates valid
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested

---

## 🎯 **Success Metrics**

### Key Performance Indicators

**Integration Adoption:**
- Number of users configuring Mailgun
- Number of agents using Mailgun tools
- Email volume processed through platform

**Deliverability Metrics:**
- Email delivery success rate (target: >95%)
- Bounce rate (target: <5%)
- Spam complaint rate (target: <0.1%)

**User Experience:**
- Integration setup completion rate
- Tool usage frequency
- User satisfaction scores

**Technical Performance:**
- API response times (target: <2s)
- Webhook processing latency (target: <500ms)
- Error rates (target: <1%)

---

## 🔄 **Future Enhancements**

### Phase 2 Features

**Advanced Email Features:**
- Email template management
- A/B testing capabilities
- Advanced analytics dashboard
- Email campaign automation

**Enhanced Routing:**
- Machine learning-based routing
- Content-based classification
- Multi-agent collaboration workflows
- Priority-based processing

**Enterprise Features:**
- Multi-domain support
- Advanced compliance reporting
- Custom webhook processing
- Integration with CRM systems

---

This comprehensive plan integrates Mailgun seamlessly into Agentopia's existing architecture while maintaining security, scalability, and user experience standards. The implementation follows established patterns and provides a solid foundation for future email service enhancements.
