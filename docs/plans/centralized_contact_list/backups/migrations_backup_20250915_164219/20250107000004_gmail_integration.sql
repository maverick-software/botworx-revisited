-- Gmail Integration Database Schema Migration
-- Date: January 7, 2025
-- Purpose: Add Gmail OAuth provider and agent-specific credential management

-- Add Gmail OAuth provider to existing service_providers table
DO $$
BEGIN
    -- Check if Gmail provider already exists
    IF NOT EXISTS (SELECT 1 FROM service_providers WHERE name = 'gmail') THEN
        INSERT INTO service_providers (
            name, 
            display_name, 
            authorization_endpoint, 
            token_endpoint, 
            scopes_supported,
            configuration_metadata, 
            is_enabled
        ) VALUES (
            'gmail',
            'Gmail',
            'https://accounts.google.com/o/oauth2/v2/auth',
            'https://oauth2.googleapis.com/token',
            '[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.send",
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.labels",
                "https://www.googleapis.com/auth/gmail.metadata"
            ]'::jsonb,
            '{
                "supports_pkce": true,
                "requires_client_secret": true,
                "flow_type": "authorization_code",
                "token_endpoint_auth_method": "client_secret_post"
            }'::jsonb,
            true
        );
    END IF;
END $$;

-- Create Gmail-specific configuration table
CREATE TABLE IF NOT EXISTS gmail_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_oauth_connection_id UUID NOT NULL REFERENCES user_oauth_connections(id) ON DELETE CASCADE,
    email_signature TEXT,
    max_emails_per_request INTEGER DEFAULT 50 CHECK (max_emails_per_request > 0 AND max_emails_per_request <= 500),
    default_send_as TEXT,
    auto_archive_sent BOOLEAN DEFAULT FALSE,
    security_settings JSONB DEFAULT '{
        "require_confirmation_for_send": true,
        "allow_delete_operations": false,
        "restrict_to_specific_labels": []
    }'::jsonb,
    rate_limit_settings JSONB DEFAULT '{
        "max_requests_per_minute": 100,
        "batch_size": 10
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_oauth_connection_id)
);

-- Create agent OAuth permissions table for granular access control
CREATE TABLE IF NOT EXISTS agent_oauth_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL, -- References agents table
    user_oauth_connection_id UUID NOT NULL REFERENCES user_oauth_connections(id) ON DELETE CASCADE,
    granted_scopes JSONB DEFAULT '[]'::jsonb NOT NULL,
    is_active BOOLEAN DEFAULT true,
    granted_by UUID NOT NULL, -- References auth.users(id)
    granted_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID, -- References auth.users(id)
    usage_limits JSONB DEFAULT '{
        "max_emails_per_day": 100,
        "max_api_calls_per_hour": 500
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agent_id, user_oauth_connection_id)
);

-- Create Gmail operation audit log table
CREATE TABLE IF NOT EXISTS gmail_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    user_oauth_connection_id UUID NOT NULL REFERENCES user_oauth_connections(id),
    operation_type TEXT NOT NULL, -- 'send_email', 'read_emails', 'search_emails', etc.
    operation_params JSONB,
    operation_result JSONB,
    status TEXT NOT NULL DEFAULT 'success', -- 'success', 'error', 'unauthorized'
    error_message TEXT,
    quota_consumed INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for gmail_operation_logs
