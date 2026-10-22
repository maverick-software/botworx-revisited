-- Fix get_user_gmail_connections function to use the correct table
-- This function is being called by useGmailConnection hook

CREATE OR REPLACE FUNCTION public.get_user_gmail_connections(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    connection_metadata JSONB,
    configuration JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uic.id AS connection_id,
        uic.connection_name,
        uic.external_username,
        COALESCE(uic.scopes_granted, '{}'::jsonb) AS scopes_granted,
        uic.connection_status,
        COALESCE(uic.connection_metadata, '{}'::jsonb) AS connection_metadata,
        '{}'::jsonb AS configuration,
        uic.created_at
    FROM user_integration_credentials uic
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE uic.user_id = COALESCE(p_user_id, auth.uid())
    AND op.name = 'gmail'
    AND uic.connection_status = 'active'
    ORDER BY uic.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_gmail_connections(UUID) TO anon, authenticated;
