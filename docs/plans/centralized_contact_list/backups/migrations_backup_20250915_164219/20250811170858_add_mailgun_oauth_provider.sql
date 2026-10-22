-- Add Mailgun OAuth Provider
-- This creates the service_providers entry needed for Mailgun integration

INSERT INTO service_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    client_id_required,
    client_secret_required,
    scope_required,
    is_enabled,
    created_at,
    updated_at
)
VALUES (
    'mailgun',
    'Mailgun',
    'https://api.mailgun.net/v3', -- Using API endpoint as placeholder
    'https://api.mailgun.net/v3', -- Using API endpoint as placeholder
    false, -- Mailgun uses API keys, not OAuth client credentials
    false, -- Mailgun uses API keys, not OAuth client credentials
    false, -- Mailgun doesn't use OAuth scopes
    true,  -- Enable the provider
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();
