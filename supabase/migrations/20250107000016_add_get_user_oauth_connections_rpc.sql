-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_user_oauth_connections(UUID);

-- Create RPC function to get all user OAuth connections (conditional on table existence)
DO $$
BEGIN
    -- Only create the function if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integration_credentials') THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION public.get_user_oauth_connections(p_user_id UUID DEFAULT auth.uid())
        RETURNS TABLE (
            connection_id UUID,
            provider_name TEXT,
            provider_display_name TEXT,
            external_username TEXT,
            connection_name TEXT,
            scopes_granted JSONB,
            connection_status TEXT,
            token_expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        ) 
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        STABLE
        AS $FUNC$
            SELECT 
                uic.id AS connection_id,
                sp.name AS provider_name,
                sp.display_name AS provider_display_name,
                uic.external_username,
                uic.connection_name,
                uic.scopes_granted,
                uic.connection_status,
                uic.token_expires_at,
                uic.created_at,
                uic.updated_at
            FROM user_integration_credentials uic
            INNER JOIN service_providers sp ON sp.id = uic.oauth_provider_id
            WHERE uic.user_id = COALESCE(p_user_id, auth.uid())
            ORDER BY uic.created_at DESC;
        $FUNC$;
        ';
        RAISE NOTICE 'Created get_user_oauth_connections function';
    ELSE
        RAISE NOTICE 'Skipping get_user_oauth_connections function - user_integration_credentials table does not exist yet';
    END IF;
END $$;

-- Grant execute permissions (conditional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_oauth_connections') THEN
        GRANT EXECUTE ON FUNCTION public.get_user_oauth_connections(UUID) TO anon, authenticated;
        COMMENT ON FUNCTION public.get_user_oauth_connections(UUID) IS 'Get all OAuth connections for a user';
        RAISE NOTICE 'Granted permissions on get_user_oauth_connections function';
    ELSE
        RAISE NOTICE 'Function get_user_oauth_connections does not exist - skipping grants';
    END IF;
END $$; 