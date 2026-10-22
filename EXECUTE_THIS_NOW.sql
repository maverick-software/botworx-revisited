-- EXECUTE THIS IN SUPABASE SQL EDITOR TO FIX MAILGUN
-- The migration system is fucked, so we're applying the fix directly

-- 1. Add Mailgun OAuth Provider (if it doesn't exist)
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

-- 2. Verify it was added
SELECT 'Mailgun OAuth Provider Added/Updated:' as status, name, display_name, is_enabled 
FROM oauth_providers WHERE name = 'mailgun';
