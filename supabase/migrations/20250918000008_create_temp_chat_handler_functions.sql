-- Migration: Create additional database functions for temporary chat handler
-- Description: Creates rate limiting and enhanced session validation functions

-- Function: check_temp_chat_rate_limit
-- Description: Checks if a session has exceeded its rate limit
CREATE OR REPLACE FUNCTION check_temp_chat_rate_limit(p_session_token TEXT)
RETURNS TABLE(
    allowed BOOLEAN,
    current_count INTEGER,
    limit_per_minute INTEGER,
    reset_time TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_rate_limit INTEGER;
    v_current_count INTEGER;
    v_window_start TIMESTAMPTZ;
BEGIN
    -- Get session info by decrypting token
    SELECT 
        tcs.id,
        tcl.rate_limit_per_minute
    INTO v_session_id, v_rate_limit
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    WHERE tcs.vault_session_token_id IN (
        SELECT vs.id 
        FROM vault.secrets vs 
        WHERE vault_decrypt(vs.id) = p_session_token
    )
    AND tcs.status = 'active'
    AND tcs.expires_at > NOW();

    -- If session not found, return not allowed
    IF v_session_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, NOW() + INTERVAL '1 minute';
        RETURN;
    END IF;

    -- Calculate current minute window
    v_window_start := DATE_TRUNC('minute', NOW());

    -- Count messages in current minute window
    SELECT COUNT(*)::INTEGER
    INTO v_current_count
    FROM chat_messages_v2 cm
    WHERE cm.conversation_id = (
        SELECT conversation_id 
        FROM temporary_chat_sessions 
        WHERE id = v_session_id
    )
    AND cm.role = 'user'
    AND cm.created_at >= v_window_start
    AND cm.created_at < v_window_start + INTERVAL '1 minute';

    -- Return rate limit check result
    RETURN QUERY SELECT 
        (v_current_count < v_rate_limit) AS allowed,
        v_current_count,
        v_rate_limit,
        v_window_start + INTERVAL '1 minute' AS reset_time;
END;
$$;

-- Function: Enhanced validate_temp_chat_session for handler
-- Description: Validates session and returns detailed session information
DROP FUNCTION IF EXISTS validate_temp_chat_session(TEXT);
CREATE OR REPLACE FUNCTION validate_temp_chat_session(p_session_token TEXT)
RETURNS TABLE(
    is_valid BOOLEAN,
    session_id UUID,
    conversation_id UUID,
    agent_id UUID,
    agent_name TEXT,
    current_message_count INTEGER,
    max_messages_per_session INTEGER,
    session_timeout_minutes INTEGER,
    link_title TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_record RECORD;
    v_message_count INTEGER;
BEGIN
    -- Get session details by decrypting token
    SELECT 
        tcs.id,
        tcs.conversation_id,
        tcs.expires_at,
        tcs.status,
        tcl.agent_id,
        tcl.title,
        tcl.max_messages_per_session,
        tcl.session_timeout_minutes,
        a.name as agent_name
    INTO v_session_record
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    JOIN agents a ON tcl.agent_id = a.id
    WHERE tcs.vault_session_token_id IN (
        SELECT vs.id 
        FROM vault.secrets vs 
        WHERE vault_decrypt(vs.id) = p_session_token
    );

    -- Check if session exists and is valid
    IF v_session_record.id IS NULL OR 
       v_session_record.status != 'active' OR 
       v_session_record.expires_at <= NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, NULL::UUID, NULL::TEXT, 0, 0, 0, NULL::TEXT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- Count current messages in the conversation
    SELECT COUNT(*)::INTEGER
    INTO v_message_count
    FROM chat_messages_v2 cm
    WHERE cm.conversation_id = v_session_record.conversation_id
    AND cm.role = 'user';

    -- Return valid session info
    RETURN QUERY SELECT 
        TRUE as is_valid,
        v_session_record.id as session_id,
        v_session_record.conversation_id,
        v_session_record.agent_id,
        v_session_record.agent_name,
        v_message_count as current_message_count,
        v_session_record.max_messages_per_session,
        v_session_record.session_timeout_minutes,
        v_session_record.title as link_title,
        v_session_record.expires_at;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_temp_chat_rate_limit(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION validate_temp_chat_session(TEXT) TO authenticated, anon;
