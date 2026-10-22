-- Migration: 20250720200000_create_vault_read_function.sql
-- Purpose: Create a wrapper function to securely read secrets from the Vault via RPC,
-- which is necessary because the JS client cannot directly query the vault schema.

CREATE OR REPLACE FUNCTION public.get_vault_secrets_by_names(
    p_secret_names TEXT[]
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    decrypted_secret TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
    SELECT
        s.id,
        s.name,
        ds.decrypted_secret
    FROM vault.secrets s
    JOIN vault.decrypted_secrets ds ON s.id = ds.id
    WHERE s.name = ANY(p_secret_names);
$$;

GRANT EXECUTE ON FUNCTION public.get_vault_secrets_by_names(TEXT[]) TO service_role;

COMMENT ON FUNCTION public.get_vault_secrets_by_names(TEXT[]) IS 'Retrieves decrypted secrets from the Vault by their unique names.'; 