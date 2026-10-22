-- Simple migration to rename user_oauth_connections to user_integration_credentials
-- This version is more robust and handles missing constraints gracefully

BEGIN;

-- Step 1: Rename the main table
DO $$
BEGIN
    -- Check if old table exists and new table doesn't exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_oauth_connections')
       AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_integration_credentials') THEN
        
        -- Rename the table
        ALTER TABLE user_oauth_connections RENAME TO user_integration_credentials;
        
        -- Update table comment
        COMMENT ON TABLE user_integration_credentials IS 
        'Centralized secure storage for all integration credentials (OAuth tokens and API keys) using Supabase Vault encryption';
        
    END IF;
END $$;

-- Step 2: Rename constraints if they exist
DO $$
BEGIN
    -- Rename primary key constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'user_oauth_connections_pkey' 
               AND table_name = 'user_integration_credentials') THEN
        ALTER TABLE user_integration_credentials 
        RENAME CONSTRAINT user_oauth_connections_pkey TO user_integration_credentials_pkey;
    END IF;
    
    -- Rename check constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'user_oauth_connections_connection_status_check' 
               AND table_name = 'user_integration_credentials') THEN
        ALTER TABLE user_integration_credentials
        RENAME CONSTRAINT user_oauth_connections_connection_status_check 
        TO user_integration_credentials_connection_status_check;
    END IF;
END $$;

-- Step 3: Rename indexes if they exist
DO $$
BEGIN
    -- Rename user_id index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_oauth_connections_user_id') THEN
        ALTER INDEX idx_user_oauth_connections_user_id 
        RENAME TO idx_user_integration_credentials_user_id;
    END IF;
    
    -- Rename provider index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_oauth_connections_provider') THEN
        ALTER INDEX idx_user_oauth_connections_provider 
        RENAME TO idx_user_integration_credentials_provider;
    END IF;
    
    -- Rename status index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_oauth_connections_status') THEN
        ALTER INDEX idx_user_oauth_connections_status 
        RENAME TO idx_user_integration_credentials_status;
    END IF;
    
    -- Rename credential_type index
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_oauth_connections_credential_type') THEN
        ALTER INDEX idx_user_oauth_connections_credential_type 
        RENAME TO idx_user_integration_credentials_credential_type;
    END IF;
END $$;

-- Step 4: Create backward compatibility view
DO $$
BEGIN
    -- Only create view if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'user_oauth_connections') THEN
        CREATE VIEW user_oauth_connections AS 
        SELECT 
            id,
            user_id,
            oauth_provider_id,
            external_user_id,
            external_username,
            scopes_granted,
            connection_name,
            vault_access_token_id,
            vault_refresh_token_id,
            token_expires_at,
            last_token_refresh,
            connection_status,
            connection_metadata,
            created_at,
            updated_at,
            encrypted_access_token,
            encrypted_refresh_token,
            credential_type
        FROM user_integration_credentials;

        -- Grant permissions
        GRANT ALL ON user_oauth_connections TO authenticated;
        GRANT ALL ON user_oauth_connections TO service_role;

        COMMENT ON VIEW user_oauth_connections IS 
        'DEPRECATED: Backward compatibility view - use user_integration_credentials directly';
    END IF;
END $$;

-- Step 5: Update RPC functions
DO $func$
BEGIN
    -- Create new function if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_integration_credentials') THEN
        CREATE OR REPLACE FUNCTION public.get_user_integration_credentials(p_user_id UUID DEFAULT auth.uid())
        RETURNS TABLE(
            credential_id UUID,
            provider_name TEXT,
            provider_display_name TEXT,
            external_username TEXT,
            connection_name TEXT,
            scopes_granted JSONB,
            connection_status TEXT,
            credential_type TEXT,
            token_expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ
        )
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $body$
        BEGIN
            RETURN QUERY
            SELECT 
                c.id as credential_id,
                p.name as provider_name,
                p.display_name as provider_display_name,
                c.external_username,
                c.connection_name,
                c.scopes_granted,
                c.connection_status,
                c.credential_type::TEXT,
                c.token_expires_at,
                c.created_at,
                c.updated_at
            FROM user_integration_credentials c
            JOIN service_providers p ON c.oauth_provider_id = p.id
            WHERE c.user_id = p_user_id
            ORDER BY c.created_at DESC;
        END;
        $body$;
    END IF;
    
    -- Create/update wrapper function with old name for backward compatibility
    CREATE OR REPLACE FUNCTION public.get_user_oauth_connections(p_user_id UUID DEFAULT auth.uid())
    RETURNS TABLE(
        connection_id UUID,
        provider_name TEXT,
        provider_display_name TEXT,
        external_username TEXT,
        connection_name TEXT,
        scopes_granted JSONB,
        connection_status TEXT,
        credential_type TEXT,
        token_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $body2$
    BEGIN
        -- Delegate to the new function
        RETURN QUERY
        SELECT * FROM get_user_integration_credentials(p_user_id);
    END;
    $body2$;

    COMMENT ON FUNCTION get_user_oauth_connections IS 
    'DEPRECATED: Use get_user_integration_credentials instead';
END $func$;

-- Step 6: Verify migration
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Verify the new table exists
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_integration_credentials';
    
    IF v_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: user_integration_credentials table not found';
    END IF;
    
    -- Verify backward compatibility view exists
    SELECT COUNT(*) INTO v_count 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'user_oauth_connections';
    
    IF v_count = 0 THEN
        RAISE WARNING 'Backward compatibility view user_oauth_connections not created';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully. Table renamed from user_oauth_connections to user_integration_credentials';
    RAISE NOTICE 'Backward compatibility view created. Existing queries will continue to work.';
END $$;

COMMIT;
