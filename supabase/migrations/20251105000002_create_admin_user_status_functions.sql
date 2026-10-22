-- Migration: Create admin user status management functions
-- Description: Functions to suspend/reactivate users via direct database access
-- Date: 2025-11-05

-- Function to suspend a user
CREATE OR REPLACE FUNCTION public.admin_suspend_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    -- Update the user's banned_until field to a far future date
    UPDATE auth.users
    SET banned_until = NOW() + INTERVAL '999 years'
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;

-- Function to reactivate a user
CREATE OR REPLACE FUNCTION public.admin_reactivate_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    -- Clear the banned_until field
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$;

-- Grant execute permission to service role only
GRANT EXECUTE ON FUNCTION public.admin_suspend_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(UUID) TO service_role;

COMMENT ON FUNCTION public.admin_suspend_user IS 'Suspend a user by setting banned_until - service role only';
COMMENT ON FUNCTION public.admin_reactivate_user IS 'Reactivate a user by clearing banned_until - service role only';

