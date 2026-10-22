# SendGrid API Research Document

## Date: August 2, 2025
## Purpose: Research findings on SendGrid API capabilities and integration approach

## Executive Summary

SendGrid provides a comprehensive email platform with both sending and receiving capabilities through their Web API v3. While SendGrid doesn't have a traditional "inbox" feature, it offers the Inbound Parse webhook functionality that allows receiving and processing emails programmatically.

## Key Findings

### 1. Email Sending Capabilities

#### API Endpoints
- **Mail Send API v3**: `POST https://api.sendgrid.com/v3/mail/send`
- **Authentication**: Bearer token (API Key)
- **Rate Limits**: Based on plan (up to 600 requests/second for Pro plans)

#### Key Features
- Single and batch email sending
- Template support with dynamic content
- Attachment handling (up to 30MB total)
- Scheduled sending
- Email tracking (opens, clicks, bounces)
- Categories and custom arguments for analytics

### 2. Email Receiving Capabilities (Inbound Parse)

#### How It Works
1. **Domain Configuration**: Set up MX records to point to SendGrid
2. **Webhook URL**: Configure endpoint to receive parsed emails
3. **Email Processing**: SendGrid parses incoming emails and POSTs to webhook
4. **Data Format**: JSON or multipart/form-data

#### Inbound Parse Features
- **Email Parsing**: Extracts headers, body, attachments
- **Spam Filtering**: Optional spam check
- **Raw Email**: Option to receive raw MIME message
- **Security**: Webhook signature verification and OAuth support

#### Key Differences from Traditional Inbox
- No email storage - emails are immediately forwarded
- No IMAP/POP3 access - webhook-only delivery
- Real-time processing - no polling required
- Scalable - handles high volume automatically

### 3. Agent-Specific Email Addresses

#### Implementation Approach
1. **Plus Addressing**: Use format like `agent-{agentId}@domain.com`
2. **Subdomain Routing**: Use `{agentId}.inbox.domain.com`
3. **Mailbox Hash**: Include routing info after `+` sign
4. **Dynamic Routing**: Parse recipient address to route to correct agent

### 4. Scheduled Actions & Rules Engine

#### Capabilities
- **Webhook Processing**: Real-time email event processing
- **Event Types**: Processed, delivered, deferred, bounce, open, click, spam report
- **Custom Logic**: Implement rules in application layer
- **Integration Points**: Can trigger agent actions based on email events

### 5. Authentication & Security

#### API Authentication
- **API Keys**: Primary authentication method
- **Key Permissions**: Granular permissions for different operations
- **IP Whitelisting**: Optional IP access control

#### Inbound Security
- **Webhook Signatures**: ECDSA cryptographic signatures
- **OAuth Support**: OAuth 2.0 for webhook authentication
- **DNS Verification**: SPF, DKIM, DMARC support

## Technical Requirements

### Database Schema Needs
1. **sendgrid_configurations**: Store user-specific SendGrid settings
2. **agent_email_addresses**: Map email addresses to agents
3. **email_routing_rules**: Define rules for email processing
4. **sendgrid_webhook_logs**: Track inbound email processing
5. **email_templates**: Store SendGrid template IDs and metadata

### Integration Points
1. **OAuth Flow**: For connecting SendGrid accounts
2. **API Key Management**: Secure storage in Supabase Vault
3. **Webhook Endpoint**: Supabase Edge Function for inbound emails
4. **Tool Definitions**: OpenAI function calling compatible tools

### Key Differences from Gmail Integration
- **No OAuth for basic API**: Uses API keys instead
- **No inbox concept**: Pure webhook-based receiving
- **Template-first approach**: Strong template engine
- **Marketing focus**: Built for campaigns and transactional

## Recommended Implementation Strategy

### Phase 1: Core Infrastructure
1. Database schema for SendGrid entities
2. API key management system
3. Basic send/receive functionality

### Phase 2: Agent Integration
1. Tool definitions for function calling
2. Permission management
3. Email address provisioning

### Phase 3: Advanced Features
1. Template management
2. Routing rules engine
3. Scheduled actions
4. Analytics integration

## Security Considerations
1. API keys must be encrypted in Vault
2. Webhook endpoints need signature verification
3. Rate limiting per agent/user
4. Input validation for email content
5. Attachment scanning requirements

## Cost Implications
- **Free Plan**: 100 emails/day
- **Essentials**: $19.95/month for 50k emails
- **Pro**: Custom pricing, advanced features
- **Inbound Parse**: Included in all plans

## Next Steps
1. Design database schema
2. Create tool definitions
3. Implement webhook handler
4. Build permission system
5. Create UI components