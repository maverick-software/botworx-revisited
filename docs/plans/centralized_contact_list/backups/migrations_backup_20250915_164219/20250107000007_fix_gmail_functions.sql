-- Fix missing Gmail integration functions
-- This ensures the get_user_gmail_connection function exists

-- Drop existing function first to avoid signature conflicts
DROP FUNCTION IF EXISTS get_user_gmail_connection(UUID);

-- Function to get Gmail connection for user
CREATE OR REPLACE FUNCTION get_user_gmail_connection(p_user_id UUID)
RETURNS TABLE (
    connection_id UUID,
    external_username TEXT,
    scopes_granted JSONB,
    connection_status TEXT,
    connection_metadata JSONB,
    configuration JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uoc.id,
        uoc.external_username,
        uoc.scopes_granted,
        uoc.connection_status,
        uoc.connection_metadata,
        COALESCE(gc.security_settings, '{}'::jsonb) as configuration
    FROM user_oauth_connections uoc
    LEFT JOIN gmail_configurations gc ON gc.user_oauth_connection_id = uoc.id
    WHERE uoc.user_id = p_user_id 
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail')
    AND uoc.connection_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate agent Gmail permissions
CREATE OR REPLACE FUNCTION validate_agent_gmail_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_required_scopes TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_granted_scopes JSONB;
    v_scope TEXT;
BEGIN
    -- Get granted scopes for agent
    SELECT aop.granted_scopes INTO v_granted_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND aop.is_active = true
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
    
    -- Check if agent has permissions
    IF v_granted_scopes IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Validate each required scope
    FOREACH v_scope IN ARRAY p_required_scopes
    LOOP
        IF NOT (v_granted_scopes ? v_scope) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_gmail_connection(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_agent_gmail_permissions(UUID, UUID, TEXT[]) TO anon, authenticated;

-- Verify functions exist
DO $$
BEGIN
    RAISE NOTICE 'Gmail functions created successfully';
    RAISE NOTICE 'Function get_user_gmail_connection exists: %', (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_user_gmail_connection'));
    RAISE NOTICE 'Function validate_agent_gmail_permissions exists: %', (SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'validate_agent_gmail_permissions'));
END $$; 