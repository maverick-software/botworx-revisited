-- Improve vault_decrypt to handle all API key patterns better
-- This allows storing API keys as plain text in the encrypted_access_token field
-- and the vault_decrypt function will return them as-is if they're not UUIDs

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

    -- Try vault decryption first (if it's a UUID)
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

    -- If vault decryption failed or didn't find anything, 
    -- and the input doesn't look like a UUID, 
    -- assume it's a plain text API key and return it as-is
    IF decrypted_value IS NULL AND uuid_id IS NULL THEN
        -- Return the value as-is (it's likely a plain text API key)
        decrypted_value := vault_id;
    END IF;
    
    -- If it IS a UUID but vault decryption failed,
    -- still try to return it as plain text (might be an API key that looks like UUID)
    IF decrypted_value IS NULL AND uuid_id IS NOT NULL THEN
        -- Log this case for debugging
        RAISE NOTICE 'Vault decryption failed for UUID %, returning as plain text', vault_id;
        decrypted_value := vault_id;
    END IF;

    RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
REVOKE ALL ON FUNCTION public.vault_decrypt(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_decrypt(TEXT) TO service_role;

COMMENT ON FUNCTION public.vault_decrypt(TEXT) IS 'Decrypts vault secrets with comprehensive fallback to plain text for all API key patterns';
