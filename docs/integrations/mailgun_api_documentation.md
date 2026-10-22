# Mailgun API & Email Routing Documentation for Agentopia

**Version:** 1.0  
**Date:** January 25, 2025  
**Purpose:** Complete integration guide for Mailgun Email API and Inbound Email Routing in Agentopia's agentic system

## Table of Contents

- [Overview](#overview)
- [Mailgun Email API](#mailgun-email-api)
- [Inbound Email Routing](#inbound-email-routing)
- [Integration Architecture](#integration-architecture)
- [Implementation Guide](#implementation-guide)
- [Security & Compliance](#security--compliance)
- [Code Examples](#code-examples)
- [Troubleshooting](#troubleshooting)

## Overview

Mailgun provides a comprehensive email infrastructure platform that enables Agentopia's agents to send, receive, and process emails at scale. This documentation covers both outbound email delivery via the Mailgun Email API and inbound email processing through Mailgun's routing system.

**Key Benefits for Agentopia:**
- **Agent Email Communication**: Agents can send emails on behalf of users
- **Inbound Email Processing**: Automatic parsing and routing of incoming emails to agents
- **High Deliverability**: 99.99% server uptime with enterprise-grade infrastructure
- **Real-time Analytics**: Complete visibility into email performance and delivery
- **Compliance**: SOC I & II, GDPR, HIPAA, and ISO 27001 certified

## Mailgun Email API

### Core Features

#### 1. **RESTful API Architecture**
- **Endpoint**: `https://api.mailgun.net/v3/`
- **Authentication**: API key-based authentication
- **Format**: JSON request/response with HTTP status codes
- **Rate Limits**: Varies by plan (free: 100 emails/day, paid plans: higher limits)

#### 2. **Dual Integration Options**
- **REST API**: Full-featured HTTP API with advanced capabilities
- **SMTP**: Standard SMTP protocol support for legacy systems
- **Hybrid**: Can use both methods simultaneously

#### 3. **Advanced Sending Features**
- **Batch Sending**: Up to 1,000 personalized emails per request
- **Template System**: Store and manage HTML templates (100 per domain, 10 versions each)
- **Scheduled Delivery**: Queue emails for future delivery
- **A/B Testing**: Built-in segmentation for testing email variants
- **Personalization**: Dynamic content insertion with variables

#### 4. **Deliverability Optimization**
- **Dedicated IPs**: Available on Foundation plan and above
- **IP Warmup**: Automated reputation building for new IPs
- **Domain Authentication**: SPF, DKIM, and DMARC support
- **Reputation Protection**: Automatic bounce and suppression management

### API Endpoints for Agentopia Integration

#### Send Email Endpoint
```
POST https://api.mailgun.net/v3/{domain}/messages
```

**Key Parameters:**
- `from`: Sender address (must be from verified domain)
- `to`: Recipient address(es)
- `subject`: Email subject line
- `text`: Plain text body
- `html`: HTML body
- `template`: Template name (if using templates)
- `h:X-Mailgun-Variables`: JSON string for template variables

#### Email Validation Endpoint
```
GET https://api.mailgun.net/v4/address/validate
```

**Use Case**: Validate email addresses before sending to improve deliverability

#### Suppression Management
```
GET/POST/DELETE https://api.mailgun.net/v3/{domain}/bounces
GET/POST/DELETE https://api.mailgun.net/v3/{domain}/unsubscribes
GET/POST/DELETE https://api.mailgun.net/v3/{domain}/complaints
```

**Use Case**: Manage bounced, unsubscribed, and spam-complained addresses

### Real-time Analytics & Monitoring

#### Event Tracking
- **Delivered**: Email successfully delivered to recipient's server
- **Opened**: Recipient opened the email (pixel tracking)
- **Clicked**: Recipient clicked a link in the email
- **Unsubscribed**: Recipient unsubscribed from mailing list
- **Complained**: Recipient marked email as spam
- **Bounced**: Email delivery failed (permanent or temporary)

#### Webhook Integration
```
POST {your_webhook_url}
```

**Payload**: Real-time event data in JSON format for immediate processing

## Inbound Email Routing

### Core Capabilities

#### 1. **Email Parsing Engine**
- **Full UTF-8 Conversion**: All incoming emails converted to UTF-8 JSON
- **Content Extraction**: Separates headers, body, attachments
- **Signature Removal**: Automatically removes email signatures and thread content
- **Attachment Handling**: Processes and provides attachment metadata

#### 2. **Intelligent Routing System**
- **Pattern Matching**: Route emails based on recipient patterns
- **Conditional Logic**: Complex routing rules with multiple conditions
- **Failover Options**: Backup routing for unmatched emails
- **Priority Handling**: Process urgent emails first

#### 3. **Automation Integration**
- **Webhook Delivery**: Send parsed emails to your application via HTTP POST
- **Mailbox Forwarding**: Forward emails to existing mailboxes
- **Action Triggers**: Trigger automated workflows based on email content
- **CRM Integration**: Direct integration with customer management systems

### Routing Configuration

#### Route Creation
```
POST https://api.mailgun.net/v3/routes
```

**Parameters:**
- `priority`: Route priority (0-32767, lower = higher priority)
- `description`: Human-readable route description
- `expression`: Pattern matching expression
- `action`: Action to take when route matches

#### Expression Patterns
- `match_recipient("support@yourdomain.com")`: Exact recipient match
- `match_recipient(".*@yourdomain.com")`: Domain-wide matching
- `match_header("subject", ".*urgent.*")`: Subject line matching
- `match_header("from", ".*@partner.com")`: Sender-based routing

#### Action Types
- `forward("http://your-app.com/webhook")`: Send to webhook
- `forward("support@internal.com")`: Forward to mailbox
- `store()`: Store in Mailgun (retrievable via API)
- `stop()`: Stop processing (for spam filtering)

### Use Cases for Agentopia

#### 1. **Agent Inbox Management**
- Route emails to specific agents based on recipient address
- Automatically categorize emails by subject or sender
- Create agent-specific email processing workflows

#### 2. **Customer Support Automation**
- Parse support requests and create tickets
- Route urgent issues to priority queues
- Auto-respond with acknowledgment emails

#### 3. **Lead Generation**
- Extract contact information from inquiry emails
- Automatically add leads to CRM systems
- Trigger follow-up sequences

#### 4. **Order Processing**
- Parse order confirmations and invoices
- Update inventory systems automatically
- Send shipping notifications

## Integration Architecture

### Agentopia-Mailgun Integration Flow

```
User Request → Agent → Mailgun API → Email Delivery
     ↓
Inbound Email → Mailgun Parsing → Webhook → Agent Processing
```

### Database Schema Integration

#### Mailgun Configuration Table
```sql
CREATE TABLE mailgun_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    domain VARCHAR(255) NOT NULL,
    api_key_id UUID REFERENCES vault.secrets(id),
    smtp_username VARCHAR(255),
    smtp_password_id UUID REFERENCES vault.secrets(id),
    webhook_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Email Routing Rules Table
```sql
CREATE TABLE mailgun_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailgun_config_id UUID REFERENCES mailgun_configurations(id),
    route_id VARCHAR(255), -- Mailgun route ID
    priority INTEGER NOT NULL,
    expression TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    agent_id UUID REFERENCES agents(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Email Log Table
```sql
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailgun_message_id VARCHAR(255),
    agent_id UUID REFERENCES agents(id),
    user_id UUID REFERENCES users(id),
    direction ENUM('outbound', 'inbound'),
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    subject TEXT,
    status VARCHAR(50),
    event_data JSONB,
    processed_at TIMESTAMPTZ DEFAULT now()
);
```

## Implementation Guide

### Phase 1: Mailgun Account Setup

#### 1. Account Creation and Domain Verification
```bash
# 1. Sign up at https://www.mailgun.com/
# 2. Add your domain (e.g., mail.agentopia.com)
# 3. Configure DNS records as provided by Mailgun
```

#### 2. API Key Management
```typescript
// Store API keys securely in Supabase Vault
const vaultService = new VaultService(supabaseClient);

const apiKeyId = await vaultService.createSecret(
  'mailgun_api_key',
  'key-your-mailgun-api-key-here',
  'Mailgun API key for domain mail.agentopia.com'
);
```

#### 3. Domain Authentication Setup
```bash
# DNS Records to add:
# TXT record: v=spf1 include:mailgun.org ~all
# CNAME record: email.mail.agentopia.com → mailgun.org
# TXT record: k=rsa; p=[DKIM public key from Mailgun]
```

### Phase 2: Supabase Edge Function Integration

#### Create Mailgun Service Function
```typescript
// supabase/functions/mailgun-service/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface MailgunRequest {
  action: 'send' | 'validate' | 'webhook';
  data: any;
  agent_id?: string;
  user_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, data, agent_id, user_id }: MailgunRequest = await req.json();
    
    switch (action) {
      case 'send':
        return await handleSendEmail(data, agent_id, user_id);
      case 'validate':
        return await handleValidateEmail(data);
      case 'webhook':
        return await handleWebhook(data);
      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Mailgun service error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleSendEmail(emailData: any, agentId: string, userId: string) {
  // Get Mailgun configuration for user
  const config = await getMailgunConfig(userId);
  
  // Send email via Mailgun API
  const response = await fetch(`https://api.mailgun.net/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`api:${config.api_key}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html || '',
      text: emailData.text || ''
    })
  });

  const result = await response.json();
  
  // Log email send
  await logEmail({
    mailgun_message_id: result.id,
    agent_id: agentId,
    user_id: userId,
    direction: 'outbound',
    from_address: emailData.from,
    to_address: emailData.to,
    subject: emailData.subject,
    status: response.ok ? 'sent' : 'failed',
    event_data: result
  });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### Phase 3: Inbound Email Processing

#### Webhook Handler Function
```typescript
// supabase/functions/mailgun-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await req.formData();
    const emailData = parseInboundEmail(formData);
    
    // Find matching route and agent
    const route = await findMatchingRoute(emailData.recipient);
    
    if (route && route.agent_id) {
      // Process email with assigned agent
      await processEmailWithAgent(emailData, route.agent_id);
    } else {
      // Default handling - store for manual processing
      await storeUnroutedEmail(emailData);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Error', { status: 500 });
  }
});

function parseInboundEmail(formData: FormData) {
  return {
    message_id: formData.get('Message-Id'),
    recipient: formData.get('recipient'),
    sender: formData.get('sender'),
    from: formData.get('From'),
    subject: formData.get('Subject'),
    body_plain: formData.get('body-plain'),
    body_html: formData.get('body-html'),
    timestamp: formData.get('timestamp'),
    attachments: parseAttachments(formData)
  };
}

async function processEmailWithAgent(emailData: any, agentId: string) {
  // Create chat message for agent to process
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert({
      agent_id: agentId,
      content: `New email from ${emailData.sender}: ${emailData.subject}\n\n${emailData.body_plain}`,
      message_type: 'email_inbound',
      metadata: {
        email_data: emailData,
        requires_response: true
      }
    });

  if (error) throw error;

  // Trigger agent processing
  await triggerAgentProcessing(agentId, data[0].id);
}
```

### Phase 4: Frontend Integration

#### Mailgun Configuration Component
```typescript
// src/components/integrations/MailgunConfig.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMailgunIntegration } from '@/hooks/useMailgunIntegration';

export const MailgunConfig: React.FC = () => {
  const [domain, setDomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const { saveConfiguration, isLoading } = useMailgunIntegration();

  const handleSave = async () => {
    await saveConfiguration({ domain, apiKey });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mailgun Configuration</h3>
      
      <div>
        <label className="block text-sm font-medium mb-1">Domain</label>
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="mail.yourdomain.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">API Key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="key-your-mailgun-api-key"
        />
      </div>

      <Button onClick={handleSave} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Configuration'}
      </Button>
    </div>
  );
};
```

#### Email Routing Management
```typescript
// src/components/integrations/EmailRouting.tsx
import React, { useState, useEffect } from 'react';
import { useEmailRoutes } from '@/hooks/useEmailRoutes';

export const EmailRouting: React.FC = () => {
  const { routes, createRoute, updateRoute, deleteRoute } = useEmailRoutes();
  const [newRoute, setNewRoute] = useState({
    expression: '',
    action: '',
    agent_id: '',
    description: ''
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Email Routing Rules</h3>
      
      {/* Route Creation Form */}
      <div className="border p-4 rounded-lg">
        <h4 className="font-medium mb-3">Create New Route</h4>
        {/* Form fields for route creation */}
      </div>

      {/* Existing Routes List */}
      <div className="space-y-2">
        {routes.map(route => (
          <div key={route.id} className="border p-3 rounded">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{route.description}</p>
                <p className="text-sm text-gray-600">{route.expression}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => deleteRoute(route.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

## Security & Compliance

### Data Protection
- **API Keys**: Stored encrypted in Supabase Vault
- **Email Content**: Processed server-side only, never stored in client
- **GDPR Compliance**: Automatic data retention and deletion policies
- **HIPAA Ready**: Available for healthcare applications

### Authentication Security
- **API Key Rotation**: Regular rotation of API keys
- **Webhook Verification**: Mailgun signature validation
- **Rate Limiting**: Built-in protection against abuse
- **IP Restrictions**: Optional IP whitelisting

### Compliance Features
- **SOC I & II Certified**: Enterprise security standards
- **ISO 27001**: Information security management
- **Data Residency**: EU and US data center options
- **Audit Trails**: Complete email activity logging

## Code Examples

### Sending Email via Agent
```typescript
// Agent email sending function
export async function sendEmailViaAgent(
  agentId: string,
  emailData: {
    to: string;
    subject: string;
    content: string;
    isHtml?: boolean;
  }
) {
  const response = await supabase.functions.invoke('mailgun-service', {
    body: {
      action: 'send',
      agent_id: agentId,
      data: {
        to: emailData.to,
        subject: emailData.subject,
        [emailData.isHtml ? 'html' : 'text']: emailData.content,
        from: `agent-${agentId}@mail.agentopia.com`
      }
    }
  });

  return response.data;
}
```

### Email Validation
```typescript
// Validate email address before sending
export async function validateEmail(email: string): Promise<boolean> {
  const response = await supabase.functions.invoke('mailgun-service', {
    body: {
      action: 'validate',
      data: { address: email }
    }
  });

  return response.data?.is_valid || false;
}
```

### Processing Inbound Email
```typescript
// Hook for processing inbound emails
export function useInboundEmails(agentId: string) {
  useEffect(() => {
    const channel = supabase
      .channel('inbound-emails')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `agent_id=eq.${agentId} AND message_type=eq.email_inbound`
        },
        (payload) => {
          // Process new inbound email
          handleInboundEmail(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);
}
```

## Troubleshooting

### Common Issues

#### 1. **Email Delivery Failures**
- **Cause**: Domain not verified or DNS misconfiguration
- **Solution**: Check DNS records in Mailgun dashboard
- **Prevention**: Use Mailgun's domain verification tool

#### 2. **Webhook Not Receiving Events**
- **Cause**: Incorrect webhook URL or network issues
- **Solution**: Test webhook URL and check firewall settings
- **Prevention**: Implement webhook signature verification

#### 3. **Rate Limit Exceeded**
- **Cause**: Sending too many emails too quickly
- **Solution**: Implement exponential backoff and queue management
- **Prevention**: Monitor sending rates and upgrade plan if needed

#### 4. **Inbound Emails Not Routing**
- **Cause**: Incorrect route expressions or priority conflicts
- **Solution**: Test route expressions and adjust priorities
- **Prevention**: Use Mailgun's route testing tool

### Monitoring & Alerts

#### Key Metrics to Track
- **Delivery Rate**: Percentage of emails successfully delivered
- **Bounce Rate**: Percentage of emails that bounced
- **Complaint Rate**: Percentage of emails marked as spam
- **Open Rate**: Percentage of emails opened by recipients
- **Click Rate**: Percentage of emails with clicked links

#### Alert Thresholds
- Bounce rate > 5%
- Complaint rate > 0.1%
- Delivery rate < 95%
- Webhook processing failures > 1%

### Performance Optimization

#### Best Practices
1. **Batch Operations**: Group multiple emails into single API calls
2. **Template Usage**: Use templates for consistent formatting
3. **List Hygiene**: Regularly clean email lists to remove bounces
4. **A/B Testing**: Test subject lines and content for better engagement
5. **Timing Optimization**: Send emails when recipients are most active

## Conclusion

This documentation provides a comprehensive guide for integrating Mailgun's Email API and Inbound Email Routing into Agentopia's agentic system. The integration enables agents to:

- Send professional emails on behalf of users
- Process incoming emails automatically
- Maintain high deliverability rates
- Comply with security and privacy standards
- Scale email operations efficiently

For additional support, refer to:
- [Mailgun Documentation](https://documentation.mailgun.com/)
- [Mailgun API Reference](https://documentation.mailgun.com/docs/mailgun/api-reference/)
- [Agentopia Integration Support](mailto:support@agentopia.com)

---

**References:**
- [Mailgun Email API Features](https://www.mailgun.com/features/email-api/)
- [Mailgun Inbound Email Routing](https://www.mailgun.com/features/inbound-email-routing/)
- [Mailgun Documentation](https://documentation.mailgun.com/)
