-- Fix the get_agent_integration_permissions function to only return active permissions
CREATE OR REPLACE FUNCTION public.get_agent_integration_permissions(p_agent_id UUID)
RETURNS TABLE (
    permission_id UUID,
    agent_id UUID,
    connection_id UUID,
    connection_name TEXT,
    external_username TEXT,
    provider_name TEXT,
    provider_display_name TEXT,
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
        uoc.connection_name,
        uoc.external_username,
        op.name AS provider_name,
        op.display_name AS provider_display_name,
        aop.allowed_scopes,
        aop.is_active,
        aop.permission_level,
        aop.granted_at,
        aop.granted_by_user_id
    FROM agent_oauth_permissions aop
    INNER JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    INNER JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = auth.uid()
    AND aop.is_active = true
    ORDER BY aop.granted_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_agent_integration_permissions(UUID) TO anon, authenticated;
