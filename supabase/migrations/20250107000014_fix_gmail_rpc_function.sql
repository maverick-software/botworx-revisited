-- Ensure get_user_gmail_connection is accessible via RPC
-- Drop and recreate with proper schema and permissions

DROP FUNCTION IF EXISTS get_user_gmail_connection(UUID);

CREATE OR REPLACE FUNCTION public.get_user_gmail_connection(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    connection_id UUID,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    connection_metadata JSONB,
    configuration JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Use the provided user_id or default to current user
    RETURN QUERY
    SELECT 
        uoc.id,
        uoc.external_username,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.connection_metadata,
        COALESCE(gc.security_settings, '{}'::jsonb) as configuration
    FROM user_oauth_connections uoc
    LEFT JOIN gmail_configurations gc ON gc.user_oauth_connection_id = uoc.id
    WHERE uoc.user_id = COALESCE(p_user_id, auth.uid())
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND uoc.connection_status = 'active';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_gmail_connection(UUID) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_user_gmail_connection IS 'Retrieves the active Gmail connection for a user'; 