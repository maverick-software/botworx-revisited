# ClickSend SMS/MMS Integration Plan

## Project Overview

### Objective
Implement ClickSend SMS/MMS capabilities for Agentopia agents, enabling them to send text messages and multimedia messages on behalf of users through a secure, MCP-compliant integration.

### Scope
- **SMS Messaging**: Send text messages via ClickSend API
- **MMS Messaging**: Send multimedia messages with images/videos
- **Account Management**: Check balance and message history
- **Agent Permissions**: Granular SMS/MMS access control
- **UI Integration**: Setup modal, agent tools, and credentials management
- **Security**: Vault-encrypted API key storage and user-scoped access

### Success Criteria
- Agents can send SMS/MMS messages when authorized
- API keys stored securely in Supabase Vault
- UI components integrated into existing Agentopia interface
- Full compliance with established MCP tool protocol
- Comprehensive error handling and user feedback

## Technical Architecture

### Database Schema Updates
```sql
-- Service Provider
INSERT INTO service_providers (
  name: 'clicksend_sms',
  display_name: 'ClickSend SMS/MMS',
  provider_type: 'api_key',
  configuration_metadata: {
    api_base_url: 'https://rest.clicksend.com/v3',
    authentication_type: 'basic_auth',
    supported_features: ['sms', 'mms', 'balance_check', 'history']
  }
);

-- Integration Capabilities
INSERT INTO integration_capabilities VALUES
  ('clicksend_send_sms', 'Send SMS'),
  ('clicksend_send_mms', 'Send MMS'),
  ('clicksend_get_balance', 'Check Balance'),
  ('clicksend_get_history', 'Get History');
```

### Proposed File Structure
```
supabase/functions/clicksend-api/
├── index.ts                    # Main API handler (250 lines)
├── clicksend-client.ts         # API client wrapper (200 lines)
├── sms-operations.ts           # SMS-specific operations (200 lines)
├── mms-operations.ts           # MMS-specific operations (200 lines)
└── utils.ts                    # Validation and helpers (150 lines)

src/integrations/clicksend/
├── components/
│   ├── ClickSendSetupModal.tsx     # Setup modal (250 lines)
│   ├── AgentSMSPermissions.tsx     # Agent permissions (200 lines)
│   └── SMSToolsTab.tsx             # Agent chat tools (200 lines)
├── services/
│   ├── clicksend-tools.ts          # MCP tool service (250 lines)
│   └── clicksend-client.ts         # Frontend client (150 lines)
└── types/
    └── clicksend-types.ts          # TypeScript definitions (100 lines)

src/pages/
└── CredentialsPage.tsx             # Add ClickSend support (50 lines added)
```

### Component Architecture
- **Edge Function**: `clicksend-api` for SMS/MMS operations
- **MCP Tools Service**: Implements tool discovery and execution
- **UI Components**: Setup modal, permissions, and tools interface
- **Type System**: Comprehensive TypeScript definitions
- **Security Layer**: Vault integration and permission validation

## Integration Points

### 1. Database Integration
- Add ClickSend to `service_providers` table
- Define tools in `integration_capabilities` table
- Use existing `user_integration_credentials` for API keys
- Leverage `agent_integration_permissions` for access control

### 2. Function Calling Integration
- Register tools in `FunctionCallingManager`
- Add routing in `UniversalToolExecutor`
- Implement permission validation
- Support retry logic for interactive errors

### 3. UI Integration
- **Integrations Page**: Add ClickSend setup option
- **Agent Chat Page**: SMS/MMS tools in tools tab
- **Credentials Page**: ClickSend connection management
- **Agent Edit Page**: SMS permissions configuration

### 4. Security Integration
- **Supabase Vault**: Encrypt API credentials
- **RLS Policies**: User-scoped data access
- **Service Role**: Server-side credential decryption
- **Audit Logging**: Track all SMS/MMS operations

## Development Phases

### Phase 1: Research & Planning ✅
- [x] Analyze existing MCP system
- [x] Research ClickSend API capabilities
- [x] Design integration architecture
- [x] Create comprehensive plan

### Phase 2: Database Schema (In Progress)
- [ ] Get current database schema
- [ ] Design ClickSend schema additions
- [ ] Create migration scripts
- [ ] Test schema changes

### Phase 3: Edge Function Development
- [ ] Implement ClickSend API client
- [ ] Build SMS/MMS operations
- [ ] Add error handling and validation
- [ ] Implement security measures

### Phase 4: MCP Tool Integration
- [ ] Create ClickSend tools service
- [ ] Register with function calling system
- [ ] Implement permission validation
- [ ] Add tool execution logic

### Phase 5: UI Development
- [ ] Build ClickSend setup modal
- [ ] Create agent permissions interface
- [ ] Add SMS tools tab to agent chat
- [ ] Update credentials page

### Phase 6: Testing & Refinement
- [ ] Unit test all components
- [ ] Integration testing
- [ ] User acceptance testing
- [ ] Performance optimization

### Phase 7: Documentation & Cleanup
- [ ] Create user documentation
- [ ] Update system documentation
- [ ] Clean up temporary files
- [ ] Final review and deployment

## Risk Assessment

### Technical Risks
- **API Rate Limits**: ClickSend may have strict rate limiting
- **Message Costs**: SMS/MMS charges could accumulate quickly
- **Phone Number Validation**: International format requirements
- **Media Handling**: MMS media URL validation and processing

### Mitigation Strategies
- Implement rate limiting and cost controls
- Validate phone numbers before API calls
- Add balance checking and quota monitoring
- Comprehensive error handling with user guidance

### Security Risks
- **API Key Exposure**: Credentials must never reach frontend
- **Message Privacy**: SMS/MMS content contains sensitive data
- **Abuse Prevention**: Agents could send spam messages
- **Cost Control**: Unlimited messaging could be expensive

### Security Measures
- Vault-encrypted credential storage
- User-scoped access controls
- Agent permission validation
- Usage monitoring and alerts

## Dependencies

### External Dependencies
- ClickSend API account and credentials
- Supabase Vault for secure storage
- Existing MCP infrastructure
- Phone number validation library

### Internal Dependencies
- Current database schema structure
- Function calling system
- UI component library
- Security architecture

## Timeline Estimate
- **Total Duration**: 3-4 development sessions
- **Phase 2**: 1 session (Database schema)
- **Phase 3**: 1 session (Edge function)
- **Phase 4**: 0.5 session (MCP integration)
- **Phase 5**: 1 session (UI development)
- **Phase 6**: 0.5 session (Testing)

## Success Metrics
- [ ] SMS messages successfully sent via agents
- [ ] MMS messages with media attachments working
- [ ] API keys securely stored and accessed
- [ ] UI components integrated seamlessly
- [ ] Error handling provides clear user guidance
- [ ] Performance meets established standards
- [ ] Security audit passes all requirements

This plan provides a comprehensive roadmap for implementing ClickSend SMS/MMS integration while maintaining consistency with Agentopia's existing architecture and security standards.
