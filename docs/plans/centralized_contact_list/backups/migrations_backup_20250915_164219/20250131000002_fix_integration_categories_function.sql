-- Fix missing get_integration_categories_with_counts function
-- This ensures the function exists for the integrations page

-- Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION get_integration_categories_with_counts(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    icon_name TEXT,
    display_order INTEGER,
    total_integrations BIGINT,
    available_integrations BIGINT,
    user_connected_integrations BIGINT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    -- Since we're transitioning to service_providers, return basic category data
    -- This is a temporary function to prevent 404 errors while the frontend uses service_providers
    
    RETURN QUERY
    SELECT 
        gen_random_uuid() as id,
        'API Integrations'::TEXT as name,
        'Connect to external APIs and services'::TEXT as description,
        'Globe'::TEXT as icon_name,
        1 as display_order,
        COALESCE((SELECT COUNT(*) FROM service_providers WHERE is_enabled = true), 0)::BIGINT as total_integrations,
        COALESCE((SELECT COUNT(*) FROM service_providers WHERE is_enabled = true), 0)::BIGINT as available_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM user_integration_credentials uic 
            JOIN service_providers sp ON uic.oauth_provider_id = sp.id 
            WHERE uic.user_id = COALESCE(p_user_id, uic.user_id) 
            AND uic.connection_status = 'active'
        ), 0)::BIGINT as user_connected_integrations
    
    UNION ALL
    
    SELECT 
        gen_random_uuid() as id,
        'Messaging & Communication'::TEXT as name,
        'Communication and messaging platforms'::TEXT as description,
        'MessageSquare'::TEXT as icon_name,
        2 as display_order,
        COALESCE((
            SELECT COUNT(*) 
            FROM service_providers 
            WHERE is_enabled = true 
            AND name IN ('gmail', 'smtp', 'sendgrid', 'mailgun', 'discord')
        ), 0)::BIGINT as total_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM service_providers 
            WHERE is_enabled = true 
            AND name IN ('gmail', 'smtp', 'sendgrid', 'mailgun', 'discord')
        ), 0)::BIGINT as available_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM user_integration_credentials uic 
            JOIN service_providers sp ON uic.oauth_provider_id = sp.id 
            WHERE uic.user_id = COALESCE(p_user_id, uic.user_id) 
            AND uic.connection_status = 'active'
            AND sp.name IN ('gmail', 'smtp', 'sendgrid', 'mailgun', 'discord')
        ), 0)::BIGINT as user_connected_integrations
    
    UNION ALL
    
    SELECT 
        gen_random_uuid() as id,
        'Database Connectors'::TEXT as name,
        'Connect to various database systems'::TEXT as description,
        'Database'::TEXT as icon_name,
        3 as display_order,
        COALESCE((
            SELECT COUNT(*) 
            FROM service_providers 
            WHERE is_enabled = true 
            AND name IN ('pinecone', 'getzep')
        ), 0)::BIGINT as total_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM service_providers 
            WHERE is_enabled = true 
            AND name IN ('pinecone', 'getzep')
        ), 0)::BIGINT as available_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM user_integration_credentials uic 
            JOIN service_providers sp ON uic.oauth_provider_id = sp.id 
            WHERE uic.user_id = COALESCE(p_user_id, uic.user_id) 
            AND uic.connection_status = 'active'
            AND sp.name IN ('pinecone', 'getzep')
        ), 0)::BIGINT as user_connected_integrations
    
    UNION ALL
    
    SELECT 
        gen_random_uuid() as id,
        'Cloud Services'::TEXT as name,
        'Cloud platforms and services'::TEXT as description,
        'Cloud'::TEXT as icon_name,
        4 as display_order,
        COALESCE((
            SELECT COUNT(*) 
            FROM service_providers 
            WHERE is_enabled = true 
            AND name IN ('digitalocean')
        ), 0)::BIGINT as total_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM service_providers 
            WHERE is_enabled = true 
            AND name IN ('digitalocean')
        ), 0)::BIGINT as available_integrations,
        COALESCE((
            SELECT COUNT(*) 
            FROM user_integration_credentials uic 
            JOIN service_providers sp ON uic.oauth_provider_id = sp.id 
            WHERE uic.user_id = COALESCE(p_user_id, uic.user_id) 
            AND uic.connection_status = 'active'
            AND sp.name IN ('digitalocean')
        ), 0)::BIGINT as user_connected_integrations;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_integration_categories_with_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_integration_categories_with_counts TO anon;
