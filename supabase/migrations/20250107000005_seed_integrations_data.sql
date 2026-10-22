-- Migration: Seed integrations data
-- Purpose: Populate integration_categories and integrations tables with default data

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
INSERT INTO integrations_renamed (category_id, name, description, icon_name, status, is_popular, display_order) VALUES
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
ON CONFLICT (name) DO NOTHING;

-- Add Gmail integration specifically
INSERT INTO integrations_renamed (
    category_id, 
    name, 
    description, 
    icon_name,
    status, 
    is_popular,
    documentation_url,
    configuration_schema,
    display_order
) VALUES (
    (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
    'Gmail',
    'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
    'MessageSquare',
    'available',
    true,
    'https://developers.google.com/gmail/api',
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
    0
) ON CONFLICT (name) DO NOTHING; 