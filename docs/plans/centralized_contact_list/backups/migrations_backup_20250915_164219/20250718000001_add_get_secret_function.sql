-- Create get_secret function to retrieve secrets from vault
CREATE OR REPLACE FUNCTION public.get_secret(secret_id UUID)
RETURNS TABLE (key TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT decrypted_secret AS key
    FROM vault.decrypted_secrets
    WHERE id = secret_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_secret(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_secret(UUID) IS 'Retrieve a decrypted secret from vault by ID';

-- Also create a variant that takes secret_name for compatibility
CREATE OR REPLACE FUNCTION public.get_secret(secret_name TEXT)
RETURNS TABLE (key TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT decrypted_secret AS key
    FROM vault.decrypted_secrets
    WHERE name = secret_name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_secret(TEXT) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_secret(TEXT) IS 'Retrieve a decrypted secret from vault by name'; 