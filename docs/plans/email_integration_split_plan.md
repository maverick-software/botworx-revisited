# Email Integration Split Plan

## Phase 1: Database Schema Changes

### 1.1 Create Separate Email Integrations

```sql
-- Remove existing Email Relay integration and create separate ones
DELETE FROM integration_capabilities WHERE integration_id IN (
    SELECT id FROM integrations WHERE name = 'Email Relay'
);

DELETE FROM integrations WHERE name = 'Email Relay';

-- Create separate SMTP, SendGrid, and Mailgun integrations
INSERT INTO integrations (
    category_id, 
    name, 
    description, 
    icon_name, 
    status, 
    is_popular, 
    display_order,
    required_oauth_provider_id
) VALUES 
    -- SMTP Integration
    (
        (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
        'SMTP Server',
        'Connect to any SMTP server for email sending',
        'Mail',
        'available',
        true,
        4,
        (SELECT id FROM oauth_providers WHERE name = 'smtp')
    ),
    -- SendGrid Integration  
    (
        (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
        'SendGrid',
        'High-deliverability email service with advanced features',
        'Mail',
        'available', 
        true,
        5,
        (SELECT id FROM oauth_providers WHERE name = 'sendgrid')
    ),
    -- Mailgun Integration
    (
        (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
        'Mailgun',
        'Powerful email service with validation and analytics',
        'Mail',
        'available',
        true, 
        6,
        (SELECT id FROM oauth_providers WHERE name = 'mailgun')
    );
```

### 1.2 Add Integration Capabilities

```sql
-- Add capabilities for SMTP
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'send_email', 'Send Email', 1 
FROM integrations i WHERE i.name = 'SMTP Server';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_templates', 'Email Templates', 2 
FROM integrations i WHERE i.name = 'SMTP Server';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_stats', 'Email Statistics', 3 
FROM integrations i WHERE i.name = 'SMTP Server';

-- Add capabilities for SendGrid
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'send_email', 'Send Email', 1 
FROM integrations i WHERE i.name = 'SendGrid';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_templates', 'Email Templates', 2 
FROM integrations i WHERE i.name = 'SendGrid';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_stats', 'Email Statistics', 3 
FROM integrations i WHERE i.name = 'SendGrid';

-- Add capabilities for Mailgun
INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'send_email', 'Send Email', 1 
FROM integrations i WHERE i.name = 'Mailgun';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_templates', 'Email Templates', 2 
FROM integrations i WHERE i.name = 'Mailgun';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_stats', 'Email Statistics', 3 
FROM integrations i WHERE i.name = 'Mailgun';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'email_validation', 'Email Validation', 4 
FROM integrations i WHERE i.name = 'Mailgun';

INSERT INTO integration_capabilities (integration_id, capability_key, display_label, display_order)
SELECT i.id, 'suppression_management', 'Suppression Management', 5 
FROM integrations i WHERE i.name = 'Mailgun';
```

## Phase 2: Update get-agent-tools Function

### 2.1 Simplify Tool Discovery Logic

Remove complex Email Relay mapping logic and use direct provider → integration lookup:

```typescript
// OLD: Complex Email Relay mapping
if (providerName === 'smtp' && emailRelayIntegration) {
    // Complex mapping logic...
}

// NEW: Direct provider → integration lookup
const integration = await supabase
    .from('integrations')
    .select('id, name, integration_capabilities(*)')
    .eq('required_oauth_provider_id', provider.id)
    .single();

if (integration) {
    // Generate tools: smtp_send_email, sendgrid_send_email, etc.
    for (const capability of integration.integration_capabilities) {
        if (allowedScopes.includes(capability.capability_key)) {
            const toolName = `${providerName}_${capability.capability_key}`;
            tools.push({
                name: toolName,
                description: `${capability.display_label} via ${integration.name}`,
                parameters: generateParametersForCapability(capability.capability_key)
            });
        }
    }
}
```

## Phase 3: UI Component Updates

### 3.1 Remove Email Relay Special Cases

