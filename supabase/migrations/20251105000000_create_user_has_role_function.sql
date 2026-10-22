-- Migration: Create user_has_role function
-- Description: Creates a helper function to check if a user has a specific role
-- Date: 2025-11-05

-- Create the user_has_role function
CREATE OR REPLACE FUNCTION public.user_has_role(
    user_id UUID,
    role_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    has_role BOOLEAN;
BEGIN
    -- Check if the user has the specified role
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        INNER JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
        AND r.name = $2
    ) INTO has_role;
    
    RETURN COALESCE(has_role, false);
EXCEPTION
    WHEN OTHERS THEN
        -- Return false on any error
        RAISE WARNING 'Error in user_has_role: %', SQLERRM;
        RETURN false;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, TEXT) TO anon;

COMMENT ON FUNCTION public.user_has_role IS 'Check if a user has a specific role by name';

