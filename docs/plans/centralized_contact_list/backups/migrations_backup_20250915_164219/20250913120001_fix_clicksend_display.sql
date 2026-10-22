-- Fix ClickSend display in integrations view
-- Ensure ClickSend service provider has correct display_name and metadata
-- Date: September 13, 2025

BEGIN;

-- Update ClickSend service provider with correct display name and metadata
UPDATE service_providers 
SET 
    display_name = 'ClickSend SMS',
    configuration_metadata = COALESCE(configuration_metadata, '{}'::jsonb) || jsonb_build_object(
        'integration_description', 'Professional SMS and MMS messaging service. Send text messages and multimedia content to mobile phones worldwide with delivery tracking and analytics.',
        'icon_name', 'MessageSquare',
        'is_popular', true,
        'documentation_url', 'https://developers.clicksend.com/',
        'configuration_schema', '{
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
        'display_order', 1,
        'agent_classification', 'channel',
        'category_id', (SELECT id FROM integration_categories WHERE name = 'Messaging & Communication' LIMIT 1)::text
    ),
    is_enabled = true,
    updated_at = NOW()
WHERE name = 'clicksend_sms';

-- Ensure Messaging & Communication category exists
INSERT INTO integration_categories (name, description, icon_name, display_order, is_active)
VALUES ('Messaging & Communication', 'SMS, MMS, and messaging platforms for agent communication', 'MessageSquare', 4, true)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    icon_name = EXCLUDED.icon_name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Verify the fix
DO $$
DECLARE
    clicksend_provider_count INTEGER;
    clicksend_integration_count INTEGER;
    clicksend_capability_count INTEGER;
    messaging_category_id UUID;
BEGIN
    -- Check ClickSend service provider
    SELECT COUNT(*) INTO clicksend_provider_count 
    FROM service_providers 
    WHERE name = 'clicksend_sms' AND is_enabled = true;
    
    -- Check ClickSend in integrations view
    SELECT COUNT(*) INTO clicksend_integration_count 
    FROM integrations 
    WHERE name ILIKE '%clicksend%';
    
    -- Check ClickSend capabilities
    SELECT COUNT(*) INTO clicksend_capability_count
    FROM integration_capabilities ic
    JOIN service_providers sp ON ic.service_provider_id = sp.id
    WHERE sp.name = 'clicksend_sms';
    
    -- Get messaging category ID
    SELECT id INTO messaging_category_id
    FROM integration_categories 
    WHERE name = 'Messaging & Communication';
    
    RAISE NOTICE '✅ ClickSend verification completed!';
    RAISE NOTICE '📱 ClickSend service providers: %', clicksend_provider_count;
    RAISE NOTICE '🔗 ClickSend integrations: %', clicksend_integration_count;
    RAISE NOTICE '🛠️  ClickSend capabilities: %', clicksend_capability_count;
    RAISE NOTICE '📂 Messaging category ID: %', messaging_category_id;
    
    IF clicksend_provider_count = 0 THEN
        RAISE WARNING '⚠️  ClickSend service provider not found or not enabled';
    END IF;
    
    IF clicksend_integration_count = 0 THEN
        RAISE WARNING '⚠️  ClickSend not appearing in integrations view';
    END IF;
    
    IF clicksend_capability_count = 0 THEN
        RAISE WARNING '⚠️  ClickSend capabilities not properly linked';
    END IF;
END $$;

COMMIT;
