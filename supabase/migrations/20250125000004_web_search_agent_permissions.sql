-- Web Search Agent Permissions Management Functions
-- Date: January 25, 2025
-- Purpose: Add RPC functions to manage agent web search permissions

-- Function to get agent web search permissions (similar to get_agent_integration_permissions)
CREATE OR REPLACE FUNCTION get_agent_web_search_permissions(
    p_agent_id UUID
)
RETURNS TABLE(
    permission_id UUID,
    agent_id UUID,
    provider_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    key_id UUID,
    key_name TEXT,
    permissions JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        awsp.id as permission_id,
        awsp.agent_id,
        awsp.provider_id,
        wsp.name as provider_name,
        wsp.display_name as provider_display_name,
        awsp.user_key_id as key_id,
        uwsk.key_name,
        awsp.permissions,
        awsp.is_active,
        awsp.created_at
    FROM agent_web_search_permissions awsp
    JOIN web_search_providers wsp ON awsp.provider_id = wsp.id
    JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
    WHERE awsp.agent_id = p_agent_id
        AND awsp.user_id = auth.uid()
    ORDER BY wsp.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant agent web search permissions
CREATE OR REPLACE FUNCTION grant_agent_web_search_permission(
    p_agent_id UUID,
    p_user_key_id UUID,
    p_permissions JSONB
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_provider_id UUID;
    v_permission_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Get provider_id from the user_key_id
    SELECT provider_id INTO v_provider_id
    FROM user_web_search_keys 
    WHERE id = p_user_key_id 
        AND user_id = v_user_id;
    
    IF v_provider_id IS NULL THEN
        RAISE EXCEPTION 'Invalid user key ID or insufficient permissions';
    END IF;
    
    -- Insert or update the permission
    INSERT INTO agent_web_search_permissions (
        agent_id,
        user_id,
        provider_id,
        user_key_id,
        permissions,
        is_active
    ) VALUES (
        p_agent_id,
        v_user_id,
        v_provider_id,
        p_user_key_id,
        p_permissions,
        true
    )
    ON CONFLICT (agent_id, provider_id) 
    DO UPDATE SET
        user_key_id = EXCLUDED.user_key_id,
        permissions = EXCLUDED.permissions,
        is_active = EXCLUDED.is_active,
        updated_at = now()
    RETURNING id INTO v_permission_id;
    
    RETURN v_permission_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke agent web search permissions
CREATE OR REPLACE FUNCTION revoke_agent_web_search_permission(
    p_agent_id UUID,
    p_provider_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Deactivate the permission
    UPDATE agent_web_search_permissions 
    SET is_active = false, updated_at = now()
    WHERE agent_id = p_agent_id 
        AND provider_id = p_provider_id
        AND user_id = v_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's available web search keys (for dropdown selection)
CREATE OR REPLACE FUNCTION get_user_web_search_keys()
RETURNS TABLE(
    key_id UUID,
    key_name TEXT,
    provider_id UUID,
    provider_name TEXT,
    provider_display_name TEXT,
    key_status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uwsk.id as key_id,
        uwsk.key_name,
        uwsk.provider_id,
        wsp.name as provider_name,
        wsp.display_name as provider_display_name,
        uwsk.key_status,
        uwsk.created_at
    FROM user_web_search_keys uwsk
    JOIN web_search_providers wsp ON uwsk.provider_id = wsp.id
    WHERE uwsk.user_id = auth.uid()
        AND uwsk.key_status = 'active'
        AND wsp.is_enabled = true
    ORDER BY wsp.display_name, uwsk.key_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the validate_web_search_permissions function to use simpler parameters
-- (to match the function calling system's usage)
CREATE OR REPLACE FUNCTION validate_web_search_permissions(
    p_agent_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS(
        SELECT 1 
        FROM agent_web_search_permissions awsp
        JOIN user_web_search_keys uwsk ON awsp.user_key_id = uwsk.id
        JOIN web_search_providers wsp ON awsp.provider_id = wsp.id
        WHERE awsp.agent_id = p_agent_id
            AND awsp.user_id = p_user_id
            AND awsp.is_active = true
            AND uwsk.key_status = 'active'
            AND wsp.is_enabled = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_agent_web_search_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_agent_web_search_permission(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_agent_web_search_permission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_web_search_keys() TO authenticated; 