-- Migration: Fix credential type consistency constraint
-- Purpose: Update constraint to work with renamed user_integration_credentials table
-- Issue: Constraint was created on user_oauth_connections but table was renamed
-- File: 20250914000001_fix_credential_type_constraint.sql

-- Drop the old constraint if it exists on the renamed table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_credential_type_consistency' 
        AND table_name = 'user_integration_credentials'
    ) THEN
        ALTER TABLE user_integration_credentials 
        DROP CONSTRAINT chk_credential_type_consistency;
        RAISE NOTICE 'Dropped existing chk_credential_type_consistency constraint';
    END IF;
END $$;

-- Add the corrected constraint to user_integration_credentials table
ALTER TABLE user_integration_credentials 
ADD CONSTRAINT chk_credential_type_consistency CHECK (
    (
        -- For OAuth connections, access token is required when active
        (credential_type = 'oauth' AND connection_status = 'active' AND vault_access_token_id IS NOT NULL)
        OR
        -- For API key connections, access token is required when active, refresh token not needed
        (credential_type = 'api_key' AND connection_status = 'active' AND vault_access_token_id IS NOT NULL)
        OR
        -- For any non-active connections, no token requirements
        (connection_status != 'active')
    )
);

-- Add helpful comment
COMMENT ON CONSTRAINT chk_credential_type_consistency ON user_integration_credentials IS 
'Ensures credential consistency: OAuth and API key connections require access tokens when active';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250914000001_fix_credential_type_constraint completed successfully';
    RAISE NOTICE 'Credential type consistency constraint now properly applies to user_integration_credentials table';
END $$;
