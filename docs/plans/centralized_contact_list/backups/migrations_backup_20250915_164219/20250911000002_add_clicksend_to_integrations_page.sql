-- Add ClickSend SMS/MMS to Integrations Page
-- Purpose: Make ClickSend appear on the integrations page for user setup
-- Date: September 11, 2025

BEGIN;

-- Step 1: Ensure we have the Messaging & Communication category
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES ('Messaging & Communication', 'SMS, MMS, and messaging platforms for agent communication', 'MessageSquare', 4, true)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Step 2: Add ClickSend SMS integration to the integrations table
DO $$
DECLARE
    messaging_category_id UUID;
    clicksend_provider_id UUID;
BEGIN
    -- Get the category ID for Messaging & Communication
    SELECT id INTO messaging_category_id 
    FROM integration_categories 
    WHERE name = 'Messaging & Communication';

    -- Get the ClickSend service provider ID
    SELECT id INTO clicksend_provider_id 
    FROM service_providers 
    WHERE name = 'clicksend_sms';

    -- Add ClickSend SMS integration
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
        display_order,
        is_active,
        agent_classification
    ) VALUES (
        messaging_category_id,
        'ClickSend SMS',
        'Professional SMS and MMS messaging service. Send text messages and multimedia content to mobile phones worldwide with delivery tracking and analytics.',
        'MessageSquare',
        'available',
        true,
        'https://developers.clicksend.com/',
        '{
            "type": "object",
            "properties": {
                "username": {
                    "type": "string",
                    "title": "ClickSend Username",
                    "description": "Your ClickSend account username"
                },
                "api_key": {
                    "type": "string",
                    "title": "API Key",
                    "description": "Your ClickSend API key from the dashboard",
                    "format": "password"
                },
                "connection_name": {
                    "type": "string",
                    "title": "Connection Name",
                    "description": "A friendly name for this connection (optional)",
                    "default": "ClickSend SMS/MMS"
                },
                "default_sender_id": {
                    "type": "string",
                    "title": "Default Sender ID",
                    "description": "Default sender ID or phone number (optional)"
                }
            },
            "required": ["username", "api_key"]
        }'::jsonb,
        clicksend_provider_id,
        1,
        true,
        'channel'
    ) ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        documentation_url = EXCLUDED.documentation_url,
        configuration_schema = EXCLUDED.configuration_schema,
        required_oauth_provider_id = EXCLUDED.required_oauth_provider_id,
        is_popular = EXCLUDED.is_popular,
        agent_classification = EXCLUDED.agent_classification,
        updated_at = NOW();

    RAISE NOTICE '✅ ClickSend SMS integration added to integrations page successfully!';
    
END $$;

-- Step 3: Verify the integration was added
DO $$
DECLARE
    integration_count INTEGER;
    category_count INTEGER;
BEGIN
    -- Check if ClickSend integration was added
    SELECT COUNT(*) INTO integration_count
    FROM integrations i
    JOIN integration_categories ic ON i.category_id = ic.id
    WHERE i.name = 'ClickSend SMS' AND ic.name = 'Messaging & Communication';
    
    -- Check if category exists
    SELECT COUNT(*) INTO category_count
    FROM integration_categories
    WHERE name = 'Messaging & Communication';
    
    IF integration_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: ClickSend SMS integration not found in integrations table';
    END IF;
    
    IF category_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: Messaging & Communication category not found';
    END IF;
    
    RAISE NOTICE '📱 ClickSend SMS integration verification completed successfully!';
    RAISE NOTICE '🏷️  Category: Messaging & Communication';
    RAISE NOTICE '🔗 Integration: ClickSend SMS';
    RAISE NOTICE '📋 Status: Available for user setup';
    
END $$;

COMMIT;
