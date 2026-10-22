-- Fix vault_decrypt to properly handle UUID vault IDs that fail to decrypt
-- If it's a UUID and vault decryption fails, return NULL instead of the UUID itself

CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
    looks_like_api_key BOOLEAN;
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

    -- Check if it looks like an API key (common patterns)
    looks_like_api_key := vault_id ~ '^(sk_|pk_|key_|api_|z_|serper_|brave_|serpapi_)' OR
                         length(vault_id) > 20 AND vault_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- Case 1: It's a UUID - MUST be a vault ID
    IF uuid_id IS NOT NULL THEN
        BEGIN
            -- Try to decrypt from vault
            SELECT decrypted_secret INTO decrypted_value
            FROM vault.decrypted_secrets
            WHERE id = uuid_id
            LIMIT 1;
            
            -- If we found something in vault, return it
            IF decrypted_value IS NOT NULL THEN
                RETURN decrypted_value;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Vault decryption failed
            decrypted_value := NULL;
        END;
        
        -- UUID that's not in vault - DON'T return the UUID itself
        -- It's likely a vault ID that failed to decrypt
        RETURN NULL;
    END IF;

    -- Case 2: Not a UUID but looks like an API key - return as-is
    IF looks_like_api_key THEN
        RETURN vault_id;
    END IF;

    -- Case 3: Not a UUID and doesn't look like an API key
    -- Could be a vault secret name, try to look it up
    BEGIN
        SELECT decrypted_secret INTO decrypted_value
        FROM vault.decrypted_secrets
        WHERE name = vault_id
        LIMIT 1;
        
        IF decrypted_value IS NOT NULL THEN
            RETURN decrypted_value;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        decrypted_value := NULL;
    END;

    -- Last resort: if it's not a UUID and we couldn't find it in vault,
    -- but it has some length, return it as-is (might be a plain API key)
    IF length(vault_id) > 10 THEN
        RETURN vault_id;
    END IF;

    -- Nothing worked, return NULL
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
REVOKE ALL ON FUNCTION public.vault_decrypt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(TEXT) TO service_role;

COMMENT ON FUNCTION public.vault_decrypt(TEXT) IS 'Decrypts vault secrets with proper UUID handling - returns NULL for failed vault IDs';
