-- Simple script to add Mailgun to integrations catalog
-- Run this in Supabase SQL Editor

-- First, get the Messaging & Communication category ID
WITH messaging_category AS (
  SELECT id FROM integration_categories WHERE name = 'Messaging & Communication' LIMIT 1
)
-- Insert Mailgun integration
INSERT INTO integrations (
    category_id,
    name,
    description,
    icon_name,
    status,
    is_popular,
    documentation_url,
    configuration_schema,
    created_at,
    updated_at
)
SELECT 
    mc.id,
    'Mailgun',
    'High-deliverability email sending with advanced validation, analytics, and inbound routing capabilities',
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
                "description": "Your verified Mailgun sending domain"
            },
            "api_key": {
                "type": "string",
                "title": "API Key",
                "description": "Your Mailgun API key (starts with key-)",
                "format": "password"
            },
            "region": {
                "type": "string",
                "title": "Region",
                "description": "Mailgun region",
                "enum": ["us", "eu"],
                "default": "us"
            }
        },
        "required": ["domain", "api_key"]
    }'::jsonb,
    NOW(),
    NOW()
FROM messaging_category mc
WHERE NOT EXISTS (
    SELECT 1 FROM integrations WHERE name = 'Mailgun'
);

-- Verify insertion
SELECT 
    i.name,
    i.description,
    i.status,
    ic.name as category_name
FROM integrations i
JOIN integration_categories ic ON i.category_id = ic.id
WHERE i.name = 'Mailgun';