**Files to Update:**
- `src/components/modals/channels/AvailableChannelsList.tsx` (lines 73-77)
- `src/components/modals/channels/EnhancedChannelsModalRefactored.tsx` (lines 408, 447, 466)
- `src/components/modals/channels/ConnectedChannelsList.tsx` (line 57)
- `src/components/modals/channels/ChannelConnectionItem.tsx` (line 93)
- `src/components/modals/EnhancedChannelsModal.tsx` (lines 180-181, 458, 504, 790)
- `src/components/modals/channels/ChannelSetupForms.tsx` (line 141)
- `src/components/modals/EnhancedToolsModal.tsx` (lines 599, 610, 686)
- `src/components/modals/tools/toolConstants.ts` (lines 44-45)
- `src/components/modals/tools/useToolPermissions.ts` (lines 67-68)
- `src/components/modals/tools/CredentialSelector.tsx` (line 48)
- `src/components/modals/tools/AvailableToolsList.tsx` (line 67)
- `src/components/modals/tools/ConnectedToolsList.tsx` (line 157)
- `src/pages/IntegrationsPage.tsx` (lines 142, 177)

### 3.2 Update Channel Modal Logic

Replace Email Relay special cases with standard integration handling:

```typescript
// REMOVE: Special email_relay handling
const creds = serviceId === 'email_relay' 
    ? connections.filter(c => ['smtp', 'sendgrid', 'mailgun'].includes(c.provider_name))
    : connections.filter(c => c.provider_name === provider);

// REPLACE WITH: Standard provider matching
const creds = connections.filter(c => c.provider_name === provider);
```

### 3.3 Update defaultScopesForService Function

```typescript
const defaultScopesForService = (serviceId: string): string[] => {
    if (serviceId === 'gmail') return [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify'
    ];
    if (serviceId === 'smtp') return ['send_email', 'email_templates', 'email_stats'];
    if (serviceId === 'sendgrid') return ['send_email', 'email_templates', 'email_stats'];
    if (serviceId === 'mailgun') return ['send_email', 'email_templates', 'email_stats', 'email_validation', 'suppression_management'];
    return [];
};
```

## Phase 4: Update Universal Tool Executor

### 4.1 Add Separate Provider Mappings

```typescript
const TOOL_ROUTING_MAP: Record<string, ToolRoutingConfig> = {
    // Existing mappings...
    
    // SMTP tools
    'smtp_': {
        edgeFunction: 'smtp-api',
        actionMapping: (toolName: string) => {
            return toolName.replace('smtp_', '');
        },
        parameterMapping: (params: Record<string, any>, context: any) => ({
            action: toolName.replace('smtp_', ''),
            agent_id: context.agentId,
            user_id: context.userId, 
            params: params
        })
    },
    
    // SendGrid tools  
    'sendgrid_': {
        edgeFunction: 'sendgrid-api',
        actionMapping: (toolName: string) => {
            return toolName.replace('sendgrid_', '');
        },
        parameterMapping: (params: Record<string, any>, context: any) => ({
            action: toolName.replace('sendgrid_', ''),
            agent_id: context.agentId,
            user_id: context.userId,
            params: params
        })
    },
    
    // Mailgun tools
    'mailgun_': {
        edgeFunction: 'mailgun-api', 
        actionMapping: (toolName: string) => {
            return toolName.replace('mailgun_', '');
        },
        parameterMapping: (params: Record<string, any>, context: any) => ({
            action: toolName.replace('mailgun_', ''),
            agent_id: context.agentId,
            user_id: context.userId,
            params: params
        })
    }
};
```

## Phase 5: Data Migration

### 5.1 Migrate Existing Permissions

```sql
-- Fix Angela's existing permissions by updating to use new SMTP integration
UPDATE agent_integration_permissions 
SET allowed_scopes = '["send_email", "email_templates", "email_stats"]'::jsonb
WHERE id IN (
    SELECT aip.id
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN oauth_providers op ON uic.oauth_provider_id = op.id
    WHERE op.name = 'smtp'
      AND aip.is_active = true
      AND (aip.allowed_scopes IS NULL OR aip.allowed_scopes = '[]'::jsonb)
);
```

## Phase 6: Testing & Validation

### 6.1 Test Cases
1. **Tool Discovery**: Verify agents see `smtp_send_email`, `sendgrid_send_email`, `mailgun_send_email`
2. **UI Flow**: Test connecting each email provider separately
3. **Tool Execution**: Verify tools route to correct edge functions
4. **Angela's Fix**: Confirm Angela can see and use SMTP tools

### 6.2 Rollback Plan
- Keep backup of Email Relay integration data
- Provide rollback migration if issues arise
- Monitor tool discovery logs for errors

## Benefits of This Approach

1. **✅ MCP Compliant**: Each integration has clear, predictable tools
2. **✅ Extensible**: Easy to add new email providers
3. **✅ Simple Tool Discovery**: Direct provider → integration → tools mapping
4. **✅ Clear UI**: No special cases, consistent behavior
5. **✅ Maintainable**: Standard patterns throughout codebase
