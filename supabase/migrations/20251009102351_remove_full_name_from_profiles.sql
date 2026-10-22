-- Migration: Remove full_name column from profiles table
-- Description: Remove the full_name column since we now use first_name and last_name
-- Date: 2025-10-09

-- Step 1: Drop the triggers first (check both profiles and user_profiles tables)
DROP TRIGGER IF EXISTS sync_user_full_name_trigger ON public.profiles;
DROP TRIGGER IF EXISTS sync_user_full_name_trigger ON public.user_profiles;

-- Step 2: Drop the trigger function with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS public.sync_user_full_name() CASCADE;

-- Step 3: Remove the full_name column from profiles table
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS full_name;

-- Step 4: Remove the full_name column from user_profiles table if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS full_name;
  END IF;
END $$;

-- Step 5: Add comment to clarify the change
COMMENT ON TABLE public.profiles IS 'User profile information with first_name, last_name, mobile_number, and avatar';

