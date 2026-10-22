-- Migration: Fix handle_new_user trigger to use first_name and last_name
-- Description: Updates the trigger to match the current profiles table schema and metadata structure
-- Date: 2025-11-03

-- Update the trigger function to properly extract first_name and last_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert profile with first_name and last_name from raw_user_meta_data
    INSERT INTO public.profiles (
        id, 
        first_name, 
        last_name, 
        created_at, 
        updated_at
    )
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'first_name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'last_name', NULL),
        NOW(), 
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail user creation
        RAISE WARNING 'Failed to create profile for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (it should already exist, but this will recreate it)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT INSERT ON public.profiles TO authenticated;

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a profile entry when a new user signs up, extracting first_name and last_name from user metadata';

