-- Initialize vault encryption system properly
-- This migration ensures the vault system is properly configured

BEGIN;

-- Ensure pgsodium extension is enabled
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Check if a root key exists, if not create one
DO $$
DECLARE
    key_count INTEGER;
    new_key_id UUID;
BEGIN
    -- Check if any keys exist
    SELECT COUNT(*) INTO key_count FROM pgsodium.valid_key;
    
    IF key_count = 0 THEN
        -- No keys exist, create a root key
        SELECT pgsodium.create_key(name := 'vault_root_key') INTO new_key_id;
        RAISE NOTICE 'Created vault root key: %', new_key_id;
    ELSE
        RAISE NOTICE 'Vault keys already exist: % keys found', key_count;
    END IF;
    
    -- Check if vault_root_key exists
    BEGIN
        -- Try to get the vault_root_key
        SELECT id INTO new_key_id FROM pgsodium.valid_key WHERE name = 'vault_root_key' LIMIT 1;
        IF new_key_id IS NOT NULL THEN
            RAISE NOTICE 'Found vault_root_key: %', new_key_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not check for vault_root_key';
    END;
END $$;

-- Create or replace the vault_decrypt function to handle key issues better
CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
    key_id UUID;
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

    -- Note: Vault keys are managed by Supabase infrastructure
    -- We don't need to explicitly specify a key for vault operations

    IF uuid_id IS NOT NULL THEN
        -- Get the decrypted secret from vault using ID
        BEGIN
            SELECT decrypted_secret INTO decrypted_value
            FROM vault.decrypted_secrets
            WHERE id = uuid_id
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            -- If decryption fails, return NULL instead of erroring
            decrypted_value := NULL;
        END;
    END IF;

    -- If not found by ID or not a UUID, try by name
    IF decrypted_value IS NULL THEN
        BEGIN
            SELECT decrypted_secret INTO decrypted_value
            FROM vault.decrypted_secrets
            WHERE name = vault_id
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            decrypted_value := NULL;
        END;
    END IF;

    -- If still not found, check if it's a plain text API key (temporary workaround)
    -- This allows us to store API keys directly while vault is being fixed
    IF decrypted_value IS NULL AND uuid_id IS NULL THEN
        -- Check if it looks like an API key (starts with known prefixes)
        IF vault_id LIKE 'z_%' OR vault_id LIKE 'sk_%' OR vault_id LIKE 'pk_%' THEN
            decrypted_value := vault_id;
        END IF;
    END IF;

    RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
REVOKE ALL ON FUNCTION public.vault_decrypt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.vault_decrypt(TEXT) IS 'Decrypts vault secrets with fallback for direct API keys';

COMMIT;
