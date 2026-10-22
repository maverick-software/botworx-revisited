-- Migration: Consolidate profiles and user_profiles into single profiles table
-- Description: Merge user_profiles into profiles to have one unified user profile table
-- Date: 2025-10-09

-- Step 1: Add missing columns from user_profiles to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- Step 2: Migrate data from user_profiles to profiles (if any exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
  ) THEN
    -- Merge data from user_profiles into profiles
    UPDATE public.profiles p
    SET 
      username = COALESCE(p.username, up.username),
      avatar_url = COALESCE(p.avatar_url, up.avatar_url),
      first_name = COALESCE(p.first_name, up.first_name),
      last_name = COALESCE(p.last_name, up.last_name),
      mobile_number = COALESCE(p.mobile_number, up.mobile_number),
      updated_at = GREATEST(p.updated_at, up.updated_at)
    FROM public.user_profiles up
    WHERE p.id = up.id;
    
    -- Insert any records that exist in user_profiles but not in profiles
    INSERT INTO public.profiles (id, username, avatar_url, first_name, last_name, mobile_number, updated_at)
    SELECT id, username, avatar_url, first_name, last_name, mobile_number, updated_at
    FROM public.user_profiles up
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = up.id
    );
  END IF;
END $$;

-- Step 3: Create index for mobile_number on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_mobile_number 
ON public.profiles(mobile_number) 
WHERE mobile_number IS NOT NULL;

-- Step 4: Create index for username on profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON public.profiles(username) 
WHERE username IS NOT NULL;

-- Step 5: Drop the user_profiles table (backup first if needed)
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Step 6: Update table comments
COMMENT ON TABLE public.profiles IS 'Unified user profile table containing personal information, contact details, and business context';
COMMENT ON COLUMN public.profiles.first_name IS 'User''s first name';
COMMENT ON COLUMN public.profiles.last_name IS 'User''s last name';
COMMENT ON COLUMN public.profiles.username IS 'Unique username for the user';
COMMENT ON COLUMN public.profiles.mobile_number IS 'User''s mobile phone number (optional)';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user''s avatar image';
COMMENT ON COLUMN public.profiles.mobile IS 'Legacy mobile field (consider migrating to mobile_number)';
COMMENT ON COLUMN public.profiles.company_name IS 'User''s company or organization name';
COMMENT ON COLUMN public.profiles.title IS 'User''s job title or role';
COMMENT ON COLUMN public.profiles.usage_reason IS 'JSON data about why user is using the platform';
COMMENT ON COLUMN public.profiles.hopes_goals IS 'User''s goals and objectives';

-- Step 7: Ensure RLS policies exist for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Step 8: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

