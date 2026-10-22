-- Migration: Support multiple OAuth connections per provider per user
-- This allows users to connect multiple Gmail accounts (or other OAuth providers)

-- First, add a connection_name field to user_oauth_connections
ALTER TABLE user_oauth_connections 
ADD COLUMN IF NOT EXISTS connection_name TEXT;

-- Drop the existing unique constraint that prevents multiple connections
ALTER TABLE user_oauth_connections 
DROP CONSTRAINT IF EXISTS user_oauth_connections_user_id_oauth_provider_id_key;

-- Add a new unique constraint that includes connection_name
-- This allows multiple connections per provider as long as they have different names
ALTER TABLE user_oauth_connections 
ADD CONSTRAINT user_oauth_connections_user_provider_name_key 
UNIQUE(user_id, oauth_provider_id, connection_name);

-- Update existing connections to have a default connection name
UPDATE user_oauth_connections 
SET connection_name = COALESCE(external_username, 'Default Connection')
WHERE connection_name IS NULL;

-- Make connection_name NOT NULL after setting defaults
ALTER TABLE user_oauth_connections 
ALTER COLUMN connection_name SET NOT NULL;

-- Update the get_user_gmail_connection function to return all Gmail connections
DROP FUNCTION IF EXISTS public.get_user_gmail_connection(UUID);

-- Create a new function that returns all Gmail connections for a user
CREATE OR REPLACE FUNCTION public.get_user_gmail_connections(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    connection_metadata JSONB,
    configuration JSONB,
    created_at TIMESTAMPTZ
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        id AS connection_id,
        connection_name,
        external_username,
        scopes_granted,
        connection_status,
        connection_metadata,
        '{}'::jsonb AS configuration,
        created_at
    FROM user_oauth_connections
    WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    ORDER BY created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_gmail_connections(UUID) TO anon, authenticated;

-- Add comment to help PostgREST discover the function
COMMENT ON FUNCTION public.get_user_gmail_connections(UUID) IS 'Get all Gmail connections for a user';

-- Create a function to get a specific Gmail connection by ID
CREATE OR REPLACE FUNCTION public.get_gmail_connection_by_id(p_connection_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
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
        connection_name,
        external_username,
        scopes_granted,
        connection_status,
        connection_metadata,
        '{}'::jsonb AS configuration
    FROM user_oauth_connections
    WHERE id = p_connection_id
    AND user_id = auth.uid()
    AND oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_gmail_connection_by_id(UUID) TO anon, authenticated;

-- Update the get_user_oauth_connections function to include connection_name
DROP FUNCTION IF EXISTS public.get_user_oauth_connections(UUID);

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
AS $$
    SELECT 
        uoc.id AS connection_id,
        op.name AS provider_name,
        op.display_name AS provider_display_name,
        uoc.external_username,
        uoc.connection_name,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.token_expires_at,
        uoc.created_at,
        uoc.updated_at
    FROM user_oauth_connections uoc
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE uoc.user_id = COALESCE(p_user_id, auth.uid())
    ORDER BY uoc.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_oauth_connections(UUID) TO anon, authenticated; 