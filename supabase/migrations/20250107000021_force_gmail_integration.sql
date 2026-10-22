-- Force Gmail integration into database
-- This migration ensures Gmail exists in the integrations table

-- Create integration_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS integration_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create integrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES integration_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_name TEXT,
    status TEXT DEFAULT 'available',
    agent_classification TEXT DEFAULT 'tool',
    is_popular BOOLEAN DEFAULT FALSE,
    documentation_url TEXT,
    configuration_schema JSONB DEFAULT '{}',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to name column if it doesn't exist
DO $$ BEGIN
    ALTER TABLE integrations ADD CONSTRAINT integrations_name_unique UNIQUE (name);
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Insert Messaging & Communication category
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES ('Messaging & Communication', 'Communication and messaging platforms', 'MessageSquare', 4, true)
ON CONFLICT (name) DO NOTHING;

-- Insert Gmail integration
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    agent_classification,
    is_popular,
    documentation_url,
    display_order,
    is_active,
    configuration_schema
)
VALUES (
    (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
    'Gmail',
    'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
    'MessageSquare',
    'available',
    'channel',
    true,
    'https://developers.google.com/gmail/api',
    1,
    true,
    '{"send_email": {"description": "Send emails on behalf of the user", "required_scopes": ["gmail.send"], "permission_level": "write"}, "read_emails": {"description": "Read user emails", "required_scopes": ["gmail.readonly"], "permission_level": "read"}}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
    agent_classification = 'channel',
    is_active = true,
    configuration_schema = EXCLUDED.configuration_schema;

-- Add other essential integrations for tools
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    agent_classification,
    is_popular,
    display_order,
    is_active
)
VALUES
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'), 'REST API', 'Connect to RESTful web services', 'Globe', 'available', 'tool', true, 1, true),
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'), 'GraphQL', 'Query APIs with GraphQL', 'Globe', 'available', 'tool', true, 2, true),
    ((SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'), 'PostgreSQL', 'Connect to PostgreSQL databases', 'Database', 'available', 'tool', true, 3, true)
ON CONFLICT (name) DO UPDATE SET
    agent_classification = EXCLUDED.agent_classification,
    is_active = true; 