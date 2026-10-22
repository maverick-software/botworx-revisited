-- Add ClickSend SMS/MMS service provider
-- Insert ClickSend into service_providers table with proper configuration
-- Date: September 13, 2025

BEGIN;

-- Insert ClickSend SMS service provider
INSERT INTO service_providers (
    id,
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    revoke_endpoint,
    discovery_endpoint,
    scopes_supported,
    pkce_required,
    client_credentials_location,
    is_enabled,
    configuration_metadata,
    created_at,
    updated_at
) VALUES (
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_sms',
    'ClickSend SMS',
    'https://rest.clicksend.com/v3/oauth/authorize', -- Placeholder - ClickSend uses API keys
    'https://rest.clicksend.com/v3/oauth/token',     -- Placeholder - ClickSend uses API keys
    null,
    null,
    '["sms", "mms", "balance", "history", "delivery_receipts"]'::jsonb,
    false, -- API key based, no PKCE
    'header',
    true,
    '{
        "authentication_type": "basic_auth",
        "api_base_url": "https://rest.clicksend.com/v3",
        "auth_header_format": "Basic {base64(username:api_key)}",
        "supported_message_types": ["sms", "mms"],
        "features": {
            "sms_sending": true,
            "mms_sending": true,
            "delivery_receipts": true,
            "inbound_messages": true,
            "balance_checking": true,
            "message_history": true,
            "scheduled_messages": true,
            "message_tracking": true
        },
        "limits": {
            "sms_max_length": 1600,
            "mms_max_size_mb": 5,
            "rate_limit_per_hour": 1000,
            "concurrent_requests": 10
        },
        "supported_countries": ["US", "CA", "AU", "UK", "EU"],
        "pricing_model": "per_message",
        "documentation_url": "https://developers.clicksend.com/",
        "setup_instructions": {
            "step_1": "Sign up for ClickSend account at https://clicksend.com",
            "step_2": "Navigate to API Credentials in your dashboard",
            "step_3": "Copy your Username and API Key",
            "step_4": "Enter credentials in Agentopia integration setup"
        },
        "integration_description": "Professional SMS and MMS messaging service. Send text messages and multimedia content to mobile phones worldwide with delivery tracking and analytics.",
        "icon_name": "MessageSquare",
        "is_popular": true,
        "configuration_schema": {
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
        },
        "display_order": 1,
        "agent_classification": "channel",
        "category_id": "2119b96b-7f2a-427e-ad8f-65226bdd4e57"
    }'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    configuration_metadata = EXCLUDED.configuration_metadata,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Add integration capabilities for ClickSend SMS/MMS
INSERT INTO integration_capabilities (
    integration_id,
    service_provider_id,
    capability_key,
    display_label,
    display_order,
    created_at,
    updated_at
) VALUES
-- SMS Capabilities
(
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_send_sms',
    'Send SMS',
    1,
    NOW(),
    NOW()
),
(
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_send_mms',
    'Send MMS',
    2,
    NOW(),
    NOW()
),
-- Account Management Capabilities
(
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_get_balance',
    'Check Account Balance',
    3,
    NOW(),
    NOW()
),
-- History and Tracking Capabilities
(
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_get_sms_history',
    'Get SMS History',
    4,
    NOW(),
    NOW()
),
(
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_get_mms_history',
    'Get MMS History',
    5,
    NOW(),
    NOW()
),
(
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'a1b2c3d4-5e6f-7890-abcd-ef1234567890',
    'clicksend_get_delivery_receipts',
    'Get Delivery Receipts',
    6,
    NOW(),
    NOW()
);

-- Create permission validation function for ClickSend
CREATE OR REPLACE FUNCTION validate_agent_clicksend_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_required_scopes TEXT[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_connection_exists BOOLEAN := FALSE;
    v_has_permissions BOOLEAN := FALSE;
    v_provider_id UUID;
BEGIN
    -- Get ClickSend service provider ID
    SELECT id INTO v_provider_id
    FROM service_providers 
    WHERE name = 'clicksend_sms';
    
    IF v_provider_id IS NULL THEN
        RAISE EXCEPTION 'ClickSend service provider not found';
    END IF;
    
    -- Check if user has an active ClickSend connection
    SELECT EXISTS(
        SELECT 1 
        FROM user_integration_credentials uic
        WHERE uic.user_id = p_user_id 
          AND uic.oauth_provider_id = v_provider_id
          AND uic.connection_status = 'active'
    ) INTO v_connection_exists;
    
    IF NOT v_connection_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Check if agent has permissions for this integration
    SELECT EXISTS(
        SELECT 1
        FROM agent_integration_permissions aip
        JOIN user_integration_credentials uic ON uic.id = aip.user_oauth_connection_id
        WHERE aip.agent_id = p_agent_id
          AND uic.user_id = p_user_id
          AND uic.oauth_provider_id = v_provider_id
          AND aip.is_active = true
          AND (
            -- If no specific scopes required, just check if permission exists
            p_required_scopes IS NULL 
            OR array_length(p_required_scopes, 1) = 0
            -- If scopes required, check if all required scopes are in allowed_scopes
            OR (
                aip.allowed_scopes IS NOT NULL 
                AND p_required_scopes <@ (
                    SELECT ARRAY(
                        SELECT jsonb_array_elements_text(aip.allowed_scopes)
                    )
                )
            )
          )
    ) INTO v_has_permissions;
    
    RETURN v_has_permissions;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_agent_clicksend_permissions(UUID, UUID, TEXT[]) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION validate_agent_clicksend_permissions(UUID, UUID, TEXT[]) IS 
'Validates that an agent has permission to access ClickSend SMS/MMS integration for a specific user with required scopes';

-- Create helper function to get user ClickSend connection
CREATE OR REPLACE FUNCTION get_user_clicksend_connection(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    connection_status TEXT,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uic.id as connection_id,
        uic.connection_name,
        uic.external_username,
        uic.connection_status,
        uic.connection_metadata as configuration
    FROM user_integration_credentials uic
    INNER JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = p_user_id
      AND sp.name = 'clicksend_sms'
      AND uic.connection_status = 'active'
    ORDER BY uic.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_clicksend_connection(UUID) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_clicksend_connection(UUID) IS 'Get user ClickSend connection details';

-- Verify the migration
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
    
    RAISE NOTICE '✅ ClickSend service provider added successfully!';
    RAISE NOTICE '📱 ClickSend service providers: %', clicksend_provider_count;
    RAISE NOTICE '🔗 ClickSend integrations: %', clicksend_integration_count;
    RAISE NOTICE '🛠️  ClickSend capabilities: %', clicksend_capability_count;
    RAISE NOTICE '📂 Messaging category ID: %', messaging_category_id;
    RAISE NOTICE '🔒 Validation functions: created';
    
    IF clicksend_provider_count = 0 THEN
        RAISE WARNING '⚠️  ClickSend service provider not found or not enabled';
    END IF;
    
    IF clicksend_integration_count = 0 THEN
        RAISE WARNING '⚠️  ClickSend not appearing in integrations view';
    END IF;
    
    IF clicksend_capability_count < 6 THEN
        RAISE WARNING '⚠️  Expected 6 ClickSend capabilities, found %', clicksend_capability_count;
    END IF;
END $$;

COMMIT;
