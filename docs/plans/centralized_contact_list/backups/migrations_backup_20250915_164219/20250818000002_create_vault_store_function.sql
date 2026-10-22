-- Create vault_store_secret function to allow storing secrets in vault
-- This function allows service role to create new vault secrets

BEGIN;

-- Create the vault_store_secret function
CREATE OR REPLACE FUNCTION public.vault_store_secret(
    secret_name TEXT,
    secret_value TEXT,
    secret_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    secret_id UUID;
BEGIN
    -- Only allow service role to store vault secrets
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Insufficient privileges to store vault secrets';
    END IF;

    -- Insert the secret into vault
    INSERT INTO vault.secrets (name, secret, description)
    VALUES (secret_name, secret_value, secret_description)
    RETURNING id INTO secret_id;

    RETURN secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role only
REVOKE ALL ON FUNCTION public.vault_store_secret(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_store_secret(TEXT, TEXT, TEXT) TO service_role;

-- Add comment
COMMENT ON FUNCTION public.vault_store_secret(TEXT, TEXT, TEXT) IS 'Stores secrets in vault - requires service role';

COMMIT;
