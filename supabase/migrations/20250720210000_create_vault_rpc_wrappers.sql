-- Migration: 20250720210000_create_vault_rpc_wrappers.sql
-- Purpose: Create wrapper functions in the public schema to call vault functions,
-- making them accessible via RPC from the Supabase JS client.

-- Drop the functions if they exist to ensure a clean slate
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_vault_secret(UUID, TEXT);

-- Wrapper for vault.create_secret
CREATE FUNCTION public.create_vault_secret(
    p_secret TEXT,
    p_name TEXT,
    p_description TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN vault.create_secret(secret := p_secret, name := p_name, description := p_description);
END;
$$;

-- Wrapper for vault.update_secret
CREATE FUNCTION public.update_vault_secret(
    p_secret_id UUID,
    p_new_secret TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM vault.update_secret(id := p_secret_id, secret := p_new_secret);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) IS 'A public RPC wrapper for vault.create_secret.';
COMMENT ON FUNCTION public.update_vault_secret(UUID, TEXT) IS 'A public RPC wrapper for vault.update_secret.'; 