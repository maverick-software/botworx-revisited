# SMTP Tool Integration - Codebase Analysis

**Date:** August 24, 2025  
**Purpose:** Research existing email integrations and API key patterns to inform SMTP tool implementation

## Existing Email Integration Patterns

### 1. Gmail Integration (OAuth-based)
- **Architecture**: OAuth 2.0 flow with encrypted token storage
- **Database Tables**: 
  - `oauth_providers` - Provider configuration
  - `user_oauth_connections` - User OAuth connections with `credential_type = 'oauth'`
  - `agent_oauth_permissions` - Agent-specific permissions
  - `gmail_operation_logs` - Operation logging
- **Edge Function**: `gmail-api` - Secure proxy for Gmail API calls
- **Tools**: `send_email`, `read_emails`, `search_emails`, `email_actions`
- **Permission System**: Scope-based (`gmail.send`, `gmail.readonly`, `gmail.modify`)

### 2. SendGrid Integration (API Key-based)
- **Architecture**: API key storage with configuration management
- **Database Tables**:
  - `sendgrid_configurations` - User SendGrid configs
  - `agent_sendgrid_permissions` - Agent permissions
  - `sendgrid_operation_logs` - Operation logging
  - `sendgrid_inbound_emails` - Received emails
- **Edge Function**: `sendgrid-api` - SendGrid API proxy
- **Tools**: `send_email`, `send_template_email`, `send_bulk_email`, etc.

### 3. Web Search Integration (API Key Pattern)
- **Architecture**: API key storage in `user_oauth_connections` with `credential_type = 'api_key'`
- **Vault Storage**: API keys encrypted using Supabase Vault (`vault_encrypt`/`vault_decrypt`)
- **Edge Function**: `web-search-api` - Multi-provider search proxy
- **Provider Support**: Multiple providers (Serper, SerpAPI, Brave Search)

## Key Architecture Patterns

### API Key Management Pattern
```typescript
// Storage in user_oauth_connections
{
  user_id: 'user-uuid',
  oauth_provider_id: 'provider-uuid',
  credential_type: 'api_key',
  vault_access_token_id: 'vault-uuid', // Encrypted API key
  connection_status: 'active',
  connection_name: 'User-friendly name'
}
```

### Tool Execution Flow
1. **Tool Discovery**: `FunctionCallingManager.getAvailableTools()` queries permissions
2. **Permission Check**: Validates agent has access to specific tools
3. **Edge Function Call**: Routes to provider-specific edge function
4. **API Call**: Edge function makes authenticated API call
5. **Logging**: Operation logged for audit/debugging
6. **Response**: Structured response returned to agent

### Function Calling Integration
```typescript
// In FunctionCallingManager
private async executeProviderTool(
  agentId: string,
  userId: string,
  toolName: string,
  parameters: Record<string, any>
): Promise<MCPToolResult> {
  // 1. Validate permissions
  // 2. Call edge function
  // 3. Log operation
  // 4. Return structured result
}
```

## SMTP-Specific Requirements

### Standard SMTP Fields Needed
- **Server Configuration**: `host`, `port`, `secure` (TLS/SSL)
- **Authentication**: `username`, `password` or `api_key`
- **Email Fields**: `from`, `to`, `cc`, `bcc`, `subject`, `body`
- **Advanced**: `reply_to`, `attachments`, `priority`

### Security Considerations
- **Credential Storage**: Use Supabase Vault for password/API key encryption
- **Connection Validation**: Test SMTP connection before saving
- **Rate Limiting**: Prevent abuse with per-agent limits
- **Audit Logging**: Track all email operations

## Recommended Implementation Pattern

Based on analysis, SMTP should follow the **API Key Pattern** similar to web search:

1. **Database Schema**: 
   - Use `user_oauth_connections` with `credential_type = 'api_key'`
   - Create `smtp_configurations` table for SMTP-specific settings
   - Create `smtp_operation_logs` for audit trail

2. **Edge Function**: 
   - Create `smtp-api` function using nodemailer or similar
   - Handle multiple SMTP providers/configurations per user
   - Implement connection testing and validation

3. **Tool Integration**:
   - Follow existing `FunctionCallingManager` pattern
   - Implement `executeSMTPTool` method
   - Support tools: `send_email`, `test_connection`

4. **Frontend Integration**:
   - Create SMTP setup modal similar to web search
   - Allow multiple SMTP configurations per user
   - Provide connection testing UI

## Dependencies Identified
- **Backend**: nodemailer (Node.js SMTP client)
- **Database**: New tables for SMTP configurations
- **Frontend**: SMTP configuration UI components
- **Security**: Supabase Vault integration for credential encryption

## Files to Modify/Create
- `supabase/functions/smtp-api/index.ts` - New edge function
- `supabase/migrations/[timestamp]_create_smtp_integration.sql` - Database schema
- `src/components/integrations/SMTPIntegrationCard.tsx` - Frontend UI
- `supabase/functions/chat/function_calling.ts` - Tool execution logic
- Database seed files for SMTP provider registration

## Next Steps
1. Create detailed file structure plan
2. Develop Work Breakdown Structure
3. Research each WBS task individually
4. Begin implementation following plan_and_execute protocol
