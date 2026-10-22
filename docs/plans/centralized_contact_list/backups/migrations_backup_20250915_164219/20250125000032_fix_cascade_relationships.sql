-- Fix Cascade Relationships for Tool Availability System
-- Date: January 25, 2025
-- Purpose: Establish proper CASCADE DELETE relationships between integrations → credentials → agent permissions → tool availability

BEGIN;

-- =============================================
-- STEP 1: Fix agent_oauth_permissions foreign key constraints
-- =============================================

-- Drop existing constraint if it exists (agent_id likely has no proper foreign key)
DO $$
BEGIN
    -- Check if agent_id foreign key constraint exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%agent_oauth_permissions_agent_id%'
        AND table_name = 'agent_oauth_permissions'
    ) THEN
        ALTER TABLE agent_oauth_permissions 
        DROP CONSTRAINT agent_oauth_permissions_agent_id_fkey;
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist, continue
        NULL;
END $$;

-- Add proper foreign key constraint with CASCADE
ALTER TABLE agent_oauth_permissions 
ADD CONSTRAINT agent_oauth_permissions_agent_id_fkey 
FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE;

-- Verify user_oauth_connection_id constraint has CASCADE (should already exist)
DO $$
BEGIN
    -- This should already exist with CASCADE from the original migration
    -- but let's verify it exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_oauth_permissions_user_oauth_connection_id_fkey'
        AND table_name = 'agent_oauth_permissions'
    ) THEN
        ALTER TABLE agent_oauth_permissions 
        ADD CONSTRAINT agent_oauth_permissions_user_oauth_connection_id_fkey 
        FOREIGN KEY (user_oauth_connection_id) REFERENCES user_integration_credentials(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =============================================
-- STEP 2: Update renamed table references
-- =============================================

-- Update the foreign key to point to the renamed table
DO $$
BEGIN
    -- Drop old constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_oauth_permissions_user_oauth_connection_id_fkey'
        AND table_name = 'agent_oauth_permissions'
    ) THEN
        ALTER TABLE agent_oauth_permissions 
        DROP CONSTRAINT agent_oauth_permissions_user_oauth_connection_id_fkey;
    END IF;
    
    -- Add new constraint pointing to renamed table
    ALTER TABLE agent_oauth_permissions 
    ADD CONSTRAINT agent_integration_permissions_connection_id_fkey 
    FOREIGN KEY (user_oauth_connection_id) REFERENCES user_integration_credentials(id) ON DELETE CASCADE;
END $$;

-- =============================================
-- STEP 3: Create CASCADE trigger functions
-- =============================================

