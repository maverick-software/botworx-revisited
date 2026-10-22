-- Debug registration trigger issues
-- File: supabase/migrations/20241227000002_debug_registration_trigger.sql

-- First, let's make the trigger function more robust with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Add logging to help debug
    RAISE NOTICE 'handle_new_user trigger fired for user: %', NEW.id;
    
    BEGIN
        -- Try to insert the profile
        INSERT INTO public.profiles (id, full_name, created_at, updated_at)
        VALUES (
            NEW.id, 
            COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name', 
                'New User'
            ), 
            NOW(), 
            NOW()
        );
        
        RAISE NOTICE 'Profile created successfully for user: %', NEW.id;
        
    EXCEPTION WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Failed to create profile for user %: % - %', NEW.id, SQLSTATE, SQLERRM;
        
        -- Still return NEW so the user creation doesn't fail
        -- We'll handle profile creation in the frontend as fallback
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Let's also temporarily disable the trigger to see if that's causing the issue
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Re-create the trigger with better error handling
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Let's also check if there are any constraints we're missing
-- Check if the profiles table has any other constraints
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Checking profiles table structure...';
    
    -- This will help us see what constraints exist
    FOR rec IN 
        SELECT constraint_name, constraint_type 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' AND table_schema = 'public'
    LOOP
        RAISE NOTICE 'Constraint: % - Type: %', rec.constraint_name, rec.constraint_type;
    END LOOP;
END $$;
