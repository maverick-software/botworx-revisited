-- Fix the validate_temp_chat_session function to use correct column references
CREATE OR REPLACE FUNCTION public.validate_temp_chat_session(p_session_token text)
RETURNS TABLE(
    is_valid boolean,
    session_id uuid,
    conversation_id uuid,
    agent_id uuid,
    agent_name text,
    current_message_count integer,
    max_messages_per_session integer,
    session_timeout_minutes integer,
    link_title text,
    expires_at timestamp with time zone
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
        tcl.expires_at,  -- Changed from tcs.expires_at to tcl.expires_at
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
