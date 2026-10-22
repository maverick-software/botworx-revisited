-- Fix get_user_gmail_connection to return vault token IDs needed by gmail-api function

-- Create a function specifically for the gmail-api edge function
CREATE OR REPLACE FUNCTION public.get_gmail_connection_with_tokens(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    vault_access_token_id TEXT,
    vault_refresh_token_id TEXT,
    connection_metadata JSONB,
    configuration JSONB
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        uoc.id AS connection_id,
        uoc.external_username,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.vault_access_token_id,
        uoc.vault_refresh_token_id,
        uoc.connection_metadata,
        '{}'::jsonb as configuration
    FROM user_oauth_connections uoc
    WHERE uoc.user_id = p_user_id
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND uoc.connection_status = 'active'
    LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_gmail_connection_with_tokens(UUID) TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_gmail_connection_with_tokens(UUID) IS 'Get Gmail connection with vault token IDs for edge function use'; 