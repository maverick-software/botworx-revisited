-- Fix grant_agent_integration_permission function for renamed table
-- Date: January 25, 2025
-- Purpose: Update function to reference user_integration_credentials instead of user_oauth_connections

BEGIN;

-- Update the grant function to use the correct table name
CREATE OR REPLACE FUNCTION public.grant_agent_integration_permission(
    p_agent_id UUID,
    p_connection_id UUID,
    p_allowed_scopes JSONB,
    p_permission_level TEXT DEFAULT 'custom'
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
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the connection belongs to the user (use renamed table)
    IF NOT EXISTS (
        SELECT 1 FROM user_integration_credentials 
        WHERE id = p_connection_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Connection not found or access denied';
    END IF;
    
    -- Verify the agent belongs to the user
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Insert or update the permission
    INSERT INTO agent_oauth_permissions (
        agent_id,
        user_oauth_connection_id,
        allowed_scopes,
        permission_level,
        granted_by,
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
        granted_by = EXCLUDED.granted_by,
        is_active = true,
        granted_at = NOW(),
        revoked_at = NULL,
        revoked_by = NULL,
        updated_at = NOW()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT) TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT) IS 'Grant integration permission to an agent - Updated for user_integration_credentials table';

-- Also fix revoke function if it has the same issue
CREATE OR REPLACE FUNCTION public.revoke_agent_integration_permission(p_permission_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the current user ID
    v_user_id := auth.uid();
    
    -- Verify the permission belongs to the user's agent
    IF NOT EXISTS (
        SELECT 1 FROM agent_oauth_permissions aop
        JOIN agents a ON aop.agent_id = a.id
        WHERE aop.id = p_permission_id AND a.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Permission not found or access denied';
    END IF;
    
    -- Mark the permission as revoked
    UPDATE agent_oauth_permissions 
    SET 
        is_active = false,
        revoked_at = NOW(),
        revoked_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_permission_id;
    
    RETURN true;
END;
$$;

-- Grant execute permissions for revoke function
GRANT EXECUTE ON FUNCTION public.revoke_agent_integration_permission(UUID) TO anon, authenticated;

COMMIT;
