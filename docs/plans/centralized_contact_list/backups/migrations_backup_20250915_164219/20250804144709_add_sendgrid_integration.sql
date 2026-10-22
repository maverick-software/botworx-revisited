-- Add SendGrid Integration to integrations table
-- Date: August 4, 2025
-- Purpose: Make SendGrid appear in the integrations UI

-- Ensure Messaging & Communication category exists
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES ('Messaging & Communication', 'Communication and messaging platforms', 'MessageSquare', 4, true)
ON CONFLICT (name) DO NOTHING;

-- Add SendGrid integration to the integrations table
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    is_popular,
    documentation_url,
    configuration_schema,
    display_order,
    is_active
) VALUES (
    (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication'),
    'SendGrid',
    'Send and receive emails via SendGrid API with agent inboxes and smart routing',
    'Mail',
    'available',
    true,
    'https://docs.sendgrid.com/',
    '{
        "type": "object",
        "properties": {
            "api_key": {
                "type": "string",
                "title": "SendGrid API Key",
                "description": "Your SendGrid API key with mail.send permissions",
                "format": "password"
            },
            "from_email": {
                "type": "string",
                "title": "Default From Email",
                "description": "Default email address for sending emails",
                "format": "email"
            },
            "from_name": {
                "type": "string",
                "title": "Default From Name",
                "description": "Default name for sending emails"
            },
            "reply_to_email": {
                "type": "string",
                "title": "Reply-To Email",
                "description": "Default reply-to email address",
                "format": "email"
            },
            "inbound_domain": {
                "type": "string",
                "title": "Inbound Domain",
                "description": "Domain for receiving emails (e.g., inbox.yourdomain.com)"
            },
            "enable_tracking": {
                "type": "object",
                "title": "Email Tracking",
                "description": "Configure email tracking options",
                "properties": {
                    "opens": {
                        "type": "boolean",
                        "title": "Track Opens",
                        "default": true
                    },
                    "clicks": {
                        "type": "boolean", 
                        "title": "Track Clicks",
                        "default": true
                    },
                    "unsubscribes": {
                        "type": "boolean",
                        "title": "Track Unsubscribes", 
                        "default": true
                    }
                }
            },
            "max_emails_per_day": {
                "type": "number",
                "title": "Daily Email Limit",
                "description": "Maximum emails per day",
                "default": 1000,
                "minimum": 1
            },
            "max_recipients_per_email": {
                "type": "number",
                "title": "Recipients Per Email Limit",
                "description": "Maximum recipients per email",
                "default": 100,
                "minimum": 1
            }
        },
        "required": ["api_key", "from_email"]
    }'::jsonb,
    2,
    true
) ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    status = EXCLUDED.status,
    is_popular = EXCLUDED.is_popular,
    documentation_url = EXCLUDED.documentation_url,
    configuration_schema = EXCLUDED.configuration_schema,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Update the SendGrid OAuth provider to link with the integration
UPDATE service_providers 
SET configuration_metadata = jsonb_set(
    COALESCE(configuration_metadata, '{}'::jsonb),
    '{integration_id}',
    (SELECT to_jsonb(id) FROM integrations WHERE name = 'SendGrid')::jsonb
)
WHERE name = 'sendgrid';

-- Add comment for documentation
COMMENT ON TABLE integrations IS 'Available integrations that can be configured by users, displayed in the integrations UI';
