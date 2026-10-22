-- Migration: Clean up profiles table structure
-- Description: Consolidate mobile fields, remove hopes_goals, reorder columns for better organization
-- Date: 2025-10-09

-- Step 1: Migrate data from mobile to mobile_number (keep existing mobile_number if it exists)
UPDATE public.profiles
SET mobile_number = COALESCE(mobile_number, mobile)
WHERE mobile IS NOT NULL AND mobile_number IS NULL;

-- Step 2: Drop redundant columns
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS mobile,
DROP COLUMN IF EXISTS hopes_goals;

-- Step 3: Recreate the table with proper column order
-- Note: PostgreSQL doesn't allow easy column reordering, so we'll create a new table and migrate data
CREATE TABLE public.profiles_new (
  id uuid NOT NULL,
  username text NULL,
  first_name text NULL,
  last_name text NULL,
  company_name text NULL,
  title text NULL,
  avatar_url text NULL,
  mobile_number text NULL,
  usage_reason jsonb NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_username_key UNIQUE (username),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Step 4: Migrate data to new table
INSERT INTO public.profiles_new (
  id, username, first_name, last_name, company_name, title, avatar_url, 
  mobile_number, usage_reason, created_at, updated_at
)
SELECT 
  id, username, first_name, last_name, company_name, title, avatar_url,
  mobile_number, usage_reason, created_at, updated_at
FROM public.profiles;

-- Step 5: Drop old table and rename new one
DROP TABLE public.profiles CASCADE;
ALTER TABLE public.profiles_new RENAME TO profiles;

-- Step 6: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_profiles_mobile_number 
ON public.profiles(mobile_number) 
WHERE mobile_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON public.profiles(username) 
WHERE username IS NOT NULL;

-- Step 7: Recreate trigger
CREATE TRIGGER on_profile_update 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW 
EXECUTE FUNCTION handle_updated_at();

-- Step 8: Recreate RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

-- Step 9: Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 10: Add comprehensive comments
COMMENT ON TABLE public.profiles IS 'Unified user profile table with personal information and business context';
COMMENT ON COLUMN public.profiles.id IS 'User ID (references auth.users)';
COMMENT ON COLUMN public.profiles.username IS 'Unique username';
COMMENT ON COLUMN public.profiles.first_name IS 'User''s first name';
COMMENT ON COLUMN public.profiles.last_name IS 'User''s last name';
COMMENT ON COLUMN public.profiles.company_name IS 'Company or organization name';
COMMENT ON COLUMN public.profiles.title IS 'Job title or role';
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar image';
COMMENT ON COLUMN public.profiles.mobile_number IS 'Mobile phone number';
COMMENT ON COLUMN public.profiles.usage_reason IS 'JSON data about platform usage reasons';
COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp when profile was created';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp when profile was last updated';

