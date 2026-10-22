-- IMMEDIATE FIX FOR MAILGUN INTEGRATION
-- Run this in Supabase SQL Editor to fix the missing OAuth provider

-- Add Mailgun OAuth Provider
INSERT INTO oauth_providers (
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
    'https://api.mailgun.net/v3',
    'https://api.mailgun.net/v3',
    false,
    false,
    false,
    true,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Verify the provider was added
SELECT name, display_name, is_enabled FROM oauth_providers WHERE name = 'mailgun';
