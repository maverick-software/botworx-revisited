# SMTP Tool Integration Plan

**Date:** August 24, 2025  
**Purpose:** Implement general SMTP integration for autonomous email sending by agents  
**Protocol:** Following @plan_and_execute.mdc methodology

## Project Overview

This plan implements a general SMTP tool integration that allows users to create SMTP credentials and assign them to agents for autonomous email sending. The integration will support all standard SMTP fields including server configuration, authentication, and email composition options.

## Requirements Analysis

### Functional Requirements
1. **SMTP Configuration Management**
   - Users can create multiple SMTP configurations
   - Support for standard SMTP fields (host, port, authentication)
   - Secure credential storage using Supabase Vault
   - Connection testing and validation

2. **Agent Tool Integration**
   - Agents can autonomously send emails using assigned SMTP credentials
   - Support for standard email fields (to, cc, bcc, subject, body, reply-to)
   - Integration with existing function calling system
   - Comprehensive audit logging

3. **Security & Permissions**
   - Encrypted storage of SMTP passwords/API keys
   - Agent-specific permission system
   - Rate limiting and abuse prevention
   - Audit trail for all operations

### Non-Functional Requirements
- **Performance**: Handle concurrent email sending
- **Reliability**: Retry mechanisms for transient failures
- **Security**: Encrypted credential storage, secure connections
- **Scalability**: Support multiple SMTP providers per user
- **Maintainability**: Follow existing codebase patterns

## Architecture Overview

### Integration Pattern
Following the **API Key Pattern** established by web search integration:
- Use `user_oauth_connections` table with `credential_type = 'api_key'`
- Create dedicated `smtp_configurations` table for SMTP-specific settings
- Implement `smtp-api` Edge Function for secure SMTP operations
- Integrate with existing `FunctionCallingManager` system

### Database Schema Design
```sql
-- SMTP configurations (detailed settings)
smtp_configurations (
  id, user_id, connection_name, host, port, secure,
  username, vault_password_id, from_email, reply_to_email,
  connection_timeout, max_emails_per_day, is_active
)

-- Operation logging (audit trail)
smtp_operation_logs (
  id, user_id, agent_id, smtp_config_id, operation_type,
  recipients_count, status, error_message, execution_time_ms
)

-- Agent permissions (access control)
agent_smtp_permissions (
  id, agent_id, smtp_config_id, can_send_email,
  daily_email_limit, allowed_recipients
)
```

## Proposed File Structure

### Backend Components (200-300 lines each)

#### 1. Database Migration
**File:** `supabase/migrations/[timestamp]_create_smtp_integration.sql` (~250 lines)
- Create `smtp_configurations` table
- Create `smtp_operation_logs` table  
- Create `agent_smtp_permissions` table
- Add SMTP provider to `oauth_providers`
- Create RLS policies
- Create helper functions

#### 2. Edge Function
**File:** `supabase/functions/smtp-api/index.ts` (~280 lines)
- SMTP connection management
- Email sending with nodemailer
- Connection testing functionality
- Error handling and retry logic
- Operation logging
- Security validation

#### 3. Function Calling Integration
**File:** `supabase/functions/chat/smtp-tools.ts` (~220 lines)
- SMTP tool definitions
- Permission validation
- Tool execution logic
- Result formatting
- Integration with FunctionCallingManager

#### 4. Database Functions
**File:** `supabase/functions/smtp-helpers.sql` (~200 lines)
- `get_smtp_tools()` - Get available tools for agent
- `validate_agent_smtp_permissions()` - Permission checking
- `log_smtp_operation()` - Operation logging
- `get_user_smtp_configurations()` - Configuration retrieval

### Frontend Components (200-300 lines each)

#### 5. SMTP Integration Card
**File:** `src/components/integrations/SMTPIntegrationCard.tsx` (~290 lines)
- SMTP configuration management UI
- Connection testing interface
- Multiple configuration support
- Status indicators and error handling

#### 6. SMTP Setup Modal
**File:** `src/components/integrations/SMTPSetupModal.tsx` (~270 lines)
- SMTP configuration form
- Connection validation
- Credential encryption handling
- User feedback and error display

#### 7. Agent SMTP Permissions
**File:** `src/components/agent-edit/SMTPPermissionsSection.tsx` (~240 lines)
- Agent SMTP permission management
- Configuration assignment interface
- Permission level controls
- Usage monitoring display

### Integration Files (Modifications)

#### 8. Function Calling Manager Updates
**File:** `supabase/functions/chat/function_calling.ts` (add ~50 lines)
- Add `executeSMTPTool()` method
- Integrate SMTP tools in `getAvailableTools()`
- Add SMTP tool routing logic

