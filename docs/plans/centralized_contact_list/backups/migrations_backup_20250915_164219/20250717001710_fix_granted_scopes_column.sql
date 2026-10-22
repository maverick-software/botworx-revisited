-- Fix column name references from granted_scopes to allowed_scopes

-- Drop existing functions that use wrong column name
DROP FUNCTION IF EXISTS validate_agent_gmail_permissions(UUID, UUID, TEXT[]);
DROP FUNCTION IF EXISTS get_gmail_tools(UUID, UUID);

-- Recreate function to validate agent Gmail permissions with correct column name
CREATE OR REPLACE FUNCTION validate_agent_gmail_permissions(
    p_agent_id UUID,
    p_user_id UUID,
    p_required_scopes TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_scope TEXT;
BEGIN
    -- Get allowed scopes for agent (using correct column name)
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND aop.is_active = true
    AND uoc.oauth_provider_id = (SELECT id FROM service_providers WHERE name = 'gmail');
    
    -- Check if agent has permissions
    IF v_allowed_scopes IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Validate each required scope (support short names and full URLs)
    FOREACH v_scope IN ARRAY p_required_scopes
    LOOP
        -- Normalize required scope
        -- Strip common prefix to compare against short names stored in allowed_scopes
        -- Example: 'https://www.googleapis.com/auth/gmail.send' -> 'gmail.send'
        IF NOT (
            v_allowed_scopes ? v_scope OR
            v_allowed_scopes ? replace(v_scope, 'https://www.googleapis.com/auth/', '') OR
            v_allowed_scopes ? replace(v_scope, 'https://mail.google.com/', 'mail.google.com')
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate get_gmail_tools function with correct column reference
CREATE OR REPLACE FUNCTION get_gmail_tools(
    p_agent_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_allowed_scopes JSONB;
    v_tools JSONB = '[]'::jsonb;
    v_has_send BOOLEAN = FALSE;
    v_has_read BOOLEAN = FALSE;
    v_has_modify BOOLEAN = FALSE;
BEGIN
    -- Get allowed scopes for agent (using correct column name)
    SELECT aop.allowed_scopes INTO v_allowed_scopes
    FROM agent_oauth_permissions aop
    JOIN user_oauth_connections uoc ON uoc.id = aop.user_oauth_connection_id
    JOIN service_providers op ON op.id = uoc.oauth_provider_id
    WHERE aop.agent_id = p_agent_id
    AND uoc.user_id = p_user_id
    AND op.name = 'gmail'
    AND aop.is_active = true;
    
    -- Check if agent has permissions
    IF v_allowed_scopes IS NULL THEN
        RETURN v_tools;
    END IF;
    
    -- Check which scopes are granted
    v_has_send := v_allowed_scopes ? 'https://www.googleapis.com/auth/gmail.send';
    v_has_read := v_allowed_scopes ? 'https://www.googleapis.com/auth/gmail.readonly';
    v_has_modify := v_allowed_scopes ? 'https://www.googleapis.com/auth/gmail.modify';
    
    -- Build tools array based on granted scopes
    IF v_has_send THEN
        v_tools := v_tools || jsonb_build_object(
            'name', 'send_email',
            'description', 'Send an email through Gmail',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.send']
        );
    END IF;
    
    IF v_has_read THEN
        v_tools := v_tools || jsonb_build_object(
            'name', 'read_emails',
            'description', 'Read emails from Gmail',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.readonly']
        );
        
        v_tools := v_tools || jsonb_build_object(
            'name', 'search_emails',
            'description', 'Search emails in Gmail',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.readonly']
        );
    END IF;
    
    IF v_has_modify THEN
        v_tools := v_tools || jsonb_build_object(
            'name', 'email_actions',
            'description', 'Perform actions on emails (mark read, archive, etc)',
            'scopes', ARRAY['https://www.googleapis.com/auth/gmail.modify']
        );
    END IF;
    
    RETURN v_tools;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 