CREATE INDEX IF NOT EXISTS idx_gmail_operation_logs_agent_id_created_at ON gmail_operation_logs(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gmail_operation_logs_user_id_created_at ON gmail_operation_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gmail_operation_logs_operation_type_created_at ON gmail_operation_logs(operation_type, created_at);

-- Add Gmail integration to integrations_renamed table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM integrations_renamed WHERE name = 'Gmail') THEN
        INSERT INTO integrations_renamed (
            category_id, 
            name, 
            description, 
            status, 
            is_popular,
            configuration_schema, 
            required_oauth_provider_id
        ) VALUES (
            (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
            'Gmail',
            'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
            'available',
            true,
            '{
                "tools": {
                    "send_email": {
                        "description": "Send emails with attachments",
                        "required_scopes": ["gmail.send"],
                        "parameters": {
                            "to": {"type": "string", "required": true},
                            "subject": {"type": "string", "required": true},
                            "body": {"type": "string", "required": true},
                            "attachments": {"type": "array", "required": false}
                        }
                    },
                    "read_emails": {
                        "description": "Read and list emails from inbox",
                        "required_scopes": ["gmail.readonly"],
                        "parameters": {
                            "query": {"type": "string", "required": false},
                            "max_results": {"type": "integer", "default": 50}
                        }
                    },
                    "search_emails": {
                        "description": "Search emails with advanced filters",
                        "required_scopes": ["gmail.readonly"],
                        "parameters": {
                            "query": {"type": "string", "required": true},
                            "labels": {"type": "array", "required": false}
                        }
                    },
                    "manage_labels": {
                        "description": "Create, modify, and delete email labels",
                        "required_scopes": ["gmail.labels"],
                        "parameters": {
                            "action": {"type": "string", "enum": ["create", "modify", "delete"]},
                            "label_name": {"type": "string", "required": true}
                        }
                    }
                },
                "default_settings": {
                    "max_emails_per_request": 50,
                    "include_attachments": false,
                    "auto_mark_as_read": false
                }
            }'::jsonb,
            (SELECT id FROM service_providers WHERE name = 'gmail')
        );
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_configurations_user_oauth_connection ON gmail_configurations(user_oauth_connection_id);
CREATE INDEX IF NOT EXISTS idx_agent_oauth_permissions_agent_id ON agent_oauth_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_oauth_permissions_user_oauth_connection ON agent_oauth_permissions(user_oauth_connection_id);
CREATE INDEX IF NOT EXISTS idx_gmail_operation_logs_agent_user ON gmail_operation_logs(agent_id, user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_operation_logs_created_at ON gmail_operation_logs(created_at);

-- Create RLS policies for security
ALTER TABLE gmail_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_oauth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_operation_logs ENABLE ROW LEVEL SECURITY;

-- Gmail configurations policy - users can only access their own
CREATE POLICY "Users can manage their own Gmail configurations" ON gmail_configurations
    FOR ALL USING (
        user_oauth_connection_id IN (
            SELECT id FROM user_oauth_connections 
            WHERE user_id = auth.uid()
        )
    );

-- Agent OAuth permissions policy - users can only manage their own agent permissions
CREATE POLICY "Users can manage their own agent OAuth permissions" ON agent_oauth_permissions
    FOR ALL USING (
        user_oauth_connection_id IN (
            SELECT id FROM user_oauth_connections 
            WHERE user_id = auth.uid()
        )
    );

-- Gmail operation logs policy - users can only view their own logs
CREATE POLICY "Users can view their own Gmail operation logs" ON gmail_operation_logs
    FOR SELECT USING (user_id = auth.uid());

-- Service role policy for Gmail operations
CREATE POLICY "Service role can manage Gmail operations" ON gmail_operation_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Update timestamp trigger for gmail_configurations
CREATE OR REPLACE FUNCTION update_gmail_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gmail_configurations_updated_at
    BEFORE UPDATE ON gmail_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_gmail_configurations_updated_at();

-- Update timestamp trigger for agent_oauth_permissions
CREATE OR REPLACE FUNCTION update_agent_oauth_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_oauth_permissions_updated_at
    BEFORE UPDATE ON agent_oauth_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_oauth_permissions_updated_at();

-- Database functions for Gmail integration

-- Function to get Gmail connection for user
CREATE OR REPLACE FUNCTION get_user_gmail_connection(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    vault_access_token_id UUID,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uoc.id,
        uoc.external_username,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.vault_access_token_id,
        COALESCE(gc.security_settings, '{}'::jsonb) as configuration
    FROM user_oauth_connections uoc
    LEFT JOIN gmail_configurations gc ON gc.user_oauth_connection_id = uoc.id
    WHERE uoc.user_id = p_user_id 
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND uoc.connection_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate agent Gmail permissions
CREATE OR REPLACE FUNCTION validate_agent_gmail_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_required_scopes TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_granted_scopes JSONB;
    v_scope TEXT;
BEGIN
    -- Get granted scopes for agent
    SELECT aop.granted_scopes INTO v_granted_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND aop.is_active = true
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
    
    -- Check if agent has permissions
    IF v_granted_scopes IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Validate each required scope
    FOREACH v_scope IN ARRAY p_required_scopes
    LOOP
        IF NOT (v_granted_scopes ? v_scope) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log Gmail operations
CREATE OR REPLACE FUNCTION log_gmail_operation(
    p_agent_id UUID,
    p_user_id UUID,
    p_operation_type TEXT,
    p_operation_params JSONB DEFAULT NULL,
    p_operation_result JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'success',
    p_error_message TEXT DEFAULT NULL,
    p_quota_consumed INTEGER DEFAULT 0,
    p_execution_time_ms INTEGER DEFAULT 0
) RETURNS UUID AS $$
DECLARE
    v_connection_id UUID;
    v_log_id UUID;
BEGIN
    -- Get user's Gmail connection
    SELECT uoc.id INTO v_connection_id
    FROM user_oauth_connections uoc
    WHERE uoc.user_id = p_user_id
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
    
    -- Insert operation log
    INSERT INTO gmail_operation_logs (
        agent_id,
        user_id,
        user_oauth_connection_id,
        operation_type,
        operation_params,
        operation_result,
        status,
        error_message,
        quota_consumed,
        execution_time_ms
    ) VALUES (
        p_agent_id,
        p_user_id,
        v_connection_id,
        p_operation_type,
        p_operation_params,
        p_operation_result,
        p_status,
        p_error_message,
        p_quota_consumed,
        p_execution_time_ms
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON gmail_configurations TO anon, authenticated;
GRANT SELECT ON agent_oauth_permissions TO anon, authenticated;
GRANT SELECT ON gmail_operation_logs TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_gmail_connection(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_agent_gmail_permissions(UUID, UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION log_gmail_operation(UUID, UUID, TEXT, JSONB, JSONB, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated; 