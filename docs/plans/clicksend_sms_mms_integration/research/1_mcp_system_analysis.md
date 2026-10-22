# MCP System Analysis for ClickSend Integration

## Research Date
September 11, 2025

## Purpose
Research the current MCP (Model Context Protocol) system in Agentopia to understand how to properly integrate ClickSend SMS/MMS capabilities following established patterns.

## Current MCP Architecture

### 1. Tool Provider Pattern
Based on analysis of Gmail and SerperAPI integrations, Agentopia uses a unified tool provider pattern:

**Key Components:**
- **Service Providers**: Stored in `service_providers` table with provider metadata
- **User Credentials**: Stored in `user_integration_credentials` with vault-encrypted tokens/keys
- **Agent Permissions**: Controlled via `agent_integration_permissions` table
- **Tool Capabilities**: Defined in `integration_capabilities` table (database-driven)

### 2. Database Structure Pattern
```sql
-- Service provider definition
service_providers: {
  name: 'clicksend_sms',
  display_name: 'ClickSend SMS',
  provider_type: 'api_key',
  configuration_metadata: jsonb -- API endpoints, features, etc.
}

-- User API key storage (vault-encrypted)
user_integration_credentials: {
  oauth_provider_id: uuid, -- References service_providers
  credential_type: 'api_key',
  vault_access_token_id: text, -- Encrypted API key in Supabase Vault
  connection_metadata: jsonb -- SMS-specific settings
}

-- Agent permissions
agent_integration_permissions: {
  agent_id: uuid,
  connection_id: uuid,
  allowed_scopes: jsonb, -- SMS capabilities granted to agent
  permission_level: 'custom'
}

-- Tool definitions (database-driven)
integration_capabilities: {
  integration_id: uuid,
  capability_key: 'clicksend_send_sms',
  display_label: 'Send SMS',
  display_order: 1
}
```

### 3. Tool Execution Flow
1. **Tool Discovery**: `get-agent-tools` Edge Function queries database for authorized tools
2. **Permission Validation**: Checks `agent_integration_permissions` for tool access
3. **Tool Execution**: Routes to provider-specific Edge Function (e.g., `clicksend-api`)
4. **Credential Retrieval**: Gets encrypted API key from Supabase Vault
5. **API Call**: Executes ClickSend API call with decrypted credentials
6. **Result Processing**: Returns structured response to agent

### 4. MCP Tool Schema Pattern
Tools follow OpenAI function calling format:

```typescript
const CLICKSEND_MCP_TOOLS = {
  send_sms: {
    name: 'clicksend_send_sms',
    description: 'Send SMS message via ClickSend',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number (+1234567890)' },
        body: { type: 'string', description: 'SMS message content' },
        from: { type: 'string', description: 'Sender ID (optional)' }
      },
      required: ['to', 'body']
    }
  },
  send_mms: {
    name: 'clicksend_send_mms',
    description: 'Send MMS message with media via ClickSend',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number' },
        body: { type: 'string', description: 'MMS message content' },
        media_url: { type: 'string', description: 'URL of media file to attach' }
      },
      required: ['to', 'body', 'media_url']
    }
  }
}
```

## Key Findings

### 1. Integration Patterns
- **API Key Based**: ClickSend uses API key authentication (like SerperAPI)
- **Vault Security**: All credentials encrypted in Supabase Vault
- **Database-Driven Tools**: Tool definitions stored in database, not hardcoded
- **Namespaced Tools**: Provider-specific tool names (e.g., `clicksend_send_sms`)

### 2. Required Components
- **Edge Function**: `clicksend-api` for SMS/MMS operations
- **Service Provider**: Database entry for ClickSend configuration
- **Tool Capabilities**: Database entries for SMS/MMS tools
- **UI Components**: Integration setup modal and agent permissions interface
- **Permission System**: Agent-specific SMS/MMS access control

### 3. Security Architecture
- **Zero Plain-Text**: API keys never stored in plain text
- **Service Role Only**: Decryption restricted to server-side functions
- **User Scoped**: RLS policies ensure user data isolation
- **Audit Logging**: All SMS/MMS operations logged for compliance

## Implementation Requirements

### 1. Database Schema Updates
```sql
-- Add ClickSend as service provider
INSERT INTO service_providers (name, display_name, provider_type, configuration_metadata)

-- Add ClickSend tool capabilities
INSERT INTO integration_capabilities (capability_key, display_label)
```

### 2. Edge Function Development
- **File**: `supabase/functions/clicksend-api/index.ts`
- **Actions**: `send_sms`, `send_mms`, `get_balance`, `get_delivery_status`
- **Authentication**: API key from Supabase Vault
- **Error Handling**: LLM-friendly error messages with retry support

### 3. Frontend Components
- **Setup Modal**: `ClickSendSetupModal.tsx` for API key configuration
- **Agent Tools Tab**: SMS/MMS permissions interface
- **Credentials Page**: ClickSend connection management

### 4. Tool Registration
- **Function Calling Manager**: Add ClickSend tool discovery
- **Universal Tool Executor**: Route ClickSend tool calls
- **Permission Validation**: Check SMS/MMS access rights

## Next Steps
1. **Database Schema**: Get current schema and plan ClickSend additions
2. **ClickSend API Research**: Study ClickSend API documentation and capabilities
3. **UI Component Design**: Plan integration setup and permissions interfaces
4. **Edge Function Architecture**: Design SMS/MMS API integration
5. **Testing Strategy**: Plan comprehensive testing approach

## References
- **Agent Tool Use Protocol**: `.cursor/rules/premium/sops/tool_use/agent_tool_use_protocol.mdc`
- **Gmail Integration**: Example OAuth integration pattern
- **SerperAPI Integration**: Example API key integration pattern
- **Web Search Fix**: `docs/fixes/web_research_tool_unification.md`
- **Function Calling Manager**: `supabase/functions/chat/function_calling/manager.ts`

## Architecture Alignment
This research confirms that ClickSend integration should follow the established MCP pattern used by Gmail and SerperAPI, ensuring consistency with the existing tool use protocol and security architecture.
