-- Migration: Update validate_temp_chat_session to Include Context Fields
-- Description: Adds chat_intent and system_prompt_override to session validation return
-- Date: 2025-01-10
-- Purpose: Enable temporary-chat-handler to pass context-specific instructions to chat function

-- Drop existing function
DROP FUNCTION IF EXISTS validate_temp_chat_session(TEXT);

-- Recreate with context fields
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
    expires_at TIMESTAMPTZ,
    -- ✅ NEW: Context preservation fields
    chat_intent TEXT,
    system_prompt_override TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_record RECORD;
    v_message_count INTEGER;
BEGIN
    -- Get session details by decrypting token (including new context fields)
    SELECT 
        tcs.id,
        tcs.conversation_id,
        tcs.expires_at,
        tcs.status,
        tcl.agent_id,
        tcl.title,
        tcl.max_messages_per_session,
        tcl.session_timeout_minutes,
        tcl.chat_intent,               -- ✅ NEW
        tcl.system_prompt_override,    -- ✅ NEW
        a.name as agent_name
    INTO v_session_record
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    JOIN agents a ON tcl.agent_id = a.id
    WHERE tcs.vault_session_token_id IN (
        SELECT vs.id 
        FROM vault.secrets vs 
        WHERE vault.decrypt_secret(vs.id) = p_session_token
    );

    -- Check if session exists and is valid
    IF v_session_record.id IS NULL OR 
       v_session_record.status != 'active' OR 
       v_session_record.expires_at <= NOW() THEN
        RETURN QUERY SELECT 
          FALSE, 
          NULL::UUID, 
          NULL::UUID, 
          NULL::UUID, 
          NULL::TEXT, 
          0, 
          0, 
          0, 
          NULL::TEXT, 
          NULL::TIMESTAMPTZ,
          NULL::TEXT,  -- chat_intent
          NULL::TEXT;  -- system_prompt_override
        RETURN;
    END IF;

    -- Count current messages in the conversation
    SELECT COUNT(*)::INTEGER
    INTO v_message_count
    FROM chat_messages_v2 cm
    WHERE cm.conversation_id = v_session_record.conversation_id
    AND cm.role = 'user';

    -- Return valid session info with context fields
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
        v_session_record.expires_at,
        v_session_record.chat_intent,              -- ✅ NEW
        v_session_record.system_prompt_override;   -- ✅ NEW
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_temp_chat_session(TEXT) TO authenticated, anon;

-- Update function comment
COMMENT ON FUNCTION validate_temp_chat_session IS 
  'Validates a temporary chat session token and returns detailed session information including context preservation fields (chat_intent, system_prompt_override) for agent behavior customization. Used by temporary-chat-handler to retrieve instructions before calling the main chat function.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration: 20250110000004_update_validate_temp_chat_session_context_fields';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Status: COMPLETED';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated validate_temp_chat_session function:';
  RAISE NOTICE '  ✓ Added chat_intent return field';
  RAISE NOTICE '  ✓ Added system_prompt_override return field';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact: temporary-chat-handler can now retrieve and pass';
  RAISE NOTICE 'context-specific instructions to the main chat function for';
  RAISE NOTICE 'customized agent behavior in temporary chats.';
  RAISE NOTICE '=================================================================';
END $$;

