-- Migration: 20250720190000_cleanup_failed_vault_implementation.sql
-- Purpose: Drop all custom tables and functions related to the failed Vault implementation.

-- Drop the functions first in reverse order of dependency
DROP FUNCTION IF EXISTS public.test_decrypt_latest_token();
DROP FUNCTION IF EXISTS public.cleanup_expired_oauth_tokens();
DROP FUNCTION IF EXISTS public.update_oauth_token(UUID, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.update_oauth_token(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.revoke_oauth_token(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_oauth_token(UUID, TEXT);
DROP FUNCTION IF EXISTS public.store_oauth_token(UUID, TEXT, TEXT, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.store_oauth_token(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB);

-- Drop the metadata table
DROP TABLE IF EXISTS public.user_oauth_tokens;

COMMENT ON SCHEMA public IS 'Cleaned up all database objects from the failed custom Vault implementation.'; 