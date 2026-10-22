-- Safe Integrations Migration - ONLY ADDS new tables, no modifications to existing
-- Purpose: Support the Integrations page functionality with categorized integrations

-- Create enum for integration status
DO $$ BEGIN
    CREATE TYPE integration_status_enum AS ENUM ('available', 'beta', 'coming_soon', 'deprecated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for integration connection status  
DO $$ BEGIN
    CREATE TYPE integration_connection_status_enum AS ENUM ('connected', 'disconnected', 'error', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create integration categories table
CREATE TABLE IF NOT EXISTS integration_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_name TEXT NOT NULL, -- Lucide icon name
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create integrations table (without foreign key references to potentially missing tables)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES integration_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT, -- Lucide icon name, can be different from category
    status integration_status_enum DEFAULT 'available',
    is_popular BOOLEAN DEFAULT FALSE,
    documentation_url TEXT,
    configuration_schema JSONB DEFAULT '{}', -- JSON schema for configuration
    required_oauth_provider_id UUID, -- No foreign key constraint for safety
    required_tool_catalog_id UUID, -- No foreign key constraint for safety
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user integrations table to track user connections
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Reference to auth.users but no constraint for safety
    integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    connection_name TEXT, -- User-defined name for this connection
    connection_status integration_connection_status_enum DEFAULT 'pending',
    configuration JSONB DEFAULT '{}', -- User-specific configuration
    oauth_connection_id UUID, -- No foreign key constraint for safety
    tool_instance_id UUID, -- No foreign key constraint for safety
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, integration_id, connection_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integrations_category_id ON integrations(category_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_popular ON integrations(is_popular);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_integration_id ON user_integrations(integration_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(connection_status);

-- Create updated_at triggers (only if function doesn't exist)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS set_integration_categories_updated_at ON integration_categories;
CREATE TRIGGER set_integration_categories_updated_at
    BEFORE UPDATE ON integration_categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_integrations_updated_at ON integrations;
CREATE TRIGGER set_integrations_updated_at
    BEFORE UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_user_integrations_updated_at ON user_integrations;
CREATE TRIGGER set_user_integrations_updated_at
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Insert default integration categories
INSERT INTO integration_categories (name, description, icon_name, display_order) VALUES
    ('API Integrations', 'Connect to external APIs and services', 'Globe', 1),
    ('Database Connectors', 'Connect to various database systems', 'Database', 2),
    ('Authentication', 'Secure authentication and authorization', 'Shield', 3),
    ('Messaging & Communication', 'Communication and messaging platforms', 'MessageSquare', 4),
    ('Cloud Services', 'Cloud platforms and services', 'Cloud', 5),
    ('Automation & Workflows', 'Workflow automation and triggers', 'Zap', 6)
ON CONFLICT (name) DO NOTHING;

-- Insert default integrations
INSERT INTO integrations (category_id, name, description, icon_name, status, is_popular, display_order) VALUES
    -- API Integrations
    ((SELECT id FROM integration_categories WHERE name = 'API Integrations'), 'REST API', 'Connect to RESTful web services', 'Globe', 'available', true, 1),
    ((SELECT id FROM integration_categories WHERE name = 'API Integrations'), 'GraphQL', 'Query APIs with GraphQL', 'Globe', 'available', true, 2),
    ((SELECT id FROM integration_categories WHERE name = 'API Integrations'), 'Webhooks', 'Receive real-time notifications', 'Globe', 'available', false, 3),
    
    -- Database Connectors
    ((SELECT id FROM integration_categories WHERE name = 'Database Connectors'), 'PostgreSQL', 'Connect to PostgreSQL databases', 'Database', 'available', true, 1),
    ((SELECT id FROM integration_categories WHERE name = 'Database Connectors'), 'MongoDB', 'Connect to MongoDB collections', 'Database', 'available', true, 2),
    ((SELECT id FROM integration_categories WHERE name = 'Database Connectors'), 'MySQL', 'Connect to MySQL databases', 'Database', 'available', false, 3),
    
    -- Authentication
    ((SELECT id FROM integration_categories WHERE name = 'Authentication'), 'OAuth 2.0', 'OAuth 2.0 authentication flow', 'Shield', 'available', true, 1),
    ((SELECT id FROM integration_categories WHERE name = 'Authentication'), 'JWT Tokens', 'JSON Web Token authentication', 'Shield', 'available', true, 2),
    ((SELECT id FROM integration_categories WHERE name = 'Authentication'), 'SAML', 'SAML single sign-on', 'Shield', 'coming_soon', false, 3),
    
    -- Messaging & Communication
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'), 'Slack', 'Send messages to Slack channels', 'MessageSquare', 'available', true, 1),
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'), 'Discord', 'Interact with Discord servers', 'MessageSquare', 'available', true, 2),
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'), 'Email', 'Send automated emails', 'MessageSquare', 'available', false, 3),
    
    -- Cloud Services
    ((SELECT id FROM integration_categories WHERE name = 'Cloud Services'), 'AWS', 'Amazon Web Services integration', 'Cloud', 'available', true, 1),
    ((SELECT id FROM integration_categories WHERE name = 'Cloud Services'), 'Azure', 'Microsoft Azure services', 'Cloud', 'available', false, 2),
    ((SELECT id FROM integration_categories WHERE name = 'Cloud Services'), 'Google Cloud', 'Google Cloud Platform services', 'Cloud', 'coming_soon', false, 3),
    
    -- Automation & Workflows
    ((SELECT id FROM integration_categories WHERE name = 'Automation & Workflows'), 'Zapier', 'Connect with Zapier workflows', 'Zap', 'available', true, 1),
    ((SELECT id FROM integration_categories WHERE name = 'Automation & Workflows'), 'GitHub Actions', 'Trigger GitHub workflow actions', 'Zap', 'available', true, 2),
    ((SELECT id FROM integration_categories WHERE name = 'Automation & Workflows'), 'Scheduled Tasks', 'Schedule automated tasks', 'Zap', 'available', false, 3)
ON CONFLICT DO NOTHING;

-- Create RLS policies

-- Integration categories are readable by all authenticated users
ALTER TABLE integration_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Integration categories are readable by authenticated users" ON integration_categories;
CREATE POLICY "Integration categories are readable by authenticated users"
    ON integration_categories FOR SELECT
    TO authenticated
    USING (true);

-- Integrations are readable by all authenticated users
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Integrations are readable by authenticated users" ON integrations;
CREATE POLICY "Integrations are readable by authenticated users"
    ON integrations FOR SELECT
    TO authenticated
    USING (true);

-- Users can only access their own integration connections
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own integration connections" ON user_integrations;
CREATE POLICY "Users can only access their own integration connections"
    ON user_integrations FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- Create functions for the integrations page

-- Function to get integration categories with integration counts
CREATE OR REPLACE FUNCTION get_integration_categories_with_counts(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    icon_name TEXT,
    display_order INTEGER,
    total_integrations BIGINT,
    available_integrations BIGINT,
    user_connected_integrations BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ic.id,
        ic.name,
        ic.description,
        ic.icon_name,
        ic.display_order,
        COUNT(i.id) as total_integrations,
        COUNT(CASE WHEN i.status = 'available' THEN 1 END) as available_integrations,
        COALESCE(COUNT(CASE WHEN ui.connection_status = 'connected' THEN 1 END), 0) as user_connected_integrations
    FROM integration_categories ic
    LEFT JOIN integrations i ON ic.id = i.category_id AND i.is_active = true
    LEFT JOIN user_integrations ui ON i.id = ui.integration_id 
        AND ui.user_id = COALESCE(p_user_id, auth.uid())
        AND ui.connection_status = 'connected'
    WHERE ic.is_active = true
    GROUP BY ic.id, ic.name, ic.description, ic.icon_name, ic.display_order
    ORDER BY ic.display_order, ic.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get integrations by category
CREATE OR REPLACE FUNCTION get_integrations_by_category(p_category_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    icon_name TEXT,
    status integration_status_enum,
    is_popular BOOLEAN,
    documentation_url TEXT,
    display_order INTEGER,
    user_connection_status integration_connection_status_enum,
    user_connection_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.description,
        i.icon_name,
        i.status,
        i.is_popular,
        i.documentation_url,
        i.display_order,
        COALESCE(MAX(ui.connection_status), NULL::integration_connection_status_enum) as user_connection_status,
        COUNT(ui.id) as user_connection_count
    FROM integrations i
    LEFT JOIN user_integrations ui ON i.id = ui.integration_id 
        AND ui.user_id = COALESCE(p_user_id, auth.uid())
    WHERE i.category_id = p_category_id AND i.is_active = true
    GROUP BY i.id, i.name, i.description, i.icon_name, i.status, i.is_popular, i.documentation_url, i.display_order
    ORDER BY i.display_order, i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user integration statistics
CREATE OR REPLACE FUNCTION get_user_integration_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_available_integrations BIGINT,
    total_connected_integrations BIGINT,
    total_categories BIGINT,
    recent_connections BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM integrations WHERE status = 'available' AND is_active = true) as total_available_integrations,
        (SELECT COUNT(*) FROM user_integrations WHERE user_id = COALESCE(p_user_id, auth.uid()) AND connection_status = 'connected') as total_connected_integrations,
        (SELECT COUNT(*) FROM integration_categories WHERE is_active = true) as total_categories,
        (SELECT COUNT(*) FROM user_integrations WHERE user_id = COALESCE(p_user_id, auth.uid()) AND connection_status = 'connected' AND created_at > NOW() - INTERVAL '30 days') as recent_connections;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_integration_categories_with_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_integrations_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_integration_stats TO authenticated; 