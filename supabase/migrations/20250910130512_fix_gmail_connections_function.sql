-- Fix Gmail connections function - drop and recreate with correct signature
-- This migration fixes the 404 error for get_user_gmail_connections RPC function

-- Drop existing function if it exists (to avoid signature conflicts)
DROP FUNCTION IF EXISTS get_user_gmail_connections(UUID);

-- Create the plural version that the frontend expects
CREATE OR REPLACE FUNCTION get_user_gmail_connections(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    connection_status TEXT,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uic.id as connection_id,
        uic.connection_name,
        uic.external_username,
        uic.connection_status,
        uic.connection_metadata as configuration
    FROM user_integration_credentials uic
    INNER JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = p_user_id
      AND sp.name = 'gmail'
      AND uic.connection_status = 'active'
    ORDER BY uic.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_gmail_connections(UUID) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_user_gmail_connections(UUID) IS 'Get user Gmail connections (plural) - Frontend compatibility function';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✅ GMAIL CONNECTIONS FUNCTION FIXED';
    RAISE NOTICE '🔧 Function: get_user_gmail_connections(UUID) created';
    RAISE NOTICE '📱 Frontend 404 error should now be resolved';
END $$;
