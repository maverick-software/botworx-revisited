-- Fix grant function to use correct table name
-- Date: January 25, 2025
-- Purpose: Update grant function to use agent_integration_permissions instead of old table name

BEGIN;

-- Update the grant function to use the correct table name
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
    
    -- Insert or update the permission using CORRECT table name
    INSERT INTO agent_integration_permissions (
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        granted_by_user_id,
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT, UUID) TO anon, authenticated, service_role;

-- Update comment
COMMENT ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT, UUID) IS 'Grant integration permission to an agent - Uses agent_integration_permissions table for ALL integration types';

-- Verification
DO $$
BEGIN
    RAISE NOTICE '✅ Grant function updated to use agent_integration_permissions table';
    RAISE NOTICE '✅ Function now correctly references the renamed table';
END $$;

COMMIT;
