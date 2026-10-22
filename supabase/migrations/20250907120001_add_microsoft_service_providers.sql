-- =====================================================
-- MICROSOFT SERVICE PROVIDERS MIGRATION
-- =====================================================
-- Add Microsoft Teams, Outlook, and OneDrive service providers
-- Date: September 7, 2025
-- Purpose: Enable Microsoft Graph API integrations for Agentopia agents

BEGIN;

-- Step 1: Validate no conflicts exist
DO $$
BEGIN
    -- Check for existing Microsoft providers
    IF EXISTS (SELECT 1 FROM service_providers WHERE name LIKE 'microsoft-%') THEN
        RAISE EXCEPTION 'Microsoft service providers already exist. Review existing entries first.';
    END IF;
    
    RAISE NOTICE 'Pre-flight check passed: No existing Microsoft service providers found';
END $$;

-- Step 2: Insert Microsoft Teams service provider
INSERT INTO service_providers (
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
    configuration_metadata
) VALUES (
    'microsoft-teams',
    'Microsoft Teams',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    '[
        "https://graph.microsoft.com/Team.ReadBasic.All",
        "https://graph.microsoft.com/TeamMember.Read.All",
        "https://graph.microsoft.com/Channel.ReadBasic.All", 
        "https://graph.microsoft.com/ChannelMessage.Read.All",
        "https://graph.microsoft.com/ChannelMessage.Send",
        "https://graph.microsoft.com/Chat.Read",
        "https://graph.microsoft.com/Chat.ReadWrite",
        "https://graph.microsoft.com/OnlineMeetings.ReadWrite",
        "https://graph.microsoft.com/User.Read"
    ]',
    true,
    'header',
    true,
    '{
        "api_base_url": "https://graph.microsoft.com/v1.0",
        "tenant": "common",
        "resource": "https://graph.microsoft.com",
        "client_id_env": "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "redirect_uri": "/integrations/microsoft-teams/callback",
        "service_type": "teams",
        "description": "Microsoft Teams integration for messaging, meetings, and collaboration"
    }'
);

-- Step 3: Insert Microsoft Outlook service provider
INSERT INTO service_providers (
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
    configuration_metadata
) VALUES (
    'microsoft-outlook',
    'Microsoft Outlook',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    '[
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",
        "https://graph.microsoft.com/Calendars.Read",
        "https://graph.microsoft.com/Calendars.ReadWrite",
        "https://graph.microsoft.com/Contacts.Read",
        "https://graph.microsoft.com/Contacts.ReadWrite",
        "https://graph.microsoft.com/User.Read"
    ]',
    true,
    'header',
    true,
    '{
        "api_base_url": "https://graph.microsoft.com/v1.0",
        "tenant": "common",
        "resource": "https://graph.microsoft.com",
        "client_id_env": "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "redirect_uri": "/integrations/microsoft-outlook/callback",
        "service_type": "outlook",
        "description": "Microsoft Outlook integration for email, calendar, and contacts"
    }'
);

-- Step 4: Insert Microsoft OneDrive service provider
INSERT INTO service_providers (
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
    configuration_metadata
) VALUES (
    'microsoft-onedrive',
    'Microsoft OneDrive',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    '[
        "https://graph.microsoft.com/Files.Read",
        "https://graph.microsoft.com/Files.ReadWrite",
        "https://graph.microsoft.com/Files.Read.All",
        "https://graph.microsoft.com/Files.ReadWrite.All",
        "https://graph.microsoft.com/Sites.Read.All",
        "https://graph.microsoft.com/Sites.ReadWrite.All",
        "https://graph.microsoft.com/User.Read"
    ]',
    true,
    'header',
    true,
    '{
        "api_base_url": "https://graph.microsoft.com/v1.0",
        "tenant": "common",
        "resource": "https://graph.microsoft.com",
        "client_id_env": "MICROSOFT_CLIENT_ID",
        "client_secret_env": "MICROSOFT_CLIENT_SECRET",
        "redirect_uri": "/integrations/microsoft-onedrive/callback",
        "service_type": "onedrive",
        "description": "Microsoft OneDrive integration for file storage and sharing"
    }'
);

-- Step 5: Verify insertions
DO $$
DECLARE
    v_count INTEGER;
    v_teams_id UUID;
    v_outlook_id UUID;
    v_onedrive_id UUID;
BEGIN
    -- Count inserted providers
    SELECT COUNT(*) INTO v_count 
    FROM service_providers 
    WHERE name IN ('microsoft-teams', 'microsoft-outlook', 'microsoft-onedrive');
    
    IF v_count != 3 THEN
        RAISE EXCEPTION 'Failed to insert all Microsoft service providers. Expected 3, got %', v_count;
    END IF;
    
    -- Get IDs for logging
    SELECT id INTO v_teams_id FROM service_providers WHERE name = 'microsoft-teams';
    SELECT id INTO v_outlook_id FROM service_providers WHERE name = 'microsoft-outlook';
    SELECT id INTO v_onedrive_id FROM service_providers WHERE name = 'microsoft-onedrive';
    
    RAISE NOTICE 'Successfully inserted % Microsoft service providers:', v_count;
    RAISE NOTICE '  - Microsoft Teams (ID: %)', v_teams_id;
    RAISE NOTICE '  - Microsoft Outlook (ID: %)', v_outlook_id;
    RAISE NOTICE '  - Microsoft OneDrive (ID: %)', v_onedrive_id;
END $$;

-- Step 6: Add helpful comments
COMMENT ON TABLE service_providers IS 'OAuth and API service providers including Microsoft Graph API services for Teams, Outlook, and OneDrive';

-- Add specific comments for Microsoft providers
DO $$
DECLARE
    v_teams_id UUID;
    v_outlook_id UUID;
    v_onedrive_id UUID;
BEGIN
    SELECT id INTO v_teams_id FROM service_providers WHERE name = 'microsoft-teams';
    SELECT id INTO v_outlook_id FROM service_providers WHERE name = 'microsoft-outlook';
    SELECT id INTO v_onedrive_id FROM service_providers WHERE name = 'microsoft-onedrive';
    
    -- Note: PostgreSQL doesn't support comments on specific rows, but we can log the information
    RAISE NOTICE 'Microsoft Teams provider configured for messaging, meetings, and collaboration';
    RAISE NOTICE 'Microsoft Outlook provider configured for email, calendar, and contacts';
    RAISE NOTICE 'Microsoft OneDrive provider configured for file storage and sharing';
END $$;

COMMIT;

-- Post-migration validation
-- This will run after the transaction commits
DO $$
DECLARE
    v_provider RECORD;
BEGIN
    RAISE NOTICE 'Post-migration validation:';
    
    FOR v_provider IN 
        SELECT name, display_name, is_enabled, 
               jsonb_array_length(scopes_supported) as scope_count,
               configuration_metadata->>'service_type' as service_type
        FROM service_providers 
        WHERE name LIKE 'microsoft-%'
        ORDER BY name
    LOOP
        RAISE NOTICE '  ✓ % (%) - % scopes, type: %, enabled: %', 
            v_provider.display_name, 
            v_provider.name, 
            v_provider.scope_count,
            v_provider.service_type,
            v_provider.is_enabled;
    END LOOP;
    
    RAISE NOTICE 'Microsoft service providers migration completed successfully!';
END $$;