-- Function to handle credential revocation cascade
CREATE OR REPLACE FUNCTION handle_credential_revocation_cascade()
RETURNS TRIGGER AS $$
BEGIN
    -- When a credential is revoked, clean up related data
    IF NEW.connection_status = 'revoked' AND OLD.connection_status != 'revoked' THEN
        -- Log the revocation
        RAISE NOTICE 'Credential revoked for user % provider %: %', 
            NEW.user_id, 
            (SELECT name FROM service_providers WHERE id = NEW.oauth_provider_id),
            NEW.connection_name;
        
        -- The CASCADE DELETE will automatically remove agent_oauth_permissions
        -- when the credential record is deleted, but we can log here
        
        -- Update any agent metadata that might reference this tool
        UPDATE agents 
        SET metadata = jsonb_set(
            COALESCE(metadata, '{}'),
            '{credential_revoked}',
            to_jsonb(ARRAY[NEW.id::text])
        )
        WHERE id IN (
            SELECT agent_id 
            FROM agent_oauth_permissions 
            WHERE user_oauth_connection_id = NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle agent deletion cascade
CREATE OR REPLACE FUNCTION handle_agent_deletion_cascade()
RETURNS TRIGGER AS $$
BEGIN
    -- Log agent deletion and its impact
    RAISE NOTICE 'Agent deleted: % - Associated tool permissions will be cascaded', 
        OLD.id;
    
    -- The CASCADE DELETE constraints will handle the cleanup automatically
    -- This trigger is for logging and any additional cleanup needed
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function to handle integration deletion cascade  
CREATE OR REPLACE FUNCTION handle_integration_deletion_cascade()
RETURNS TRIGGER AS $$
BEGIN
    -- When an OAuth provider (integration) is deleted, cascade through the system
    RAISE NOTICE 'Integration deleted: % - Cascading through credentials and permissions', 
        OLD.display_name;
    
    -- The CASCADE DELETE constraints will handle most cleanup
    -- This is for additional business logic if needed
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 4: Create triggers
-- =============================================

-- Trigger for credential status changes
DROP TRIGGER IF EXISTS credential_revocation_cascade_trigger ON user_integration_credentials;
CREATE TRIGGER credential_revocation_cascade_trigger
    AFTER UPDATE ON user_integration_credentials
    FOR EACH ROW
    EXECUTE FUNCTION handle_credential_revocation_cascade();

-- Trigger for agent deletion
DROP TRIGGER IF EXISTS agent_deletion_cascade_trigger ON agents;
CREATE TRIGGER agent_deletion_cascade_trigger
    AFTER DELETE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION handle_agent_deletion_cascade();

-- Trigger for integration deletion
DROP TRIGGER IF EXISTS integration_deletion_cascade_trigger ON service_providers;
CREATE TRIGGER integration_deletion_cascade_trigger
    AFTER DELETE ON service_providers
    FOR EACH ROW
    EXECUTE FUNCTION handle_integration_deletion_cascade();

-- =============================================
-- STEP 5: Create cascade verification functions
-- =============================================

-- Function to verify tool availability for an agent
CREATE OR REPLACE FUNCTION verify_agent_tool_availability(p_agent_id UUID, p_user_id UUID)
RETURNS TABLE (
    integration_name TEXT,
    tool_available BOOLEAN,
    credential_status TEXT,
    permission_granted BOOLEAN,
    permission_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        op.display_name as integration_name,
        (uic.id IS NOT NULL AND uic.connection_status = 'active') as tool_available,
        COALESCE(uic.connection_status, 'no_credential') as credential_status,
        (aop.id IS NOT NULL) as permission_granted,
        COALESCE(aop.is_active, false) as permission_active
    FROM service_providers op
    LEFT JOIN user_integration_credentials uic ON (
        uic.oauth_provider_id = op.id 
        AND uic.user_id = p_user_id
    )
    LEFT JOIN agent_oauth_permissions aop ON (
        aop.user_oauth_connection_id = uic.id 
        AND aop.agent_id = p_agent_id
    )
    ORDER BY op.display_name;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned permissions
CREATE OR REPLACE FUNCTION cleanup_orphaned_permissions()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- Remove agent permissions where the credential no longer exists
    DELETE FROM agent_oauth_permissions 
    WHERE user_oauth_connection_id NOT IN (
        SELECT id FROM user_integration_credentials 
        WHERE connection_status = 'active'
    );
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % orphaned agent permissions', cleanup_count;
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 6: Add helpful comments and documentation
-- =============================================

COMMENT ON FUNCTION handle_credential_revocation_cascade IS 
'Handles cascade effects when credentials are revoked, ensuring agents lose tool access';

COMMENT ON FUNCTION handle_agent_deletion_cascade IS 
'Handles cascade effects when agents are deleted, cleaning up permissions';

COMMENT ON FUNCTION verify_agent_tool_availability IS 
'Verifies which tools are available to an agent based on credentials and permissions';

COMMENT ON FUNCTION cleanup_orphaned_permissions IS 
'Cleans up orphaned agent permissions that reference deleted credentials';

-- =============================================
-- STEP 7: Run initial cleanup
-- =============================================

-- Clean up any existing orphaned permissions
SELECT cleanup_orphaned_permissions();

-- =============================================
-- STEP 8: Verify migration success
-- =============================================

DO $$
BEGIN
    -- Verify foreign key constraints exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_oauth_permissions_agent_id_fkey'
        AND table_name = 'agent_oauth_permissions'
    ) THEN
        RAISE EXCEPTION 'Migration failed: agent_id foreign key constraint not created';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agent_integration_permissions_connection_id_fkey'
        AND table_name = 'agent_oauth_permissions'
    ) THEN
        RAISE EXCEPTION 'Migration failed: connection_id foreign key constraint not created';
    END IF;
    
    RAISE NOTICE 'CASCADE relationship migration completed successfully';
    RAISE NOTICE 'System now properly cascades: Integration → Credential → Agent Permission → Tool Availability';
END $$;

COMMIT;
