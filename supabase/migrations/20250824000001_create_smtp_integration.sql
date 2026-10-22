-- SMTP Tool Integration Migration
-- Date: 2025-08-24
-- Purpose: Create comprehensive SMTP integration with secure credential storage

-- =============================================
-- STEP 1: Skip OAuth Provider Creation (SMTP doesn't use OAuth)
-- =============================================
-- SMTP uses direct credential storage via Vault, not OAuth
-- We'll handle integration catalog in the separate migration

-- =============================================
-- STEP 1: Create SMTP Configurations Table
-- =============================================

CREATE TABLE IF NOT EXISTS smtp_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_name TEXT NOT NULL,
    
    -- SMTP Server Settings
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 587,
    secure BOOLEAN NOT NULL DEFAULT false,  -- true for SSL (465), false for TLS (587)
    
    -- Authentication
    username TEXT NOT NULL,
    vault_password_id TEXT NOT NULL,  -- Reference to encrypted password in vault
    
    -- Email Defaults
    from_email TEXT NOT NULL,
    from_name TEXT,
    reply_to_email TEXT,
    
    -- Connection Settings
    connection_timeout INTEGER DEFAULT 60000,  -- milliseconds
    socket_timeout INTEGER DEFAULT 60000,
    greeting_timeout INTEGER DEFAULT 30000,
    
    -- Rate Limiting
    max_emails_per_day INTEGER DEFAULT 100,
    max_recipients_per_email INTEGER DEFAULT 50,
    
    -- Status and Testing
    is_active BOOLEAN DEFAULT true,
    last_tested_at TIMESTAMPTZ,
    test_status TEXT DEFAULT 'pending',  -- 'success', 'failed', 'pending'
    test_error_message TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT smtp_configurations_port_check CHECK (port BETWEEN 1 AND 65535),
    CONSTRAINT smtp_configurations_test_status_check CHECK (test_status IN ('success', 'failed', 'pending')),
    CONSTRAINT smtp_configurations_timeout_check CHECK (
        connection_timeout > 0 AND 
        socket_timeout > 0 AND 
        greeting_timeout > 0
    ),
    CONSTRAINT smtp_configurations_rate_limit_check CHECK (
        max_emails_per_day > 0 AND 
        max_recipients_per_email > 0
    ),
    CONSTRAINT smtp_configurations_user_name_unique UNIQUE (user_id, connection_name)
);

-- Add comments for clarity
COMMENT ON TABLE smtp_configurations IS 'SMTP server configurations for users with secure credential storage';
COMMENT ON COLUMN smtp_configurations.vault_password_id IS 'Reference to encrypted SMTP password in Supabase Vault';
COMMENT ON COLUMN smtp_configurations.secure IS 'true for SSL (port 465), false for TLS/STARTTLS (port 587)';
COMMENT ON COLUMN smtp_configurations.test_status IS 'Result of last connection test: success, failed, or pending';

-- =============================================
-- STEP 2: Create Agent SMTP Permissions Table
-- =============================================

CREATE TABLE IF NOT EXISTS agent_smtp_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    smtp_config_id UUID NOT NULL REFERENCES smtp_configurations(id) ON DELETE CASCADE,
    
    -- Permissions
    can_send_email BOOLEAN DEFAULT true,
    can_send_attachments BOOLEAN DEFAULT false,
    can_use_custom_from BOOLEAN DEFAULT false,
    
    -- Rate Limits (override config defaults if set)
    daily_email_limit INTEGER,  -- NULL = use config default
    recipients_per_email_limit INTEGER,  -- NULL = use config default
    
    -- Restrictions
    allowed_recipients JSONB DEFAULT '[]'::jsonb,  -- Array of allowed email patterns
    blocked_recipients JSONB DEFAULT '[]'::jsonb,  -- Array of blocked email patterns
    
    -- Metadata
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT agent_smtp_permissions_limits_check CHECK (
        (daily_email_limit IS NULL OR daily_email_limit > 0) AND
        (recipients_per_email_limit IS NULL OR recipients_per_email_limit > 0)
    ),
    CONSTRAINT agent_smtp_permissions_unique UNIQUE (agent_id, smtp_config_id)
);

