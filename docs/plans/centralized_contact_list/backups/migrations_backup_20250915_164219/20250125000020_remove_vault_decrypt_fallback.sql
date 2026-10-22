-- Remove fallback mechanism from vault_decrypt function
-- This migration creates a pure vault decryption function that only works with properly encrypted secrets
-- Based on Supabase Vault documentation: https://supabase.com/docs/guides/database/vault

BEGIN;

-- Drop existing function with fallback
DROP FUNCTION IF EXISTS public.vault_decrypt(TEXT);

-- Create the pure vault_decrypt function (no fallback mechanisms)
CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
BEGIN
    -- Only allow service role to decrypt vault secrets
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to decrypt vault secrets';
    END IF;

    -- Try to convert to UUID if it looks like one
    BEGIN
        uuid_id := vault_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        uuid_id := NULL;
    END;

    -- Case 1: It's a UUID - try vault decryption by ID
    IF uuid_id IS NOT NULL THEN
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE id = uuid_id
        LIMIT 1;
        
        RETURN decrypted_value;
    END IF;

    -- Case 2: Not a UUID - try vault decryption by name
    SELECT decrypted_secret INTO decrypted_value
    FROM vault.decrypted_secrets
    WHERE name = vault_id
    LIMIT 1;

    RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
REVOKE ALL ON FUNCTION public.vault_decrypt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(TEXT) TO service_role;

-- Add descriptive comment
COMMENT ON FUNCTION public.vault_decrypt(TEXT) IS 'Decrypts vault secrets using Supabase Vault - pure vault mode (no fallback mechanisms)';

COMMIT;
