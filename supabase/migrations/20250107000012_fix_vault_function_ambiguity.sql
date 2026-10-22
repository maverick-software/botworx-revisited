-- Fix the ambiguous column reference in create_vault_secret function
-- Updated to use correct parameter names that match RPC calls

-- Drop existing function first to avoid parameter name conflicts
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_vault_secret(TEXT);

CREATE OR REPLACE FUNCTION "public"."create_vault_secret"("p_secret" "text", "p_name" "text", "p_description" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Use positional arguments as shown in Supabase documentation
    RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;

-- Grant execution rights to the service_role so it can be called from Edge Functions
GRANT EXECUTE ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_vault_secret(TEXT, TEXT, TEXT) IS 'A public RPC wrapper for vault.create_secret.'; 