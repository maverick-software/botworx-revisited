-- Migration: Fix service_providers trigger function reference
-- Purpose: Update service_providers trigger to use correct function name
-- Date: 2025-09-25
-- Issue: service_providers trigger still references old update_oauth_providers_updated_at function

-- Step 1: Drop the old trigger on service_providers
DROP TRIGGER IF EXISTS update_service_providers_updated_at ON service_providers;

-- Step 2: Create or update the function with correct name for service_providers
CREATE OR REPLACE FUNCTION update_service_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create new trigger with correct function
CREATE TRIGGER update_service_providers_updated_at
    BEFORE UPDATE ON service_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_service_providers_updated_at();

-- Step 4: Clean up old oauth_providers_old table and its trigger if they exist
DROP TRIGGER IF EXISTS update_oauth_providers_updated_at ON oauth_providers_old;
DROP TABLE IF EXISTS oauth_providers_old CASCADE;

-- Step 5: Check if the old function is still needed by other tables
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    -- Count how many triggers still use the old function
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE action_statement LIKE '%update_oauth_providers_updated_at%';
    
    IF trigger_count = 0 THEN
        -- Safe to drop the old function
        DROP FUNCTION IF EXISTS update_oauth_providers_updated_at();
        RAISE NOTICE '✅ Dropped unused function: update_oauth_providers_updated_at()';
    ELSE
        RAISE NOTICE 'ℹ️ Keeping update_oauth_providers_updated_at() - still used by % triggers', trigger_count;
    END IF;
END $$;

-- Step 6: Verify the fix
DO $$
BEGIN
    -- Check that service_providers trigger is using correct function
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_service_providers_updated_at'
        AND event_object_table = 'service_providers'
        AND action_statement LIKE '%update_service_providers_updated_at%'
    ) THEN
        RAISE NOTICE '✅ service_providers trigger now uses correct function';
    ELSE
        RAISE NOTICE '❌ service_providers trigger fix verification failed';
    END IF;
END $$;

