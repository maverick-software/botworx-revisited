-- Migration: 20250729120000_ensure_create_vault_secret_function.sql
-- Purpose: Ensure the create_vault_secret wrapper function exists for RPC calls

-- Drop the function if it exists to ensure a clean slate
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT, TEXT);

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

-- Grant execution rights to the service_role so it can be called from Edge Functions
GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) IS 'A public RPC wrapper for vault.create_secret.'; 