-- Migration: Create get_users_auth_data function
-- Description: Creates a function to get auth.users data for admin panel
-- Date: 2025-11-05

-- Create function to get auth data for users including ban status
CREATE OR REPLACE FUNCTION public.get_users_auth_data(user_ids UUID[])
RETURNS TABLE (
    id UUID,
    email TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    banned_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email::TEXT,
        u.created_at,
        u.last_sign_in_at,
        u.banned_until
    FROM auth.users u
    WHERE u.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to service role only (admin function)
GRANT EXECUTE ON FUNCTION public.get_users_auth_data(UUID[]) TO service_role;

COMMENT ON FUNCTION public.get_users_auth_data IS 'Get auth.users data for admin panel - service role only';

