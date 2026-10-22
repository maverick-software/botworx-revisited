-- Fix the check_temp_chat_rate_limit function to properly cast UUID to TEXT for vault_decrypt
CREATE OR REPLACE FUNCTION public.check_temp_chat_rate_limit(p_session_token text)
RETURNS TABLE(allowed boolean, current_count integer, limit_per_minute integer, reset_time timestamp with time zone)
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
        WHERE vault_decrypt(vs.id::TEXT) = p_session_token  -- Cast UUID to TEXT
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
