-- SendGrid Integration Core Tables
-- Date: August 3, 2025
-- Purpose: Create core SendGrid integration tables and functions

-- Create sendgrid_configurations table
CREATE TABLE IF NOT EXISTS sendgrid_configurations (
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

-- Create agent_sendgrid_permissions table
CREATE TABLE IF NOT EXISTS agent_sendgrid_permissions (
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

-- Create agent_email_addresses table
CREATE TABLE IF NOT EXISTS agent_email_addresses (
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
    UNIQUE(local_part, domain)
);

-- Create sendgrid_templates table (local cache)
CREATE TABLE IF NOT EXISTS sendgrid_templates (
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

-- Create sendgrid_operation_logs table
CREATE TABLE IF NOT EXISTS sendgrid_operation_logs (
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
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sendgrid_configs_user ON sendgrid_configurations(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_permissions_active ON agent_sendgrid_permissions(agent_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_email_addresses_agent ON agent_email_addresses(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_email_addresses_full ON agent_email_addresses(full_address);
CREATE INDEX IF NOT EXISTS idx_operation_logs_agent_date ON sendgrid_operation_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_type_date ON sendgrid_operation_logs(operation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_status_date ON sendgrid_operation_logs(status, created_at DESC);

-- Enable Row Level Security
ALTER TABLE sendgrid_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sendgrid_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_email_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_operation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sendgrid_configurations
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_configurations' 
        AND policyname = 'Users can manage their own SendGrid configs'
    ) THEN
        CREATE POLICY "Users can manage their own SendGrid configs" ON sendgrid_configurations
            FOR ALL USING (user_id = auth.uid());
    END IF;
END $$;

-- RLS Policies for agent_sendgrid_permissions
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'agent_sendgrid_permissions' 
        AND policyname = 'Users can view their agents'' permissions'
    ) THEN
        CREATE POLICY "Users can view their agents' permissions" ON agent_sendgrid_permissions
            FOR SELECT USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'agent_sendgrid_permissions' 
        AND policyname = 'Users can manage their agents'' permissions'
    ) THEN
        CREATE POLICY "Users can manage their agents' permissions" ON agent_sendgrid_permissions
            FOR ALL USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- RLS Policies for agent_email_addresses
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'agent_email_addresses' 
        AND policyname = 'Users can view their agents'' email addresses'
    ) THEN
        CREATE POLICY "Users can view their agents' email addresses" ON agent_email_addresses
            FOR SELECT USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'agent_email_addresses' 
        AND policyname = 'Users can manage their agents'' email addresses'
    ) THEN
        CREATE POLICY "Users can manage their agents' email addresses" ON agent_email_addresses
            FOR ALL USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- RLS Policies for sendgrid_templates
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_templates' 
        AND policyname = 'Users can manage their templates'
    ) THEN
        CREATE POLICY "Users can manage their templates" ON sendgrid_templates
            FOR ALL USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- RLS Policies for sendgrid_operation_logs
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_operation_logs' 
        AND policyname = 'Users can view their own logs'
    ) THEN
        CREATE POLICY "Users can view their own logs" ON sendgrid_operation_logs
            FOR SELECT USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_operation_logs' 
        AND policyname = 'Service role can manage all logs'
    ) THEN
        CREATE POLICY "Service role can manage all logs" ON sendgrid_operation_logs
            FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_sendgrid_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sendgrid_configurations_updated_at ON sendgrid_configurations;
CREATE TRIGGER update_sendgrid_configurations_updated_at
    BEFORE UPDATE ON sendgrid_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

DROP TRIGGER IF EXISTS update_agent_sendgrid_permissions_updated_at ON agent_sendgrid_permissions;
CREATE TRIGGER update_agent_sendgrid_permissions_updated_at
    BEFORE UPDATE ON agent_sendgrid_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

DROP TRIGGER IF EXISTS update_agent_email_addresses_updated_at ON agent_email_addresses;
CREATE TRIGGER update_agent_email_addresses_updated_at
    BEFORE UPDATE ON agent_email_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

DROP TRIGGER IF EXISTS update_sendgrid_templates_updated_at ON sendgrid_templates;
CREATE TRIGGER update_sendgrid_templates_updated_at
    BEFORE UPDATE ON sendgrid_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