-- Add comments
COMMENT ON TABLE agent_smtp_permissions IS 'Agent-specific permissions for SMTP configurations';
COMMENT ON COLUMN agent_smtp_permissions.allowed_recipients IS 'JSON array of allowed email address patterns (e.g., ["*@company.com", "user@domain.com"])';
COMMENT ON COLUMN agent_smtp_permissions.blocked_recipients IS 'JSON array of blocked email address patterns';

-- =============================================
-- STEP 3: Create SMTP Operation Logs Table
-- =============================================

CREATE TABLE IF NOT EXISTS smtp_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    agent_id UUID REFERENCES agents(id),
    smtp_config_id UUID NOT NULL REFERENCES smtp_configurations(id),
    
    -- Operation Details
    operation_type TEXT NOT NULL,  -- 'send_email', 'test_connection'
    operation_params JSONB,  -- Input parameters (sanitized)
    operation_result JSONB,  -- Response data
    
    -- Email Details (for send_email operations)
    recipients_count INTEGER DEFAULT 0,
    has_attachments BOOLEAN DEFAULT false,
    email_size_bytes INTEGER,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'success',  -- 'success', 'error', 'timeout'
    error_message TEXT,
    error_code TEXT,
    
    -- Performance
    execution_time_ms INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    
    -- Audit
    client_ip INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT smtp_operation_logs_status_check CHECK (status IN ('success', 'error', 'timeout')),
    CONSTRAINT smtp_operation_logs_operation_type_check CHECK (operation_type IN ('send_email', 'test_connection')),
    CONSTRAINT smtp_operation_logs_recipients_check CHECK (recipients_count >= 0),
    CONSTRAINT smtp_operation_logs_execution_time_check CHECK (execution_time_ms >= 0)
);

-- Add comments
COMMENT ON TABLE smtp_operation_logs IS 'Audit log for all SMTP operations';
COMMENT ON COLUMN smtp_operation_logs.operation_params IS 'Sanitized input parameters (passwords and sensitive data removed)';

-- =============================================
-- STEP 4: Create Indexes for Performance
-- =============================================

-- SMTP configurations indexes
CREATE INDEX IF NOT EXISTS idx_smtp_configurations_user_id ON smtp_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_smtp_configurations_active ON smtp_configurations(user_id, is_active) WHERE is_active = true;

-- Agent permissions indexes
CREATE INDEX IF NOT EXISTS idx_agent_smtp_permissions_agent_id ON agent_smtp_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_smtp_permissions_config_id ON agent_smtp_permissions(smtp_config_id);
CREATE INDEX IF NOT EXISTS idx_agent_smtp_permissions_active ON agent_smtp_permissions(agent_id, is_active) WHERE is_active = true;

-- Operation logs indexes
CREATE INDEX IF NOT EXISTS idx_smtp_operation_logs_user_id ON smtp_operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_smtp_operation_logs_agent_id ON smtp_operation_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_smtp_operation_logs_config_id ON smtp_operation_logs(smtp_config_id);
CREATE INDEX IF NOT EXISTS idx_smtp_operation_logs_created_at ON smtp_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smtp_operation_logs_daily_count ON smtp_operation_logs(user_id, agent_id, smtp_config_id, created_at) 
    WHERE operation_type = 'send_email' AND status = 'success';

-- =============================================
-- STEP 5: Enable Row Level Security
-- =============================================

-- Enable RLS on all SMTP tables
ALTER TABLE smtp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_smtp_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_operation_logs ENABLE ROW LEVEL SECURITY;

-- SMTP configurations policies
CREATE POLICY "Users can manage their own SMTP configs" ON smtp_configurations
    FOR ALL USING (user_id = auth.uid());

