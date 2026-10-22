-- Fix and rename agent permissions table
-- Date: January 25, 2025
-- Purpose: Fix grant function and rename table to agent_integration_permissions

BEGIN;

-- =============================================
-- STEP 1: Fix the grant function with correct column names
-- =============================================

CREATE OR REPLACE FUNCTION public.grant_agent_integration_permission(
    p_agent_id UUID,
    p_connection_id UUID,
    p_allowed_scopes JSONB,
    p_permission_level TEXT DEFAULT 'custom',
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_permission_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the user ID (from auth or parameter)
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Validate we have a user ID
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID required: either authenticate or provide p_user_id parameter';
    END IF;
    
    -- Verify the connection belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM user_integration_credentials 
        WHERE id = p_connection_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Connection not found or access denied for user %', v_user_id;
    END IF;
    
    -- Verify the agent belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied for user %', v_user_id;
    END IF;
    
    -- Insert or update the permission using CORRECT column names
    INSERT INTO agent_oauth_permissions (
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        granted_by_user_id,  -- ← CORRECT COLUMN NAME
        is_active
    ) VALUES (
        p_agent_id,
        p_connection_id,
        p_allowed_scopes,
        p_permission_level,
        v_user_id,
        true
    )
    ON CONFLICT (agent_id, user_oauth_connection_id)
    DO UPDATE SET
        allowed_scopes = EXCLUDED.allowed_scopes,
        permission_level = EXCLUDED.permission_level,
        granted_by_user_id = EXCLUDED.granted_by_user_id,
        is_active = true,
        granted_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;

-- =============================================
-- STEP 2: Rename the table to better name
-- =============================================

-- Rename the table
ALTER TABLE agent_oauth_permissions RENAME TO agent_integration_permissions;

-- Rename the primary key constraint
ALTER TABLE agent_integration_permissions 
RENAME CONSTRAINT agent_oauth_permissions_pkey TO agent_integration_permissions_pkey;

-- Rename the unique constraint
ALTER TABLE agent_integration_permissions
RENAME CONSTRAINT uq_agent_oauth_connection TO uq_agent_integration_connection;

-- Rename foreign key constraints
ALTER TABLE agent_integration_permissions
RENAME CONSTRAINT agent_oauth_permissions_agent_id_fkey TO agent_integration_permissions_agent_id_fkey;

ALTER TABLE agent_integration_permissions
RENAME CONSTRAINT agent_oauth_permissions_granted_by_user_id_fkey TO agent_integration_permissions_granted_by_user_id_fkey;

-- The connection constraint already has the good name: agent_integration_permissions_connection_id_fkey

-- Rename permission level check constraint  
ALTER TABLE agent_integration_permissions
RENAME CONSTRAINT agent_oauth_permissions_permission_level_check TO agent_integration_permissions_permission_level_check;

-- Rename indexes
ALTER INDEX idx_agent_oauth_permissions_agent_connection 
RENAME TO idx_agent_integration_permissions_agent_connection;

ALTER INDEX idx_agent_oauth_permissions_agent_id 
RENAME TO idx_agent_integration_permissions_agent_id;

-- =============================================
-- STEP 3: Create backward compatibility view
-- =============================================

-- Create view with old name for backward compatibility
CREATE VIEW agent_oauth_permissions AS 
SELECT * FROM agent_integration_permissions;

-- Grant permissions on the view
GRANT ALL ON agent_oauth_permissions TO authenticated, service_role;

-- =============================================
-- STEP 4: Update comments and documentation
-- =============================================

COMMENT ON TABLE agent_integration_permissions IS 'Agent permissions for ALL integration types (OAuth, API keys, SMTP, etc.) - Renamed from agent_oauth_permissions for better clarity';

COMMENT ON VIEW agent_oauth_permissions IS 'DEPRECATED: Use agent_integration_permissions instead. This view exists for backward compatibility only.';

-- Update function comment
COMMENT ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT, UUID) IS 'Grant integration permission to an agent - Works with ALL integration types (OAuth, API keys, SMTP, etc.)';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT, UUID) TO anon, authenticated, service_role;

-- =============================================
-- STEP 5: Verification
-- =============================================

DO $$
BEGIN
    -- Verify the new table exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'agent_integration_permissions' 
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Migration failed: agent_integration_permissions table not found';
    END IF;
    
    -- Verify backward compatibility view exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'agent_oauth_permissions'
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Migration failed: agent_oauth_permissions compatibility view not found';
    END IF;
    
    RAISE NOTICE '✅ Successfully renamed agent_oauth_permissions → agent_integration_permissions';
    RAISE NOTICE '✅ Fixed grant function to use correct column names';
    RAISE NOTICE '✅ Created backward compatibility view';
    RAISE NOTICE '✅ Table now properly represents ALL integration types (OAuth, API keys, SMTP, etc.)';
END $$;

COMMIT;
