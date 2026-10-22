# Database Schema Design for SendGrid Integration

## Date: August 2, 2025
## Related WBS Items: 2.1, 4.1

## Overview
This document outlines the database schema design for SendGrid integration, following the patterns established in the Gmail integration while adapting to SendGrid's API-key based authentication model.

## Core Tables

### 1. sendgrid_configurations
Primary configuration table for user-specific SendGrid settings.

```sql
CREATE TABLE sendgrid_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key_vault_id UUID NOT NULL,  -- Reference to encrypted API key in Vault
    from_email TEXT NOT NULL,        -- Default sender email
    from_name TEXT,                  -- Default sender name
    reply_to_email TEXT,             -- Default reply-to address
    
    -- Inbound configuration
    inbound_domain TEXT,             -- Domain for receiving emails (e.g., inbox.myapp.com)
    inbound_webhook_url TEXT,        -- Custom webhook URL if not using default
    inbound_parse_settings JSONB DEFAULT '{
        "spam_check": true,
        "send_raw": false,
        "check_spf": true
    }'::jsonb,
    
    -- Settings
    max_emails_per_day INTEGER DEFAULT 1000,
    max_recipients_per_email INTEGER DEFAULT 100,
    enable_tracking JSONB DEFAULT '{
        "opens": true,
        "clicks": true,
        "unsubscribes": true
    }'::jsonb,
    
    -- Security
    allowed_domains TEXT[],          -- Restrict sending to specific domains
    require_approval BOOLEAN DEFAULT false,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);
```

### 2. agent_sendgrid_permissions
Controls which agents can use SendGrid and with what capabilities.

```sql
CREATE TABLE agent_sendgrid_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    -- Permissions
    can_send_email BOOLEAN DEFAULT true,
    can_use_templates BOOLEAN DEFAULT false,
    can_send_bulk BOOLEAN DEFAULT false,
    can_manage_templates BOOLEAN DEFAULT false,
    can_view_analytics BOOLEAN DEFAULT false,
    can_receive_emails BOOLEAN DEFAULT false,
    
    -- Limits
    daily_send_limit INTEGER DEFAULT 100,
    recipients_per_email_limit INTEGER DEFAULT 10,
    
    -- Metadata
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, sendgrid_config_id)
);
```

### 3. agent_email_addresses
Email addresses assigned to specific agents for receiving emails.

```sql
CREATE TABLE agent_email_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    -- Email configuration
    local_part TEXT NOT NULL,        -- Part before @ (e.g., "agent-123abc")
    domain TEXT NOT NULL,            -- Domain part (must match inbound_domain)
    full_address TEXT GENERATED ALWAYS AS (local_part || '@' || domain) STORED,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_reply_template_id TEXT,     -- SendGrid template ID
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(local_part, domain),
    INDEX(agent_id),
    INDEX(full_address)
);
```

### 4. email_routing_rules
Rules for processing incoming emails.

```sql
CREATE TABLE email_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    agent_id UUID,  -- If null, applies to all agents
    
    -- Rule definition
    rule_name TEXT NOT NULL,
    priority INTEGER DEFAULT 100,  -- Lower number = higher priority
    
    -- Conditions (all must match)
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Example:
    {
        "from": {"contains": "@important-client.com"},
        "subject": {"matches": "^URGENT:"},
        "to": {"equals": "support@myapp.com"},
        "has_attachment": true
    }
    */
    
    -- Actions
    actions JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Example:
    {
        "forward_to": "escalation@myapp.com",
        "add_labels": ["urgent", "client"],
        "trigger_webhook": "https://myapp.com/urgent-handler",
        "auto_reply_template": "urgent_acknowledgment"
    }
    */
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_matched_at TIMESTAMPTZ,
    match_count INTEGER DEFAULT 0
);

CREATE INDEX idx_routing_rules_priority ON email_routing_rules(sendgrid_config_id, priority) WHERE is_active = true;
```

### 5. inbound_emails
Storage for processed inbound emails.

```sql
CREATE TABLE inbound_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    agent_id UUID,  -- Agent that received the email
    
    -- Email data
    message_id TEXT NOT NULL,        -- SendGrid message ID
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[],
    subject TEXT,
    
    -- Content
    text_body TEXT,
    html_body TEXT,
    headers JSONB,
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Processing
    routing_rules_applied UUID[],    -- IDs of rules that matched
    processed_at TIMESTAMPTZ DEFAULT now(),
    processing_status TEXT DEFAULT 'processed',
    processing_errors JSONB,
    
    -- Metadata
    spam_score FLOAT,
    spf_check TEXT,
    dkim_check TEXT,
    raw_webhook_data JSONB,          -- Original webhook payload
    
    created_at TIMESTAMPTZ DEFAULT now(),
    INDEX(agent_id, created_at DESC),
    INDEX(from_email),
    INDEX(message_id)
);
```

### 6. sendgrid_operation_logs
Audit log for all SendGrid operations.

```sql
CREATE TABLE sendgrid_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id),
    
    -- Operation details
    operation_type TEXT NOT NULL,  -- 'send_email', 'send_bulk', 'create_template', etc.
    operation_params JSONB,
    operation_result JSONB,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'success',  -- 'success', 'error', 'rate_limited'
    error_message TEXT,
    sendgrid_message_id TEXT,
    
    -- Metrics
    recipients_count INTEGER DEFAULT 1,
    execution_time_ms INTEGER,
    api_calls_made INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    INDEX(agent_id, created_at DESC),
    INDEX(operation_type, created_at DESC),
    INDEX(status, created_at DESC)
);
```

