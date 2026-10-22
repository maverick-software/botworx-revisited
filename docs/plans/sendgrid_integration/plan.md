# SendGrid Integration Plan

## Overview
This plan outlines the integration of SendGrid's email sending and receiving capabilities into Agentopia, allowing agents to send and receive emails through SendGrid's API and Inbound Parse webhooks.

## Proposed File Structure

### Database Migrations
```
supabase/migrations/
├── 20250802000001_sendgrid_integration.sql         # Core SendGrid tables and functions
├── 20250802000002_sendgrid_email_routing.sql       # Email routing and rules tables
└── 20250802000003_sendgrid_webhooks.sql            # Webhook processing tables
```

### Backend Services
```
supabase/functions/
├── sendgrid-api/
│   └── index.ts                                     # SendGrid API operations handler
├── sendgrid-inbound/
│   └── index.ts                                     # Inbound Parse webhook handler
└── sendgrid-webhook-verify/
    └── index.ts                                     # Webhook signature verification
```

### Frontend Components
```
src/components/
├── integrations/
│   └── SendGridIntegration.tsx                      # SendGrid setup UI
├── agent/
│   └── AgentEmailSettings.tsx                       # Agent email configuration
└── email/
    ├── EmailRoutingRules.tsx                        # Email routing rules UI
    └── InboxViewer.tsx                              # View received emails
```

### Tool Definitions
```
supabase/functions/chat/
└── sendgrid_tools.ts                                # SendGrid tool definitions
```

### Type Definitions
```
src/types/
└── sendgrid.ts                                      # TypeScript interfaces
```

## Key Components

### 1. Database Schema
- **sendgrid_configurations**: User SendGrid settings and API keys
- **agent_email_addresses**: Email addresses assigned to agents
- **email_routing_rules**: Rules for processing incoming emails
- **sendgrid_operation_logs**: Audit trail for all operations
- **inbound_emails**: Processed inbound email storage
- **email_templates**: SendGrid template management

### 2. Edge Functions
- **sendgrid-api**: Handles all SendGrid API operations (send, templates, etc.)
- **sendgrid-inbound**: Receives and processes Inbound Parse webhooks
- **sendgrid-webhook-verify**: Validates webhook signatures

### 3. Tool System
- **send_email**: Send emails with attachments and templates
- **send_bulk_email**: Send to multiple recipients
- **create_email_template**: Create reusable templates
- **get_email_status**: Check delivery status
- **list_inbound_emails**: View received emails

### 4. Permission System
- API key-based authentication (not OAuth)
- Granular permissions per agent
- Usage limits and quotas
- Audit logging

### 5. Email Routing
- Plus addressing: `reply+agentId-threadId@domain.com`
- Dynamic agent assignment
- Rule-based filtering
- Scheduled action triggers

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
1. Database schema implementation
2. API key management in Vault
3. Basic send email functionality
4. Tool definitions

### Phase 2: Inbound Email (Week 2)
1. Inbound Parse webhook handler
2. Email routing system
3. Agent email address management
4. Webhook security

### Phase 3: Advanced Features (Week 3)
1. Template management
2. Bulk sending capabilities
3. Email analytics
4. Routing rules engine

### Phase 4: UI Integration (Week 4)
1. Integration setup UI
2. Agent email settings
3. Inbox viewer
4. Rule management UI

## Technical Considerations

### Security
- All API keys encrypted in Supabase Vault
- Webhook signature verification mandatory
- Rate limiting per agent
- Input sanitization for email content

### Scalability
- Async processing for bulk operations
- Queue system for large sends
- Efficient webhook processing
- Database indexing strategy

### Error Handling
- Retry logic for failed sends
- Webhook failure recovery
- Clear error messages
- Comprehensive logging

## Dependencies
- Supabase Vault for secure storage
- SendGrid API v3
- Existing tool infrastructure
- Agent permission system

## Success Criteria
1. Agents can send emails via SendGrid
2. Inbound emails route to correct agents
3. Secure API key management
4. Full audit trail
5. User-friendly configuration UI
6. Comprehensive error handling