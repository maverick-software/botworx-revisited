-- Create a simple test function to verify RPC is working
CREATE OR REPLACE FUNCTION public.test_rpc()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'RPC is working!'::text;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.test_rpc() TO anon, authenticated;

-- Also create a simplified version without the gmail_configurations join
DROP FUNCTION IF EXISTS public.get_user_gmail_connection(UUID);

CREATE OR REPLACE FUNCTION public.get_user_gmail_connection(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    connection_id UUID,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    connection_metadata JSONB,
    configuration JSONB
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        id AS connection_id,
        external_username,
        scopes_granted,
        connection_status,
        connection_metadata,
        '{}'::jsonb AS configuration
    FROM user_oauth_connections
    WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND connection_status = 'active'
    LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_gmail_connection(UUID) TO anon, authenticated;

-- Add comment to help PostgREST discover the function
COMMENT ON FUNCTION public.get_user_gmail_connection(UUID) IS 'Get user Gmail connection details';
COMMENT ON FUNCTION public.test_rpc() IS 'Test RPC functionality'; 