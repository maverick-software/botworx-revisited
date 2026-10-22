-- Fix the agent integration permissions to show all permissions for agents owned by the user
-- The previous version incorrectly filtered by connection owner instead of agent owner

CREATE OR REPLACE FUNCTION public.get_agent_integration_permissions(p_agent_id UUID)
RETURNS TABLE (
    permission_id UUID,
    agent_id UUID,
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    provider_name TEXT,
    provider_display_name TEXT,
    integration_name TEXT,
    allowed_scopes JSONB,
    is_active BOOLEAN,
    permission_level TEXT,
    granted_at TIMESTAMPTZ,
    granted_by_user_id UUID
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        aop.id AS permission_id,
        aop.agent_id,
        uoc.id AS connection_id,
        COALESCE(uoc.connection_name, op.display_name || ' Connection') AS connection_name,
        uoc.external_username,
        op.name AS provider_name,
        op.display_name AS provider_display_name,
        op.display_name AS integration_name,
        aop.allowed_scopes,
        aop.is_active,
        aop.permission_level,
        aop.granted_at,
        aop.granted_by_user_id
    FROM agent_oauth_permissions aop
    INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    INNER JOIN agents a ON a.id = aop.agent_id
    WHERE aop.agent_id = p_agent_id
    AND aop.is_active = true
    AND uoc.connection_status = 'active'
    -- Check that the current user owns the agent (not the connection)
    AND (
        a.user_id = auth.uid() 
        OR a.created_by = auth.uid()
        -- Also allow team members to see agent permissions
        OR EXISTS (
            SELECT 1 FROM team_agents ta
            INNER JOIN user_team_memberships utm ON utm.team_id = ta.team_id
            WHERE ta.agent_id = a.id AND utm.user_id = auth.uid()
        )
    )
    ORDER BY aop.granted_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_agent_integration_permissions(UUID) TO anon, authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION public.get_agent_integration_permissions(UUID) IS 'Get all active integration permissions for an agent owned by or shared with the current user';