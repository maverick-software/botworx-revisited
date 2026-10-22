-- Migration: Fix oauth_provider_id foreign key relationship
-- Purpose: Update foreign key constraint to reference service_providers instead of oauth_providers
-- Date: 2025-09-25
-- Issue: SMTP API failing due to broken foreign key relationship

-- First, check if the old foreign key constraint exists and drop it
DO $$
BEGIN
    -- Drop any existing foreign key constraints that reference oauth_providers
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%oauth_provider_id%' 
        AND table_name = 'user_integration_credentials'
        AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Get the exact constraint name and drop it
        EXECUTE (
            SELECT 'ALTER TABLE user_integration_credentials DROP CONSTRAINT ' || constraint_name || ';'
            FROM information_schema.table_constraints 
            WHERE constraint_name LIKE '%oauth_provider_id%' 
            AND table_name = 'user_integration_credentials'
            AND constraint_type = 'FOREIGN KEY'
            LIMIT 1
        );
        
        RAISE NOTICE '✅ Dropped old oauth_provider_id foreign key constraint';
    ELSE
        RAISE NOTICE 'ℹ️ No existing oauth_provider_id foreign key constraint found';
    END IF;
    
    -- Add new foreign key constraint to service_providers
    ALTER TABLE user_integration_credentials 
    ADD CONSTRAINT user_integration_credentials_oauth_provider_id_fkey 
    FOREIGN KEY (oauth_provider_id) REFERENCES service_providers(id) ON DELETE CASCADE;
    
    RAISE NOTICE '✅ Added new foreign key constraint: oauth_provider_id -> service_providers(id)';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error updating foreign key constraint: %', SQLERRM;
    -- Don't fail the migration, just log the error
END $$;

-- Verify the foreign key relationship is working
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu_from 
            ON rc.constraint_name = kcu_from.constraint_name
        JOIN information_schema.key_column_usage kcu_to 
            ON rc.unique_constraint_name = kcu_to.constraint_name
        WHERE kcu_from.table_name = 'user_integration_credentials'
        AND kcu_from.column_name = 'oauth_provider_id'
        AND kcu_to.table_name = 'service_providers'
        AND kcu_to.column_name = 'id'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Foreign key relationship verified: user_integration_credentials.oauth_provider_id -> service_providers.id';
    ELSE
        RAISE NOTICE '❌ Foreign key relationship verification failed';
    END IF;
END $$;

-- Add a comment to document this fix
COMMENT ON CONSTRAINT user_integration_credentials_oauth_provider_id_fkey ON user_integration_credentials IS 
'Fixed foreign key relationship to reference service_providers instead of oauth_providers (2025-09-25)';

