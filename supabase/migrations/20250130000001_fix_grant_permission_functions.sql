-- Fix grant_agent_integration_permission and revoke functions to use correct table names
-- Date: January 30, 2025
-- Purpose: Fix functions that still reference old table names after consolidation

BEGIN;

-- Update the grant function to use the correct table names
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
    
    -- Verify the connection belongs to the user (use correct table name)
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
    
    -- Insert or update the permission (use correct table and column names)
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
        expires_at = NULL,
        updated_at = NOW()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT) TO anon, authenticated;

-- Update the revoke function to use correct table names
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
    
    -- Verify the permission belongs to the user's agent (use correct table name)
    IF NOT EXISTS (
        SELECT 1 FROM agent_integration_permissions aip
        JOIN agents a ON aip.agent_id = a.id
        WHERE aip.id = p_permission_id AND a.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Permission not found or access denied';
    END IF;
    
    -- Mark the permission as inactive (use correct table name)
    UPDATE agent_integration_permissions 
    SET 
        is_active = false,
        expires_at = NOW(),
        updated_at = NOW()
    WHERE id = p_permission_id;
    
    RETURN true;
END;
$$;

-- Grant execute permissions for revoke function
GRANT EXECUTE ON FUNCTION public.revoke_agent_integration_permission(UUID) TO anon, authenticated;

-- Fix validate_agent_gmail_permissions function to use correct table names
CREATE OR REPLACE FUNCTION validate_agent_gmail_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_required_scopes TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_scope TEXT;
BEGIN
    -- Get allowed scopes for agent (use correct table name)
    SELECT aip.allowed_scopes INTO v_allowed_scopes
    FROM agent_integration_permissions aip
    JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id
    JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE aip.agent_id = p_agent_id 
    AND uic.user_id = p_user_id
    AND op.name = 'gmail'
    AND aip.is_active = true
    AND uic.connection_status = 'active';
    
    -- If no permissions found, return false
    IF v_allowed_scopes IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if all required scopes are in allowed scopes
    FOREACH v_scope IN ARRAY p_required_scopes
    LOOP
        IF NOT (v_allowed_scopes ? v_scope) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_agent_gmail_permissions(UUID, UUID, TEXT[]) TO anon, authenticated;

-- Fix get_user_gmail_connection function to use correct table names
CREATE OR REPLACE FUNCTION get_user_gmail_connection(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    connection_status TEXT,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY SELECT 
        uic.id,
        uic.connection_name,
        uic.external_username,
        uic.connection_status,
        COALESCE(gc.security_settings, '{}'::jsonb) as configuration
    FROM user_integration_credentials uic
    LEFT JOIN gmail_configurations gc ON gc.user_oauth_connection_id = uic.id
    WHERE uic.user_id = p_user_id 
    AND uic.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND uic.connection_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_gmail_connection(UUID) TO anon, authenticated;

-- Fix get_user_integration_credentials function to match existing signature
DROP FUNCTION IF EXISTS public.get_user_integration_credentials(UUID);

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
) AS $$
BEGIN
    -- Return data from the correct table name with all expected fields
    RETURN QUERY
    SELECT 
        uic.id as credential_id,
        op.name as provider_name,
        op.display_name as provider_display_name,
        uic.external_username,
        uic.connection_name,
        COALESCE(uic.scopes_granted, '{}'::jsonb) as scopes_granted,
        uic.connection_status,
        uic.credential_type,
        uic.token_expires_at,
        uic.created_at,
        uic.updated_at
    FROM user_integration_credentials uic
    LEFT JOIN service_providers op ON uic.oauth_provider_id = op.id
    WHERE uic.user_id = COALESCE(p_user_id, auth.uid())
    AND uic.connection_status != 'revoked'
    ORDER BY uic.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_integration_credentials(UUID) TO anon, authenticated;

-- Add updated comments
COMMENT ON FUNCTION public.grant_agent_integration_permission(UUID, UUID, JSONB, TEXT) IS 'Grant integration permission to an agent - Fixed to use agent_integration_permissions table';
COMMENT ON FUNCTION public.revoke_agent_integration_permission(UUID) IS 'Revoke integration permission from an agent - Fixed to use agent_integration_permissions table';
COMMENT ON FUNCTION validate_agent_gmail_permissions(UUID, UUID, TEXT[]) IS 'Validate agent Gmail permissions - Fixed to use agent_integration_permissions and user_integration_credentials tables';
COMMENT ON FUNCTION get_user_gmail_connection(UUID) IS 'Get user Gmail connection - Fixed to use user_integration_credentials table';

COMMIT;
