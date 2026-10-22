-- Add missing OAuth providers and integrations for Discord and DigitalOcean
-- Purpose: Enable Discord and DigitalOcean integrations to appear in UI modals and pages

-- 1. Add Discord OAuth Provider (missing but integration exists)
INSERT INTO service_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    scopes_supported,
    pkce_required,
    is_enabled,
    configuration_metadata,
    created_at,
    updated_at
)
VALUES (
    'discord',
    'Discord',
    'https://discord.com/api/oauth2/authorize',
    'https://discord.com/api/oauth2/token',
    '["bot", "identify", "guilds", "messages.read", "messages.write", "applications.commands"]'::jsonb,
    true,
    true,
    '{"icon_url": "https://discord.com/assets/f9bb9c4af2b9c32a2c5ee0014661546d.png"}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    authorization_endpoint = EXCLUDED.authorization_endpoint,
    token_endpoint = EXCLUDED.token_endpoint,
    scopes_supported = EXCLUDED.scopes_supported,
    is_enabled = EXCLUDED.is_enabled,
    configuration_metadata = EXCLUDED.configuration_metadata,
    updated_at = NOW();

-- 2. Add DigitalOcean OAuth Provider (missing - actually API key provider)
INSERT INTO service_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    scopes_supported,
    pkce_required,
    is_enabled,
    configuration_metadata,
    created_at,
    updated_at
)
VALUES (
    'digitalocean',
    'DigitalOcean',
    'https://cloud.digitalocean.com/v1/oauth/authorize', -- Placeholder for API key provider
    'https://cloud.digitalocean.com/v1/oauth/token', -- Placeholder for API key provider
    '["droplet:read", "droplet:create", "droplet:delete", "image:read", "region:read", "size:read"]'::jsonb,
    false, -- No PKCE for API key providers
    true,
    '{"icon_url": "https://www.digitalocean.com/favicon.ico", "provider_type": "api_key", "description": "API key based authentication for DigitalOcean"}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    scopes_supported = EXCLUDED.scopes_supported,
    is_enabled = EXCLUDED.is_enabled,
    configuration_metadata = EXCLUDED.configuration_metadata,
    updated_at = NOW();

-- 3. Add DigitalOcean Integration (missing - get Cloud Services category ID)
DO $$
DECLARE
    cloud_category_id UUID;
    digitalocean_oauth_id UUID;
BEGIN
    -- Get Cloud Services category ID
    SELECT id INTO cloud_category_id
    FROM integration_categories
    WHERE name = 'Cloud Services'
    LIMIT 1;

    -- Get DigitalOcean OAuth provider ID
    SELECT id INTO digitalocean_oauth_id
    FROM service_providers
    WHERE name = 'digitalocean'
    LIMIT 1;

    -- Insert DigitalOcean integration if category exists
    IF cloud_category_id IS NOT NULL AND digitalocean_oauth_id IS NOT NULL THEN
        INSERT INTO integrations (
            category_id,
            name,
            description,
            icon_name,
            status,
            agent_classification,
            is_popular,
            documentation_url,
            required_oauth_provider_id,
            display_order,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            cloud_category_id,
            'DigitalOcean',
            'Create and manage DigitalOcean droplets, images, and infrastructure',
            'Server',
            'available',
            'tool',
            false,
            'https://docs.digitalocean.com/reference/api/',
            digitalocean_oauth_id,
            100, -- Display at end
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (name) DO UPDATE SET
            description = EXCLUDED.description,
            icon_name = EXCLUDED.icon_name,
            status = EXCLUDED.status,
            agent_classification = EXCLUDED.agent_classification,
            documentation_url = EXCLUDED.documentation_url,
            required_oauth_provider_id = EXCLUDED.required_oauth_provider_id,
            display_order = EXCLUDED.display_order,
            is_active = EXCLUDED.is_active,
            updated_at = NOW();
    ELSE
        RAISE NOTICE 'Could not find Cloud Services category or DigitalOcean OAuth provider';
    END IF;
END $$;

-- 4. Update Discord integration to reference the OAuth provider
DO $$
DECLARE
    discord_oauth_id UUID;
BEGIN
    -- Get Discord OAuth provider ID
    SELECT id INTO discord_oauth_id
    FROM service_providers
    WHERE name = 'discord'
    LIMIT 1;

    -- Update Discord integration to reference OAuth provider
    IF discord_oauth_id IS NOT NULL THEN
        UPDATE integrations
        SET 
            required_oauth_provider_id = discord_oauth_id,
            updated_at = NOW()
        WHERE name = 'Discord'
        AND required_oauth_provider_id IS NULL;
    END IF;
END $$;

-- 5. Add integration capabilities for DigitalOcean (tools/scopes it supports)
DO $$
DECLARE
    digitalocean_integration_id UUID;
BEGIN
    -- Get DigitalOcean integration ID
    SELECT id INTO digitalocean_integration_id
    FROM integrations
    WHERE name = 'DigitalOcean'
    LIMIT 1;

    -- Add capabilities if integration exists and table exists
    IF digitalocean_integration_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'integration_capabilities' 
        AND table_schema = 'public'
    ) THEN
        -- Insert capabilities for DigitalOcean tools
        INSERT INTO integration_capabilities (
            integration_id,
            capability_key,
            display_label,
            display_order
        )
        VALUES 
            (digitalocean_integration_id, 'droplet:read', 'Read Droplets', 1),
            (digitalocean_integration_id, 'droplet:create', 'Create Droplets', 2),
            (digitalocean_integration_id, 'droplet:delete', 'Delete Droplets', 3),
            (digitalocean_integration_id, 'image:read', 'Read Images', 4),
            (digitalocean_integration_id, 'region:read', 'Read Regions', 5),
            (digitalocean_integration_id, 'size:read', 'Read Sizes', 6)
        ON CONFLICT (integration_id, capability_key) DO UPDATE SET
            display_label = EXCLUDED.display_label,
            display_order = EXCLUDED.display_order;
    END IF;
END $$;

-- 6. Add integration capabilities for Discord if missing
DO $$
DECLARE
    discord_integration_id UUID;
BEGIN
    -- Get Discord integration ID
    SELECT id INTO discord_integration_id
    FROM integrations
    WHERE name = 'Discord'
    LIMIT 1;

    -- Add capabilities if integration exists and table exists
    IF discord_integration_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'integration_capabilities' 
        AND table_schema = 'public'
    ) THEN
        -- Insert capabilities for Discord
        INSERT INTO integration_capabilities (
            integration_id,
            capability_key,
            display_label,
            display_order
        )
        VALUES 
            (discord_integration_id, 'bot', 'Bot Access', 1),
            (discord_integration_id, 'identify', 'User Identity', 2),
            (discord_integration_id, 'guilds', 'Server Access', 3),
            (discord_integration_id, 'messages.read', 'Read Messages', 4),
            (discord_integration_id, 'messages.write', 'Send Messages', 5),
            (discord_integration_id, 'applications.commands', 'Slash Commands', 6)
        ON CONFLICT (integration_id, capability_key) DO UPDATE SET
            display_label = EXCLUDED.display_label,
            display_order = EXCLUDED.display_order;
    END IF;
END $$;
