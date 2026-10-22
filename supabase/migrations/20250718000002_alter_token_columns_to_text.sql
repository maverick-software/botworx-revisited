-- Change vault_access_token_id and vault_refresh_token_id columns from UUID to TEXT
-- This allows storing OAuth tokens directly instead of vault IDs

-- First, alter the columns to TEXT
ALTER TABLE user_oauth_connections 
ALTER COLUMN vault_access_token_id TYPE TEXT,
ALTER COLUMN vault_refresh_token_id TYPE TEXT;

-- Update the comment to reflect the new usage
COMMENT ON COLUMN user_oauth_connections.vault_access_token_id IS 'Stores access token directly or vault ID reference';
COMMENT ON COLUMN user_oauth_connections.vault_refresh_token_id IS 'Stores refresh token directly or vault ID reference';

-- Update the get_gmail_connection_with_tokens function to handle TEXT columns
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