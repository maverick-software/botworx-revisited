-- Migration: 20250720220000_fix_vault_wrapper_syntax.sql
-- Purpose: Correct the SQL syntax inside the vault wrapper functions to use positional arguments,
-- which will resolve the "function does not exist" error with named parameters.

-- Drop the functions if they exist to ensure a clean slate
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_vault_secret(UUID, TEXT);

-- Wrapper for vault.create_secret using positional arguments
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
    -- Use positional arguments as shown in Supabase documentation
    RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;

-- Wrapper for vault.update_secret using positional arguments
CREATE FUNCTION public.update_vault_secret(
    p_secret_id UUID,
    p_new_secret TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Use positional arguments
    PERFORM vault.update_secret(p_secret_id, p_new_secret);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) IS 'A public RPC wrapper for vault.create_secret.';
COMMENT ON FUNCTION public.update_vault_secret(UUID, TEXT) IS 'A public RPC wrapper for vault.update_secret.'; 