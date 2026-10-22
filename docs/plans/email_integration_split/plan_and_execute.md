# Plan and Execute: Email Integration Split

**Date:** January 16, 2025  
**Plan ID:** email_integration_split_20250116  
**Priority:** HIGH – Fix Angela's Missing SMTP Tools & Improve MCP Compliance

## 🎯 Executive Summary

**Objective:** Split the unified "Email Relay" integration back into separate SMTP, SendGrid, and Mailgun integrations to fix tool discovery issues and improve MCP compliance. This addresses the root cause of why agents like Angela cannot see their email tools after connecting credentials.

**Key Outcomes:**
- Separate SMTP, SendGrid, and Mailgun integrations with their own tools
- Simple, MCP-compliant tool discovery (provider → integration → tools)
- Fix Angela's missing SMTP tools issue
- Remove complex Email Relay special cases throughout the UI
- Extensible architecture for adding new email providers

## 🔎 Current State Analysis

**Current Broken Architecture:**
- Unified "Email Relay" integration tries to support multiple providers
- Complex tool discovery mapping (SMTP provider → Email Relay integration)
- Angela's agent shows "Processing SMTP Server (smtp) with 0 scopes"
- UI has special cases for "email_relay" throughout multiple components
- Tool discovery fails because `defaultScopesForService('smtp')` returned `[]`

**Current Tool Flow Issues:**
1. User connects "Email Relay" with SMTP credentials
2. System creates permission for SMTP provider (not Email Relay integration)
3. `get-agent-tools` tries to map SMTP provider → Email Relay integration
4. Complex mapping logic fails or returns no tools
5. Agent sees no email tools available

## ⚠️ Gap Analysis

**Root Problems:**
- Mixed architectural concepts (unified integration vs separate providers)
- Complex tool discovery logic with provider → integration mapping
- Empty scopes in agent permissions due to missing SMTP scope definition
- UI special cases make system hard to maintain and extend
- Not MCP-compliant (tools should be predictable and direct)

**Missing Components:**
- Separate SMTP, SendGrid, Mailgun integrations
- Direct provider → integration → tools mapping
- Clean UI without Email Relay special cases
- Proper scope definitions for all email providers

## 📐 Target Architecture

### Database Schema Changes
```sql
-- Remove unified Email Relay integration
DELETE FROM integration_capabilities WHERE integration_id IN (
    SELECT id FROM integrations WHERE name = 'Email Relay'
);
DELETE FROM integrations WHERE name = 'Email Relay';

-- Create separate integrations
integrations: {
  -- SMTP Server integration
  name: 'SMTP Server',
  required_oauth_provider_id: (smtp provider id),
  
  -- SendGrid integration  
  name: 'SendGrid',
  required_oauth_provider_id: (sendgrid provider id),
  
  -- Mailgun integration
  name: 'Mailgun', 
  required_oauth_provider_id: (mailgun provider id)
}

-- Each integration gets its own capabilities
integration_capabilities: {
  smtp: ['send_email', 'email_templates', 'email_stats'],
  sendgrid: ['send_email', 'email_templates', 'email_stats'], 
  mailgun: ['send_email', 'email_templates', 'email_stats', 'email_validation', 'suppression_management']
}
```

### Simplified Tool Discovery Flow
```typescript
// NEW: Direct provider → integration lookup
const integration = await supabase
  .from('integrations')
  .select('id, name, integration_capabilities(*)')
  .eq('required_oauth_provider_id', provider.id)
  .single();

// Generate predictable tools: smtp_send_email, sendgrid_send_email, etc.
for (const capability of integration.integration_capabilities) {
  if (allowedScopes.includes(capability.capability_key)) {
    tools.push({
      name: `${providerName}_${capability.capability_key}`,
      description: `${capability.display_label} via ${integration.name}`,
      parameters: generateParametersForCapability(capability.capability_key)
    });
  }
}
```

## 📋 Implementation Plan

### Phase 1: Database Schema Migration (Day 1)

#### 1.1 Create Migration Script
- [ ] **Create migration file**: `20250116000001_split_email_integrations.sql`
- [ ] **Remove Email Relay integration** and its capabilities
- [ ] **Create separate SMTP, SendGrid, Mailgun integrations**
- [ ] **Add integration_capabilities** for each email provider
- [ ] **Link integrations to oauth_providers** via `required_oauth_provider_id`

