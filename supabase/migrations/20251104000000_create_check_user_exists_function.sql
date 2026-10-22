-- Create a function to check if a user exists by email
-- This is used by the check-email-exists edge function
CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Query auth.users to check if email exists
  SELECT COUNT(*)
  INTO user_count
  FROM auth.users
  WHERE email = user_email;
  
  -- Return true if user exists, false otherwise
  RETURN user_count > 0;
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email(TEXT) TO anon;

COMMENT ON FUNCTION public.check_user_exists_by_email IS 'Check if a user exists by email address. Used during login/signup flow.';

