-- Migration: Update profiles table structure
-- Description: Modify profiles to support first_name, last_name, and mobile_number
-- Date: 2025-10-09

-- Step 1: Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS mobile_number TEXT;

-- Step 2: Migrate existing full_name data to first_name and last_name
UPDATE public.profiles
SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN full_name LIKE '% %' THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL AND first_name IS NULL;

-- Step 3: Create index for mobile_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_mobile_number 
ON public.profiles(mobile_number) 
WHERE mobile_number IS NOT NULL;

-- Step 4: Add comment to describe the table structure
COMMENT ON TABLE public.profiles IS 'User profile information including name, contact details, and avatar';
COMMENT ON COLUMN public.profiles.first_name IS 'User''s first name';
COMMENT ON COLUMN public.profiles.last_name IS 'User''s last name';
COMMENT ON COLUMN public.profiles.full_name IS 'User''s full name (legacy field, derived from first_name + last_name)';
COMMENT ON COLUMN public.profiles.mobile_number IS 'User''s mobile phone number (optional)';
COMMENT ON COLUMN public.profiles.username IS 'Unique username for the user';

-- Step 5: Create or replace function to automatically update full_name
CREATE OR REPLACE FUNCTION public.sync_user_full_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set full_name from first_name and last_name
  NEW.full_name := TRIM(CONCAT(NEW.first_name, ' ', NEW.last_name));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger to keep full_name in sync
DROP TRIGGER IF EXISTS sync_user_full_name_trigger ON public.profiles;
CREATE TRIGGER sync_user_full_name_trigger
  BEFORE INSERT OR UPDATE OF first_name, last_name
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_full_name();

-- Step 7: Update existing records to sync full_name
UPDATE public.profiles
SET updated_at = updated_at; -- This will trigger the sync function

-- Step 8: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