#### 1.2 Data Migration
- [ ] **Migrate existing permissions**: Update any Email Relay permissions to use new integrations
- [ ] **Fix Angela's SMTP permissions**: Add proper scopes `["send_email", "email_templates", "email_stats"]`
- [ ] **Validate data integrity**: Ensure all existing connections work with new schema

### Phase 2: Update get-agent-tools Function (Day 1)

#### 2.1 Simplify Tool Discovery Logic
- [ ] **Remove Email Relay special mapping**: Delete complex SMTP → Email Relay logic
- [ ] **Implement direct provider → integration lookup**: Query integrations by `required_oauth_provider_id`
- [ ] **Generate predictable tool names**: `smtp_send_email`, `sendgrid_send_email`, etc.
- [ ] **Test tool discovery**: Verify Angela sees SMTP tools

#### 2.2 Update Universal Tool Executor
- [ ] **Add separate provider mappings**: SMTP, SendGrid, Mailgun routing configs
- [ ] **Update tool routing**: `smtp_*` → `smtp-api`, `sendgrid_*` → `sendgrid-api`, etc.
- [ ] **Test tool execution**: Verify tools route to correct edge functions

### Phase 3: UI Component Updates (Day 1-2)

#### 3.1 Remove Email Relay Special Cases
**Files to Update:**
- [ ] **`AvailableChannelsList.tsx`**: Remove `email_relay` mapping (lines 73-77)
- [ ] **`EnhancedChannelsModalRefactored.tsx`**: Remove special email_relay logic (lines 408, 447, 466)
- [ ] **`ConnectedChannelsList.tsx`**: Remove email relay detection (line 57)
- [ ] **`ChannelConnectionItem.tsx`**: Remove email relay detection (line 93)
- [ ] **`EnhancedChannelsModal.tsx`**: Remove email_relay special cases (multiple lines)
- [ ] **`ChannelSetupForms.tsx`**: Remove email_relay form logic (line 141)
- [ ] **`EnhancedToolsModal.tsx`**: Remove email relay grouping (lines 599, 610, 686)

#### 3.2 Update Channel Modal Logic
- [ ] **Replace credential selector logic**: Remove email_relay multi-provider filtering
- [ ] **Update defaultScopesForService**: Add proper SMTP, SendGrid, Mailgun scopes
- [ ] **Standardize provider matching**: Use consistent provider → credentials mapping
- [ ] **Test UI flow**: Verify each email provider can be connected separately

#### 3.3 Update Tools and Integrations Pages
- [ ] **`toolConstants.ts`**: Remove email_relay special handling (lines 44-45)
- [ ] **`useToolPermissions.ts`**: Remove email_relay logic (lines 67-68)
- [ ] **`CredentialSelector.tsx`**: Remove email relay detection (line 48)
- [ ] **`IntegrationsPage.tsx`**: Remove email_relay mapping (lines 142, 177)

### Phase 4: Testing & Validation (Day 2)

#### 4.1 Database Migration Testing
- [ ] **Run migration on development database**
- [ ] **Verify integrations created correctly**
- [ ] **Test Angela's permissions are fixed**
- [ ] **Validate all existing connections still work**

#### 4.2 Tool Discovery Testing
- [ ] **Test Angela's agent**: Verify she sees `smtp_send_email`, `smtp_email_templates`, etc.
- [ ] **Test SendGrid agent**: Verify `sendgrid_*` tools appear
- [ ] **Test Mailgun agent**: Verify `mailgun_*` tools with validation capabilities
- [ ] **Check tool execution**: Verify tools route to correct edge functions

#### 4.3 UI Flow Testing
- [ ] **Test SMTP connection**: Connect SMTP credentials to agent
- [ ] **Test SendGrid connection**: Connect SendGrid credentials to agent  
- [ ] **Test Mailgun connection**: Connect Mailgun credentials to agent
- [ ] **Verify no email_relay references**: Check UI shows separate integrations

### Phase 5: Production Deployment (Day 2)

#### 5.1 Pre-Deployment Checklist
- [ ] **All tests passing**: Unit, integration, and UI tests pass
- [ ] **Migration tested**: Database migration validated on staging
- [ ] **UI regression tested**: All email flows work correctly
- [ ] **Angela's fix verified**: Confirm Angela can see and use SMTP tools

#### 5.2 Deployment Process
- [ ] **Deploy database migration**: Run migration on production
- [ ] **Deploy code changes**: Update get-agent-tools and UI components
- [ ] **Monitor tool discovery**: Watch logs for any tool discovery issues
- [ ] **Validate user experience**: Confirm agents can connect and use email tools

