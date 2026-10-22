-- Fix profiles table registration issues
-- File: supabase/migrations/20241227000001_fix_profiles_registration.sql

-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create comprehensive RLS policies for profiles table
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Ensure the handle_updated_at function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW 
EXECUTE FUNCTION public.handle_updated_at();

-- Optional: Create a trigger to automatically create profiles when users sign up
-- This would eliminate the need for manual profile creation in the frontend
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, created_at, updated_at)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 
        NOW(), 
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation (optional)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