#### 9. Integration Seeding
**File:** `supabase/migrations/[timestamp]_seed_smtp_integration.sql` (~100 lines)
- Add SMTP to integrations catalog
- Create integration capabilities
- Set up default configurations

#### 10. Type Definitions
**File:** `src/types/smtp.ts` (~150 lines)
- SMTP configuration interfaces
- Tool parameter types
- Response type definitions
- Permission type definitions

## Technical Implementation Strategy

### Phase 1: Database Foundation
1. Create database schema with proper relationships
2. Implement RLS policies for security
3. Create helper functions for common operations
4. Seed integration catalog data

### Phase 2: Backend Services
1. Implement SMTP Edge Function with nodemailer
2. Add SMTP tool definitions and execution logic
3. Integrate with existing function calling system
4. Implement comprehensive error handling

### Phase 3: Frontend Integration
1. Create SMTP configuration management UI
2. Implement agent permission management
3. Add connection testing and validation
4. Integrate with existing integration system

### Phase 4: Testing & Security
1. Implement comprehensive test suite
2. Add security validation and rate limiting
3. Test with multiple SMTP providers
4. Performance testing and optimization

## Security Considerations

### Credential Protection
- All SMTP passwords encrypted using Supabase Vault
- No plain text credentials in database or logs
- Secure credential transmission to Edge Functions
- Regular credential rotation recommendations

### Access Control
- Agent-specific SMTP permissions
- User-controlled configuration sharing
- Rate limiting per agent and configuration
- Audit logging for all operations

### Network Security
- TLS/SSL enforcement for SMTP connections
- Connection timeout and retry limits
- Validation of SMTP server certificates
- Prevention of SMTP injection attacks

## Integration Points

### Existing Systems
- **Function Calling System**: Integrate SMTP tools with existing framework
- **Vault Service**: Use existing encryption for credential storage
- **Integration Catalog**: Add SMTP to existing integration management
- **Audit System**: Leverage existing operation logging patterns

### External Dependencies
- **nodemailer**: SMTP client library for email sending
- **Supabase Vault**: Credential encryption and storage
- **Edge Functions**: Serverless execution environment

## Success Criteria

### Functional Success
- [ ] Users can create and manage SMTP configurations
- [ ] Agents can autonomously send emails using assigned credentials
- [ ] All standard SMTP and email fields are supported
- [ ] Connection testing validates configurations before saving
- [ ] Comprehensive audit logging tracks all operations

### Technical Success
- [ ] All files under 300 lines following project guidelines
- [ ] Secure credential storage using Supabase Vault
- [ ] Integration with existing function calling system
- [ ] Comprehensive error handling and retry logic
- [ ] Performance suitable for concurrent email sending

### Security Success
- [ ] No plain text credentials stored anywhere
- [ ] Agent permissions properly enforced
- [ ] Rate limiting prevents abuse
- [ ] Audit trail for compliance and debugging
- [ ] TLS/SSL connections enforced

## Risk Mitigation

### Technical Risks
- **SMTP Provider Compatibility**: Test with major providers (Gmail, Outlook, custom)
- **Performance Issues**: Implement connection pooling and async processing
- **Security Vulnerabilities**: Regular security reviews and credential rotation

### Operational Risks
- **Spam Prevention**: Implement rate limiting and monitoring
- **Credential Management**: Clear documentation for credential setup
- **Error Handling**: Comprehensive error messages and recovery procedures

## Timeline Estimation

- **Phase 1 (Database)**: 2-3 hours
- **Phase 2 (Backend)**: 4-5 hours  
- **Phase 3 (Frontend)**: 3-4 hours
- **Phase 4 (Testing)**: 2-3 hours
- **Total Estimated Time**: 11-15 hours

## Dependencies

### External Libraries
- nodemailer (npm:nodemailer@6.9.8) for Deno Edge Functions
- Existing Supabase client libraries
- Existing UI component library (Shadcn)

### Internal Dependencies
- Supabase Vault service for encryption
- Existing function calling framework
- Integration management system
- Authentication and authorization system

## Deliverables

1. **Database Schema**: Complete SMTP integration tables and functions
2. **Edge Function**: Secure SMTP API with nodemailer integration
3. **Frontend Components**: SMTP configuration and management UI
4. **Integration**: Function calling system integration
5. **Documentation**: Updated README and integration guides
6. **Tests**: Comprehensive test suite for all components

This plan provides a comprehensive roadmap for implementing SMTP tool integration following Agentopia's established patterns and security requirements.