-- Agent SMTP permissions policies
CREATE POLICY "Users can manage permissions for their agents" ON agent_smtp_permissions
    FOR ALL USING (
        granted_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM agents 
            WHERE id = agent_smtp_permissions.agent_id 
            AND user_id = auth.uid()
        )
    );

-- SMTP operation logs policies
CREATE POLICY "Users can view their own SMTP logs" ON smtp_operation_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can insert SMTP logs" ON smtp_operation_logs
    FOR INSERT TO service_role WITH CHECK (true);

-- =============================================
-- STEP 6: Create Update Triggers
-- =============================================

-- Update trigger for smtp_configurations
CREATE OR REPLACE FUNCTION update_smtp_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER smtp_configurations_updated_at
    BEFORE UPDATE ON smtp_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_smtp_configurations_updated_at();

-- Update trigger for agent_smtp_permissions
CREATE OR REPLACE FUNCTION update_agent_smtp_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_smtp_permissions_updated_at
    BEFORE UPDATE ON agent_smtp_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_smtp_permissions_updated_at();

-- =============================================
-- STEP 7: Create Secure Vault Functions
-- =============================================

-- Store SMTP password securely
CREATE OR REPLACE FUNCTION store_smtp_password(
    p_user_id UUID,
    p_config_name TEXT,
    p_password TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    vault_id UUID;
BEGIN
    -- Validate user access
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: can only store own credentials';
    END IF;
    
    -- Validate inputs
    IF p_config_name IS NULL OR p_password IS NULL THEN
        RAISE EXCEPTION 'Configuration name and password are required';
    END IF;
    
    -- Encrypt password in vault
    SELECT vault.create_secret(
        p_password,
        format('smtp_%s_%s', p_user_id, p_config_name),
        format('SMTP password for %s', p_config_name)
    ) INTO vault_id;
    
    RETURN vault_id::TEXT;
END;
$$;

-- Retrieve SMTP password securely
CREATE OR REPLACE FUNCTION get_smtp_password(
    p_user_id UUID,
    p_vault_id TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    decrypted_password TEXT;
BEGIN
    -- Validate user access
    IF p_user_id != auth.uid() THEN
        RAISE EXCEPTION 'Access denied: can only access own credentials';
    END IF;
    
    -- Validate input
    IF p_vault_id IS NULL THEN
        RAISE EXCEPTION 'Vault ID is required';
    END IF;
    
    -- Retrieve decrypted password
    SELECT decrypted_secret
    INTO decrypted_password
    FROM vault.decrypted_secrets
    WHERE id = p_vault_id::UUID;
    
    IF decrypted_password IS NULL THEN
        RAISE EXCEPTION 'SMTP password not found or access denied';
    END IF;
    
    RETURN decrypted_password;
END;
$$;

-- Update SMTP password
CREATE OR REPLACE FUNCTION update_smtp_password(
    p_user_id UUID,
    p_config_id UUID,
    p_new_password TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    old_vault_id TEXT;
    new_vault_id UUID;
    config_name TEXT;
BEGIN
    -- Validate user access and get current vault ID
    SELECT vault_password_id, connection_name
    INTO old_vault_id, config_name
    FROM smtp_configurations
    WHERE id = p_config_id AND user_id = p_user_id;
    
    IF old_vault_id IS NULL THEN
        RAISE EXCEPTION 'SMTP configuration not found or access denied';
    END IF;
    
    -- Create new encrypted password
    SELECT vault.create_secret(
        p_new_password,
        format('smtp_%s_%s', p_user_id, config_name),
        format('Updated SMTP password for %s', config_name)
    ) INTO new_vault_id;
    
    -- Update configuration with new vault ID
    UPDATE smtp_configurations
    SET vault_password_id = new_vault_id::TEXT,
        updated_at = NOW()
    WHERE id = p_config_id;
    
    -- Delete old secret from vault
    DELETE FROM vault.secrets WHERE id = old_vault_id::UUID;
    
    RETURN new_vault_id::TEXT;
END;
$$;

-- Revoke SMTP credentials
CREATE OR REPLACE FUNCTION revoke_smtp_credentials(
    p_user_id UUID,
    p_config_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    vault_id TEXT;
BEGIN
    -- Get vault ID for the configuration
    SELECT vault_password_id
    INTO vault_id
    FROM smtp_configurations
    WHERE id = p_config_id AND user_id = p_user_id;
    
    IF vault_id IS NULL THEN
        RAISE EXCEPTION 'SMTP configuration not found or access denied';
    END IF;
    
    -- Mark configuration as inactive
    UPDATE smtp_configurations
    SET is_active = false,
        updated_at = NOW()
    WHERE id = p_config_id;
    
    -- Delete secret from vault
    DELETE FROM vault.secrets WHERE id = vault_id::UUID;
    
    RETURN true;
END;
$$;

-- =============================================
-- STEP 8: Create Helper Functions
-- =============================================

-- Get SMTP tools for agent
CREATE OR REPLACE FUNCTION get_smtp_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    tools JSONB := '[]'::jsonb;
    permission RECORD;
BEGIN
    -- Get agent SMTP permissions
    FOR permission IN
        SELECT 
            asp.*,
            sc.connection_name,
            sc.from_email
        FROM agent_smtp_permissions asp
        JOIN smtp_configurations sc ON sc.id = asp.smtp_config_id
        WHERE asp.agent_id = p_agent_id
        AND sc.user_id = p_user_id
        AND asp.is_active = true
        AND sc.is_active = true
        AND (asp.expires_at IS NULL OR asp.expires_at > NOW())
    LOOP
        -- Add send_email tool if permitted
        IF permission.can_send_email THEN
            tools := tools || jsonb_build_object(
                'name', 'send_email',
                'description', format('Send email via %s (%s)', permission.connection_name, permission.from_email),
                'config_id', permission.smtp_config_id,
                'daily_limit', COALESCE(permission.daily_email_limit, 100),
                'recipients_limit', COALESCE(permission.recipients_per_email_limit, 50)
            );
        END IF;
        
        -- Add test_connection tool (always available)
        tools := tools || jsonb_build_object(
            'name', 'test_connection',
            'description', format('Test SMTP connection for %s', permission.connection_name),
            'config_id', permission.smtp_config_id
        );
    END LOOP;
    
    RETURN tools;
END;
$$;

-- Validate agent SMTP permissions
CREATE OR REPLACE FUNCTION validate_agent_smtp_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_smtp_config_id UUID,
    p_permission_type TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    SELECT 
        CASE p_permission_type
            WHEN 'send_email' THEN asp.can_send_email
            WHEN 'send_attachments' THEN asp.can_send_attachments
            WHEN 'use_custom_from' THEN asp.can_use_custom_from
            ELSE false
        END INTO has_permission
    FROM agent_smtp_permissions asp
    JOIN smtp_configurations sc ON sc.id = asp.smtp_config_id
    WHERE asp.agent_id = p_agent_id
    AND asp.smtp_config_id = p_smtp_config_id
    AND sc.user_id = p_user_id
    AND asp.is_active = true
    AND sc.is_active = true
    AND (asp.expires_at IS NULL OR asp.expires_at > NOW());
    
    RETURN COALESCE(has_permission, false);
END;
$$;

-- Log SMTP operation
CREATE OR REPLACE FUNCTION log_smtp_operation(
    p_user_id UUID,
    p_agent_id UUID,
    p_smtp_config_id UUID,
    p_operation_type TEXT,
    p_operation_params JSONB DEFAULT NULL,
    p_operation_result JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL,
    p_recipients_count INTEGER DEFAULT 0,
    p_execution_time_ms INTEGER DEFAULT 0,
    p_client_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO smtp_operation_logs (
        user_id,
        agent_id,
        smtp_config_id,
        operation_type,
        operation_params,
        operation_result,
        status,
        error_message,
        recipients_count,
        execution_time_ms,
        client_ip,
        user_agent,
        created_at
    ) VALUES (
        p_user_id,
        p_agent_id,
        p_smtp_config_id,
        p_operation_type,
        p_operation_params,
        p_operation_result,
        p_status,
        p_error_message,
        p_recipients_count,
        p_execution_time_ms,
        p_client_ip,
        p_user_agent,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

-- Check SMTP rate limits
CREATE OR REPLACE FUNCTION check_smtp_rate_limit(
    p_user_id UUID,
    p_agent_id UUID,
    p_smtp_config_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    daily_count INTEGER;
    hourly_count INTEGER;
    config_daily_limit INTEGER;
    agent_daily_limit INTEGER;
    effective_daily_limit INTEGER;
BEGIN
    -- Get configuration limits
    SELECT max_emails_per_day
    INTO config_daily_limit
    FROM smtp_configurations
    WHERE id = p_smtp_config_id AND user_id = p_user_id;
    
    -- Get agent-specific limits
    SELECT daily_email_limit
    INTO agent_daily_limit
    FROM agent_smtp_permissions
    WHERE agent_id = p_agent_id AND smtp_config_id = p_smtp_config_id;
    
    -- Use the more restrictive limit
    effective_daily_limit := LEAST(
        COALESCE(config_daily_limit, 100),
        COALESCE(agent_daily_limit, 100)
    );
    
    -- Check daily limit
    SELECT COUNT(*)
    INTO daily_count
    FROM smtp_operation_logs
    WHERE user_id = p_user_id
    AND agent_id = p_agent_id
    AND smtp_config_id = p_smtp_config_id
    AND operation_type = 'send_email'
    AND status = 'success'
    AND created_at >= CURRENT_DATE;
    
    IF daily_count >= effective_daily_limit THEN
        RAISE EXCEPTION 'Daily email limit exceeded: % emails sent, limit is %', 
            daily_count, effective_daily_limit;
    END IF;
    
    -- Check hourly limit (10% of daily limit per hour)
    SELECT COUNT(*)
    INTO hourly_count
    FROM smtp_operation_logs
    WHERE user_id = p_user_id
    AND agent_id = p_agent_id
    AND smtp_config_id = p_smtp_config_id
    AND operation_type = 'send_email'
    AND status = 'success'
    AND created_at >= NOW() - INTERVAL '1 hour';
    
    IF hourly_count >= (effective_daily_limit * 0.1) THEN
        RAISE EXCEPTION 'Hourly email limit exceeded: % emails sent in last hour', 
            hourly_count;
    END IF;
    
    RETURN true;
END;
$$;

-- =============================================
-- STEP 9: Grant Permissions
-- =============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON smtp_configurations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_smtp_permissions TO authenticated;
GRANT SELECT ON smtp_operation_logs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION store_smtp_password(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_smtp_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_smtp_password(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_smtp_credentials(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_smtp_tools(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_agent_smtp_permissions(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_smtp_rate_limit(UUID, UUID, UUID) TO authenticated;

-- Grant service role permissions for logging
GRANT EXECUTE ON FUNCTION log_smtp_operation(UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, INTEGER, INTEGER, INET, TEXT) TO service_role;

-- =============================================
-- Migration Complete
-- =============================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'SMTP integration migration completed successfully';
    RAISE NOTICE 'Created tables: smtp_configurations, agent_smtp_permissions, smtp_operation_logs';
    RAISE NOTICE 'Created functions: store_smtp_password, get_smtp_password, update_smtp_password, revoke_smtp_credentials';
    RAISE NOTICE 'Created functions: get_smtp_tools, validate_agent_smtp_permissions, log_smtp_operation, check_smtp_rate_limit';
    RAISE NOTICE 'Enabled RLS policies and created indexes for performance';
END $$;