## 🔧 Technical Implementation Details

### Migration Script Structure
```sql
-- Phase 1: Clean up existing Email Relay
DELETE FROM integration_capabilities WHERE integration_id IN (
    SELECT id FROM integrations WHERE name = 'Email Relay'
);
DELETE FROM integrations WHERE name = 'Email Relay';

-- Phase 2: Create separate integrations
INSERT INTO integrations (category_id, name, description, icon_name, status, is_popular, display_order, required_oauth_provider_id)
VALUES 
    -- SMTP Integration
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
     'SMTP Server', 'Connect to any SMTP server for email sending', 'Mail', 'available', true, 4,
     (SELECT id FROM oauth_providers WHERE name = 'smtp')),
    
    -- SendGrid Integration  
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
     'SendGrid', 'High-deliverability email service', 'Mail', 'available', true, 5,
     (SELECT id FROM oauth_providers WHERE name = 'sendgrid')),
     
    -- Mailgun Integration
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
     'Mailgun', 'Powerful email service with validation', 'Mail', 'available', true, 6,
     (SELECT id FROM oauth_providers WHERE name = 'mailgun'));

-- Phase 3: Add capabilities
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'send_email', 'Send Email', 1 FROM integrations i WHERE i.name IN ('SMTP Server', 'SendGrid', 'Mailgun');
-- ... (additional capabilities)

-- Phase 4: Fix Angela's permissions
UPDATE agent_integration_permissions 
SET allowed_scopes = '["send_email", "email_templates", "email_stats"]'::jsonb
WHERE id IN (
    SELECT aip.id FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN oauth_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name = 'smtp' AND aip.is_active = true
    AND (aip.allowed_scopes IS NULL OR aip.allowed_scopes = '[]'::jsonb)
);
```

### Updated Tool Discovery Logic
```typescript
// Simplified get-agent-tools logic
for (const permission of authorizedTools) {
    const provider = permission.user_integration_credentials.oauth_providers;
    const allowedScopes = permission.allowed_scopes || [];
    
    // Direct provider → integration lookup
    const integration = await supabase
        .from('integrations')
        .select('id, name, integration_capabilities(*)')
        .eq('required_oauth_provider_id', provider.id)
        .single();
    
    if (integration) {
        // Generate tools: smtp_send_email, sendgrid_send_email, etc.
        for (const capability of integration.integration_capabilities) {
            if (allowedScopes.includes(capability.capability_key)) {
                tools.push({
                    name: `${provider.name}_${capability.capability_key}`,
                    description: `${capability.display_label} via ${integration.name}`,
                    parameters: generateParametersForCapability(capability.capability_key)
                });
            }
        }
    }
}
```

## 🔒 Security Considerations

1. **Data Migration Safety**: Backup existing permissions before migration
2. **Permission Validation**: Ensure no permissions are lost during migration  
3. **Scope Validation**: Verify all email providers have proper scopes defined
4. **Rollback Plan**: Maintain ability to rollback migration if issues arise

## 📊 Success Metrics

1. **Angela's Fix**: Angela can see and use SMTP tools (`smtp_send_email`, etc.)
2. **Tool Discovery**: All email providers show predictable tools
3. **UI Cleanup**: No email_relay special cases remain in codebase
4. **MCP Compliance**: Tool discovery is simple and predictable
5. **Extensibility**: New email providers can be added easily

## 🚀 Rollout Strategy

1. **Development**: Implement in feature branch with comprehensive testing
2. **Database Migration**: Test migration on staging database first
3. **UI Testing**: Validate all email connection flows work correctly
4. **Production Deployment**: Deploy with monitoring for tool discovery issues
5. **User Validation**: Confirm existing email connections continue working

## 📚 Dependencies

- Database migration capabilities
- Existing oauth_providers for smtp, sendgrid, mailgun
- UI component library (Shadcn)
- Edge functions: smtp-api, sendgrid-api, mailgun-api
- Angela's agent ID: `87e6e948-694d-4f8c-8e94-2b4f6281ffc3`

## 🎯 Immediate Next Steps

1. **Create migration script** for splitting integrations
2. **Update get-agent-tools function** to use direct provider → integration lookup
3. **Remove email_relay special cases** from UI components
4. **Test Angela's SMTP tools** work correctly
5. **Deploy and validate** all email providers work independently

This plan provides a comprehensive roadmap for fixing the Email Relay architecture issues while maintaining backward compatibility and improving the overall system design for MCP compliance.
