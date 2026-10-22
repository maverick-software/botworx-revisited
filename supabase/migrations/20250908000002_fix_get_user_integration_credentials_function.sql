-- =====================================================
-- FIX GET_USER_INTEGRATION_CREDENTIALS FUNCTION
-- =====================================================
-- Update the RPC function to use the correct column names and table structure
-- Date: September 8, 2025
-- Purpose: Fix OneDrive and other OAuth connections not appearing in Credentials page

BEGIN;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_user_integration_credentials(UUID);

-- Recreate the function with correct column references
CREATE OR REPLACE FUNCTION public.get_user_integration_credentials(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
    credential_id UUID,
    connection_id UUID,  -- Add connection_id for compatibility
    user_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    external_username TEXT,
    connection_name TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    credential_type connection_credential_type_enum,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Return data from user_integration_credentials with service_providers join
    RETURN QUERY
    SELECT 
        uic.id as credential_id,
        uic.id as connection_id,  -- Use same ID for backward compatibility
        uic.user_id,
        COALESCE(sp.name, 'unknown') as provider_name,
        COALESCE(sp.display_name, 'Unknown Provider') as provider_display_name,
        uic.external_username,
        uic.connection_name,
        COALESCE(uic.scopes_granted, '{}'::jsonb) as scopes_granted,
        uic.connection_status,
        uic.credential_type,
        uic.token_expires_at,
        uic.created_at,
        uic.updated_at
    FROM user_integration_credentials uic
    LEFT JOIN service_providers sp ON uic.oauth_provider_id = sp.id
    WHERE uic.user_id = COALESCE(p_user_id, auth.uid())
    AND uic.connection_status != 'revoked'
    ORDER BY uic.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_integration_credentials(UUID) TO anon, authenticated;

-- Add updated comment
COMMENT ON FUNCTION public.get_user_integration_credentials(UUID) IS 'Get user integration credentials - Updated to use oauth_provider_id column referencing service_providers table';

-- Verify the function works by testing it
DO $$
DECLARE
    v_test_count INTEGER;
BEGIN
    -- Test the function (this will only work if there are existing connections)
    SELECT COUNT(*) INTO v_test_count 
    FROM public.get_user_integration_credentials(auth.uid());
    
    RAISE NOTICE 'Function test completed. Found % user integration credentials', v_test_count;
    RAISE NOTICE 'get_user_integration_credentials function updated successfully!';
END $$;

COMMIT;

-- Post-migration validation
DO $$
DECLARE
    v_function_exists BOOLEAN;
    v_column_exists BOOLEAN;
BEGIN
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_user_integration_credentials'
    ) INTO v_function_exists;
    
    -- Check if oauth_provider_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_integration_credentials' 
        AND column_name = 'oauth_provider_id'
    ) INTO v_column_exists;
    
    IF v_function_exists AND v_column_exists THEN
        RAISE NOTICE '✅ Migration successful:';
        RAISE NOTICE '  - Function get_user_integration_credentials exists';
        RAISE NOTICE '  - Column oauth_provider_id exists in user_integration_credentials';
        RAISE NOTICE '  - OneDrive and other OAuth connections should now appear in Credentials page';
    ELSE
        RAISE WARNING '⚠️ Migration may have issues:';
        RAISE WARNING '  - Function exists: %', v_function_exists;
        RAISE WARNING '  - oauth_provider_id column exists: %', v_column_exists;
    END IF;
END $$;