-- Database function to get SendGrid tools for agent
CREATE OR REPLACE FUNCTION get_sendgrid_tools(p_agent_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tools JSONB = '[]'::jsonb;
    v_permission RECORD;
BEGIN
    -- Get agent permissions and config
    SELECT 
        asp.*,
        sc.id as config_id,
        sc.is_active as config_active
    INTO v_permission
    FROM agent_sendgrid_permissions asp
    JOIN sendgrid_configurations sc ON sc.id = asp.sendgrid_config_id
    WHERE asp.agent_id = p_agent_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true;
    
    IF NOT FOUND THEN
        RETURN v_tools;
    END IF;
    
    -- Build tools array based on permissions
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
    
    IF v_permission.can_use_templates THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'send_template_email',
            'enabled', true
        );
    END IF;
    
    IF v_permission.can_send_bulk THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'send_bulk_email',
            'enabled', true,
            'limits', jsonb_build_object(
                'max_personalizations', 1000
            )
        );
    END IF;
    
    IF v_permission.can_view_analytics THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'get_email_status',
            'enabled', true
        );
        v_tools = v_tools || jsonb_build_object(
            'name', 'search_email_analytics',
            'enabled', true
        );
    END IF;
    
    IF v_permission.can_receive_emails THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'list_inbound_emails',
            'enabled', true
        );
    END IF;
    
    IF v_permission.can_manage_templates THEN
        v_tools = v_tools || jsonb_build_object(
            'name', 'create_email_template',
            'enabled', true
        );
    END IF;
    
    RETURN v_tools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate agent SendGrid permissions
CREATE OR REPLACE FUNCTION validate_agent_sendgrid_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT 
        CASE p_permission
            WHEN 'can_send_email' THEN asp.can_send_email
            WHEN 'can_use_templates' THEN asp.can_use_templates
            WHEN 'can_send_bulk' THEN asp.can_send_bulk
            WHEN 'can_manage_templates' THEN asp.can_manage_templates
            WHEN 'can_view_analytics' THEN asp.can_view_analytics
            WHEN 'can_receive_emails' THEN asp.can_receive_emails
            ELSE false
        END INTO v_has_permission
    FROM agent_sendgrid_permissions asp
    JOIN sendgrid_configurations sc ON sc.id = asp.sendgrid_config_id
    WHERE asp.agent_id = p_agent_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true
    AND (asp.expires_at IS NULL OR asp.expires_at > now());
    
    RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log SendGrid operations
CREATE OR REPLACE FUNCTION log_sendgrid_operation(
    p_agent_id UUID,
    p_user_id UUID,
    p_operation_type TEXT,
    p_operation_params JSONB DEFAULT NULL,
    p_operation_result JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL,
    p_message_id TEXT DEFAULT NULL,
    p_recipients_count INTEGER DEFAULT 1,
    p_execution_time_ms INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
    v_log_id UUID;
BEGIN
    -- Get user's SendGrid config
    SELECT id INTO v_config_id
    FROM sendgrid_configurations
    WHERE user_id = p_user_id
    AND is_active = true;
    
    -- Insert operation log
    INSERT INTO sendgrid_operation_logs (
        agent_id,
        user_id,
        sendgrid_config_id,
        operation_type,
        operation_params,
        operation_result,
        status,
        error_message,
        sendgrid_message_id,
        recipients_count,
        execution_time_ms
    ) VALUES (
        p_agent_id,
        p_user_id,
        v_config_id,
        p_operation_type,
        p_operation_params,
        p_operation_result,
        p_status,
        p_error_message,
        p_message_id,
        p_recipients_count,
        p_execution_time_ms
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON sendgrid_configurations TO anon, authenticated;
GRANT SELECT ON agent_sendgrid_permissions TO anon, authenticated;
GRANT SELECT ON agent_email_addresses TO anon, authenticated;
GRANT SELECT ON sendgrid_templates TO anon, authenticated;
GRANT SELECT ON sendgrid_operation_logs TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_sendgrid_tools(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_agent_sendgrid_permissions(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION log_sendgrid_operation(UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

-- Add constraint to ensure email address validation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_valid_local_part') THEN
        ALTER TABLE agent_email_addresses 
            ADD CONSTRAINT check_valid_local_part CHECK (local_part ~ '^[a-zA-Z0-9.+_-]+$');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_valid_from_email') THEN
        ALTER TABLE sendgrid_configurations 
            ADD CONSTRAINT check_valid_from_email CHECK (from_email ~ '^[^@]+@[^@]+\.[^@]+$');
    END IF;
END $$;

-- Add SendGrid to service_providers table (as API key type)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'sendgrid') THEN
        INSERT INTO service_providers (
            name, 
            display_name, 
            authorization_endpoint, 
            token_endpoint, 
            scopes_supported, 
            configuration_metadata, 
            is_enabled,
            pkce_required
        ) VALUES (
            'sendgrid',
            'SendGrid',
            '',  -- No OAuth URL for API key
            '',  -- No token URL for API key
            '[]'::jsonb,  -- No scopes for API key
            '{
                "type": "api_key",
                "requires_client_secret": false,
                "flow_type": "api_key"
            }'::jsonb,
            true,
            false  -- PKCE not required for API key
        );
    END IF;
END $$;


