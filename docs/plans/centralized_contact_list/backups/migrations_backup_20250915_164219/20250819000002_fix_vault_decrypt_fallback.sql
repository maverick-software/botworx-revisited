-- Fix vault_decrypt to handle GetZep API keys better
-- This handles the case where the API key might be stored in connection_metadata

CREATE OR REPLACE FUNCTION public.vault_decrypt(vault_id TEXT)
RETURNS TEXT AS $$
DECLARE
    decrypted_value TEXT;
    uuid_id UUID;
    api_key_value TEXT;
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

    -- Try vault decryption first
    IF uuid_id IS NOT NULL THEN
        BEGIN
            SELECT decrypted_secret INTO decrypted_value
            FROM vault.decrypted_secrets
            WHERE id = uuid_id
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            decrypted_value := NULL;
        END;
    END IF;

    -- If not found by ID, try by name
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

    -- FALLBACK: If vault decryption failed and we have a UUID,
    -- check if this is a GetZep connection with API key in metadata
    IF decrypted_value IS NULL AND uuid_id IS NOT NULL THEN
        -- Look for a connection using this vault_id
        SELECT connection_metadata->>'api_key' INTO api_key_value
        FROM user_oauth_connections
        WHERE vault_access_token_id = vault_id
        AND oauth_provider_id IN (
            SELECT id FROM service_providers WHERE name = 'getzep'
        )
        LIMIT 1;
        
        IF api_key_value IS NOT NULL AND api_key_value LIKE 'z_%' THEN
            decrypted_value := api_key_value;
        END IF;
    END IF;

    -- FALLBACK: If still nothing and it's not a UUID, 
    -- check if it's a plain text API key
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

COMMENT ON FUNCTION public.vault_decrypt(TEXT) IS 'Decrypts vault secrets with fallback for GetZep API keys stored in metadata';
