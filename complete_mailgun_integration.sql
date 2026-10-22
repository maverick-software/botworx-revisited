-- Complete Mailgun Integration Setup
-- Run this in Supabase SQL Editor to add Mailgun integration properly

-- ============================================
-- 1. ADD MAILGUN TO INTEGRATIONS CATALOG
-- ============================================

-- First, get the Messaging & Communication category ID and Mailgun OAuth provider ID
WITH category_and_provider AS (
  SELECT 
    ic.id as category_id,
    op.id as provider_id
  FROM integration_categories ic
  CROSS JOIN oauth_providers op
  WHERE ic.name = 'Messaging & Communication'
  AND op.name = 'mailgun'
)
-- Insert Mailgun integration with ALL required fields
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    is_popular,
    documentation_url,
    configuration_schema,
    required_oauth_provider_id,
    required_tool_catalog_id,
    display_order,
    is_active,
    agent_classification,
    created_at,
    updated_at
)
SELECT 
    cap.category_id,
    'Mailgun',
    'High-deliverability email sending with advanced validation, analytics, and inbound routing capabilities. Perfect for transactional emails and bulk campaigns.',
    'Mail',
    'available'::integration_status_enum,
    true,
    'https://documentation.mailgun.com/en/latest/api_reference.html',
    '{
        "type": "object",
        "properties": {
            "domain": {
                "type": "string",
                "title": "Mailgun Domain",
                "description": "Your verified Mailgun sending domain (e.g., mail.yourdomain.com)",
                "placeholder": "mail.yourdomain.com"
            },
            "api_key": {
                "type": "string",
                "title": "Mailgun API Key",
                "description": "Your Mailgun API key (starts with key-)",
                "format": "password",
                "placeholder": "key-xxxxxxxxxxxxxxxxxxxxxx"
            },
            "region": {
                "type": "string",
                "title": "Region",
                "description": "Mailgun region where your domain is hosted",
                "enum": ["us", "eu"],
                "enumNames": ["United States", "Europe"],
                "default": "us"
            }
        },
        "required": ["domain", "api_key"]
    }'::jsonb,
    cap.provider_id,
    NULL, -- No specific tool catalog requirement
    2, -- Display order
    true,
    'tool'::integration_agent_classification_enum,
    NOW(),
    NOW()
FROM category_and_provider cap
WHERE NOT EXISTS (
    SELECT 1 FROM integrations WHERE name = 'Mailgun'
);

-- ============================================
-- 2. CREATE AGENT MAILGUN PERMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS agent_mailgun_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mailgun_config_id UUID NOT NULL REFERENCES mailgun_configurations(id) ON DELETE CASCADE,
    can_send_email BOOLEAN DEFAULT true,
    can_validate_email BOOLEAN DEFAULT true,
    can_view_stats BOOLEAN DEFAULT false,
    can_manage_suppressions BOOLEAN DEFAULT false,
    can_receive_emails BOOLEAN DEFAULT false,
    can_manage_routes BOOLEAN DEFAULT false,
    daily_send_limit INTEGER DEFAULT 100,
    recipients_per_email_limit INTEGER DEFAULT 10,
    granted_by UUID NOT NULL REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_agent_mailgun_permission UNIQUE(agent_id, mailgun_config_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_mailgun_permissions_agent ON agent_mailgun_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_mailgun_permissions_config ON agent_mailgun_permissions(mailgun_config_id);
CREATE INDEX IF NOT EXISTS idx_agent_mailgun_permissions_active ON agent_mailgun_permissions(is_active);

-- Enable RLS
ALTER TABLE agent_mailgun_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view mailgun permissions for their agents" ON agent_mailgun_permissions;
CREATE POLICY "Users can view mailgun permissions for their agents"
    ON agent_mailgun_permissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = agent_mailgun_permissions.agent_id
            AND agents.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage mailgun permissions for their agents" ON agent_mailgun_permissions;
CREATE POLICY "Users can manage mailgun permissions for their agents"
    ON agent_mailgun_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = agent_mailgun_permissions.agent_id
            AND agents.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = agent_mailgun_permissions.agent_id
            AND agents.user_id = auth.uid()
        )
    );

-- ============================================
-- 3. CREATE MAILGUN OPERATION LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS mailgun_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mailgun_config_id UUID NOT NULL REFERENCES mailgun_configurations(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    operation_params JSONB,
    operation_result JSONB,
    status TEXT DEFAULT 'success' NOT NULL CHECK (status IN ('success', 'error', 'pending')),
    error_message TEXT,
    mailgun_message_id TEXT,
    recipients_count INTEGER DEFAULT 1,
    execution_time_ms INTEGER,
    api_calls_made INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mailgun_operation_logs_agent ON mailgun_operation_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_mailgun_operation_logs_user ON mailgun_operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mailgun_operation_logs_config ON mailgun_operation_logs(mailgun_config_id);
CREATE INDEX IF NOT EXISTS idx_mailgun_operation_logs_created ON mailgun_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailgun_operation_logs_status ON mailgun_operation_logs(status);

-- Enable RLS
ALTER TABLE mailgun_operation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their mailgun operation logs" ON mailgun_operation_logs;
CREATE POLICY "Users can view their mailgun operation logs"
    ON mailgun_operation_logs FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert mailgun operation logs" ON mailgun_operation_logs;
CREATE POLICY "Service role can insert mailgun operation logs"
    ON mailgun_operation_logs FOR INSERT
    WITH CHECK (true);

-- ============================================
-- 4. GRANT PERMISSIONS
-- ============================================

-- Grant permissions on new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_mailgun_permissions TO authenticated;
GRANT SELECT ON mailgun_operation_logs TO authenticated;
GRANT INSERT ON mailgun_operation_logs TO service_role;

-- ============================================
-- 5. VERIFY INTEGRATION WAS ADDED
-- ============================================

-- Check that Mailgun integration was added successfully
SELECT 
    i.name,
    i.description,
    i.status,
    i.is_popular,
    i.agent_classification,
    ic.name as category_name,
    op.name as oauth_provider_name
FROM integrations i
JOIN integration_categories ic ON i.category_id = ic.id
LEFT JOIN oauth_providers op ON i.required_oauth_provider_id = op.id
WHERE i.name = 'Mailgun';

-- List all integrations in Messaging & Communication category
SELECT 
    i.name,
    i.status,
    i.is_popular,
    i.display_order
FROM integrations i
JOIN integration_categories ic ON i.category_id = ic.id
WHERE ic.name = 'Messaging & Communication'
ORDER BY i.display_order, i.name;
