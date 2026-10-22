-- EXECUTE THIS IN SUPABASE SQL EDITOR TO FIX MIGRATION ISSUES
-- This will clean up the migration history and add Mailgun

-- Step 1: Remove the problematic 20250125 migration from history
DELETE FROM supabase_migrations.schema_migrations 
WHERE version = '20250125';

-- Step 2: Add Mailgun OAuth Provider (if it doesn't exist)
INSERT INTO oauth_providers (
    name,
    display_name,
    authorization_endpoint,
    token_endpoint,
    scopes_supported,
    pkce_required,
    client_credentials_location,
    is_enabled,
    created_at,
    updated_at
)
VALUES (
    'mailgun',
    'Mailgun',
    'https://api.mailgun.net/v3',
    'https://api.mailgun.net/v3',
    '[]'::jsonb,
    false, -- Mailgun uses API keys, not OAuth PKCE
    'header',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

-- Step 3: Verify the fix
SELECT 'Migration History Fixed' as status;
SELECT COUNT(*) as removed_migrations FROM supabase_migrations.schema_migrations WHERE version = '20250125';
SELECT 'Mailgun Provider Added' as status, * FROM oauth_providers WHERE name = 'mailgun';