### 7. sendgrid_templates
Local cache of SendGrid templates.

```sql
CREATE TABLE sendgrid_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    
    -- Template data
    sendgrid_template_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    template_version_id TEXT,
    
    -- Metadata
    subject_template TEXT,
    is_dynamic BOOLEAN DEFAULT true,
    variables JSONB DEFAULT '{}'::jsonb,  -- Expected variables
    
    -- Usage
    agent_ids_allowed UUID[],  -- Agents allowed to use this template
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sendgrid_config_id, sendgrid_template_id)
);
```

## Database Functions

### 1. Get SendGrid Tools for Agent
```sql
CREATE OR REPLACE FUNCTION get_sendgrid_tools(p_agent_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tools JSONB = '[]'::jsonb;
    v_permission RECORD;
BEGIN
    -- Get agent permissions
    SELECT * INTO v_permission
    FROM agent_sendgrid_permissions asp
    JOIN sendgrid_configurations sc ON sc.id = asp.sendgrid_config_id
    WHERE asp.agent_id = p_agent_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true;
    
    IF NOT FOUND THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools based on permissions
    IF v_permission.can_send_email THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'send_email',
            'enabled', true,
            'limits', jsonb_build_object(
                'daily_limit', v_permission.daily_send_limit,
                'recipients_limit', v_permission.recipients_per_email_limit
            )
        );
    END IF;
    
    -- Add other tools based on permissions...
    
    RETURN v_tools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Process Inbound Email
```sql
CREATE OR REPLACE FUNCTION process_inbound_email(
    p_webhook_data JSONB,
    p_sendgrid_config_id UUID
) RETURNS UUID AS $$
DECLARE
    v_email_id UUID;
    v_agent_id UUID;
    v_to_address TEXT;
BEGIN
    -- Extract primary recipient
    v_to_address := p_webhook_data->>'to';
    
    -- Find agent by email address
    SELECT agent_id INTO v_agent_id
    FROM agent_email_addresses
    WHERE full_address = v_to_address
    AND sendgrid_config_id = p_sendgrid_config_id
    AND is_active = true;
    
    -- Insert email record
    INSERT INTO inbound_emails (
        sendgrid_config_id,
        agent_id,
        message_id,
        from_email,
        from_name,
        to_emails,
        subject,
        text_body,
        html_body,
        headers,
        raw_webhook_data
    ) VALUES (
        p_sendgrid_config_id,
        v_agent_id,
        p_webhook_data->>'message_id',
        p_webhook_data->>'from',
        p_webhook_data->>'from_name',
        string_to_array(p_webhook_data->>'to', ','),
        p_webhook_data->>'subject',
        p_webhook_data->>'text',
        p_webhook_data->>'html',
        p_webhook_data->'headers',
        p_webhook_data
    ) RETURNING id INTO v_email_id;
    
    -- Apply routing rules
    PERFORM apply_email_routing_rules(v_email_id);
    
    RETURN v_email_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Indexes and Constraints

```sql
-- Performance indexes
CREATE INDEX idx_sendgrid_configs_user ON sendgrid_configurations(user_id) WHERE is_active = true;
CREATE INDEX idx_agent_permissions_active ON agent_sendgrid_permissions(agent_id) WHERE is_active = true;
CREATE INDEX idx_inbound_emails_recent ON inbound_emails(created_at DESC);
CREATE INDEX idx_operation_logs_agent_date ON sendgrid_operation_logs(agent_id, created_at DESC);

-- Constraints
ALTER TABLE agent_email_addresses 
    ADD CONSTRAINT check_valid_email CHECK (local_part ~ '^[a-zA-Z0-9.+_-]+$');

ALTER TABLE sendgrid_configurations 
    ADD CONSTRAINT check_valid_from_email CHECK (from_email ~ '^[^@]+@[^@]+\.[^@]+$');
```

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE sendgrid_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sendgrid_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_templates ENABLE ROW LEVEL SECURITY;

-- Policies (example for sendgrid_configurations)
CREATE POLICY "Users can manage their own SendGrid configs" ON sendgrid_configurations
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their agents' permissions" ON agent_sendgrid_permissions
    FOR SELECT USING (
        sendgrid_config_id IN (
            SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
        )
    );
```

## Migration Strategy

1. Create all tables in order (respecting foreign keys)
2. Add initial data (e.g., default routing rules)
3. Create indexes after data load
4. Enable RLS policies
5. Grant necessary permissions

## Rollback Plan

```sql
-- Rollback script
DROP TABLE IF EXISTS sendgrid_operation_logs CASCADE;
DROP TABLE IF EXISTS inbound_emails CASCADE;
DROP TABLE IF EXISTS sendgrid_templates CASCADE;
DROP TABLE IF EXISTS email_routing_rules CASCADE;
DROP TABLE IF EXISTS agent_email_addresses CASCADE;
DROP TABLE IF EXISTS agent_sendgrid_permissions CASCADE;
DROP TABLE IF EXISTS sendgrid_configurations CASCADE;

DROP FUNCTION IF EXISTS get_sendgrid_tools(UUID, UUID);
DROP FUNCTION IF EXISTS process_inbound_email(JSONB, UUID);
```

## Performance Considerations

1. Partition `inbound_emails` by month if volume exceeds 1M records
2. Archive old `sendgrid_operation_logs` after 90 days
3. Use materialized views for analytics if needed
4. Consider JSONB indexing for frequently queried fields

## Security Notes

1. All API keys stored in Vault, never in plain text
2. RLS policies enforce user isolation
3. Service role needed for webhook processing
4. Rate limiting enforced at application layer
5. Input validation in database functions