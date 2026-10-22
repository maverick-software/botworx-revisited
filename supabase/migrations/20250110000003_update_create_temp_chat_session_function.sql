-- Migration: Update create_temp_chat_session for Context Preservation
-- Description: Modifies session creation to use source conversation and send initial message
-- Date: 2025-01-10
-- Purpose: Enable temporary chats to link back to original conversation with automatic greeting

-- Drop existing function
DROP FUNCTION IF EXISTS create_temp_chat_session(TEXT, TEXT, TEXT, INET, TEXT, TEXT);

-- Recreate with enhanced functionality
CREATE OR REPLACE FUNCTION create_temp_chat_session(
  p_link_token TEXT,
  p_participant_identifier TEXT DEFAULT NULL,
  p_participant_name TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
) RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  conversation_id UUID,
  agent_id UUID,
  agent_name TEXT,
  is_valid BOOLEAN,
  error_message TEXT,
  initial_agent_message TEXT,  -- ✅ NEW: Return initial message to frontend
  should_send_initial BOOLEAN   -- ✅ NEW: Whether initial message was sent
)
SECURITY DEFINER
AS $$
DECLARE
  v_link_id UUID;
  v_agent_id UUID;
  v_agent_name TEXT;
  v_new_session_id UUID;
  v_new_session_token TEXT;
  v_vault_session_token_id UUID;
  v_source_conversation_id UUID;  -- ✅ NEW: Use existing conversation
  v_conversation_session_id UUID;
  v_current_sessions INTEGER;
  v_max_sessions INTEGER;
  v_is_active BOOLEAN;
  v_expires_at TIMESTAMPTZ;
  v_initial_agent_message TEXT;   -- ✅ NEW: Initial greeting
  v_send_initial BOOLEAN;          -- ✅ NEW: Auto-send flag
  v_chat_intent TEXT;              -- ✅ NEW: Purpose of chat
BEGIN
  -- Find and validate link token using Vault
  SELECT 
    tcl.id, 
    tcl.agent_id, 
    a.name, 
    tcl.max_sessions, 
    tcl.is_active, 
    tcl.expires_at,
    tcl.source_conversation_id,  -- ✅ NEW: Get source conversation
    tcl.initial_agent_message,   -- ✅ NEW: Get initial message
    tcl.send_initial_message,    -- ✅ NEW: Get auto-send flag
    tcl.chat_intent              -- ✅ NEW: Get intent
  INTO 
    v_link_id, 
    v_agent_id, 
    v_agent_name, 
    v_max_sessions, 
    v_is_active, 
    v_expires_at,
    v_source_conversation_id,
    v_initial_agent_message,
    v_send_initial,
    v_chat_intent
  FROM temporary_chat_links tcl
  JOIN agents a ON tcl.agent_id = a.id
  WHERE vault.decrypt_secret(tcl.vault_link_token_id) = p_link_token;
  
  -- Check if link exists
  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, 
      FALSE, 'Invalid chat link'::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Check if link is active and not expired
  IF NOT v_is_active OR v_expires_at <= NOW() THEN
    RETURN QUERY SELECT 
      NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, 
      FALSE, 'Chat link has expired'::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Check current active sessions count
  SELECT COUNT(*) INTO v_current_sessions
  FROM temporary_chat_sessions
  WHERE link_id = v_link_id AND status = 'active';
  
  -- Check session limit
  IF v_current_sessions >= v_max_sessions THEN
    RETURN QUERY SELECT 
      NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, 
      FALSE, 'Maximum sessions reached'::TEXT, NULL::TEXT, FALSE;
    RETURN;
  END IF;
  
  -- Generate new session components
  v_new_session_id := gen_random_uuid();
  v_vault_session_token_id := generate_session_token();
  
  -- ✅ CHANGED: Use source_conversation_id instead of generating new one
  -- If no source conversation exists, create a new one (backward compatibility)
  IF v_source_conversation_id IS NULL THEN
    v_source_conversation_id := gen_random_uuid();
    RAISE NOTICE '[create_temp_chat_session] No source_conversation_id found for link %. Creating new conversation: %', 
      v_link_id, v_source_conversation_id;
  ELSE
    RAISE NOTICE '[create_temp_chat_session] Using existing source_conversation_id: % for link %', 
      v_source_conversation_id, v_link_id;
  END IF;
  
  -- Get the actual session token for return (decrypt from vault)
  v_new_session_token := vault.decrypt_secret(v_vault_session_token_id);
  
  -- Create conversation session in existing table
  INSERT INTO conversation_sessions (
    id, 
    conversation_id,      -- ✅ CHANGED: Use source conversation
    agent_id, 
    status, 
    started_at
  ) VALUES (
    gen_random_uuid(), 
    v_source_conversation_id,  -- ✅ CHANGED: Links to original conversation
    v_agent_id, 
    'active', 
    NOW()
  ) RETURNING id INTO v_conversation_session_id;
  
  RAISE NOTICE '[create_temp_chat_session] Created conversation_session % for conversation %', 
    v_conversation_session_id, v_source_conversation_id;
  
  -- Create temporary chat session
  INSERT INTO temporary_chat_sessions (
    id, 
    link_id, 
    vault_session_token_id, 
    conversation_id,              -- ✅ CHANGED: Source conversation
    conversation_session_id,
    participant_identifier, 
    participant_name, 
    ip_address, 
    user_agent, 
    referrer
  ) VALUES (
    v_new_session_id, 
    v_link_id, 
    v_vault_session_token_id, 
    v_source_conversation_id,  -- ✅ CHANGED: Links back to original
    v_conversation_session_id,
    p_participant_identifier, 
    p_participant_name, 
    p_ip_address, 
    p_user_agent, 
    p_referrer
  );
  
  RAISE NOTICE '[create_temp_chat_session] Created temporary_chat_session %', v_new_session_id;
  
  -- ✅ NEW: If should_send_initial is true and message exists, insert initial agent message
  IF v_send_initial AND v_initial_agent_message IS NOT NULL THEN
    RAISE NOTICE '[create_temp_chat_session] Sending initial agent message to conversation %', v_source_conversation_id;
    
    INSERT INTO chat_messages_v2 (
      conversation_id,
      session_id,
      role,
      content,
      sender_user_id,
      sender_agent_id
    ) VALUES (
      v_source_conversation_id,
      v_conversation_session_id,
      'assistant',
      jsonb_build_object(
        'text', v_initial_agent_message,
        'type', 'text',
        'metadata', jsonb_build_object(
          'temporary_chat', true,
          'temp_session_id', v_new_session_id,
          'temp_link_id', v_link_id,
          'is_initial_greeting', true,
          'chat_intent', v_chat_intent,
          'participant_name', p_participant_name
        )
      ),
      NULL,      -- No user_id (sent by system)
      v_agent_id -- Sent by agent
    );
    
    RAISE NOTICE '[create_temp_chat_session] Initial agent message inserted successfully';
  ELSE
    RAISE NOTICE '[create_temp_chat_session] No initial message to send (send_initial: %, message exists: %)', 
      v_send_initial, v_initial_agent_message IS NOT NULL;
  END IF;
  
  -- Return success with initial message info
  RETURN QUERY SELECT 
    v_new_session_id, 
    v_new_session_token, 
    v_source_conversation_id,  -- ✅ CHANGED: Returns source conversation
    v_agent_id, 
    v_agent_name, 
    TRUE, 
    ''::TEXT,
    v_initial_agent_message,  -- ✅ NEW: Initial message for frontend
    v_send_initial            -- ✅ NEW: Whether it was sent
  ;
  
  RAISE NOTICE '[create_temp_chat_session] Session creation completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Update function comment
COMMENT ON FUNCTION create_temp_chat_session IS 
  'Creates a new temporary chat session linked to the source conversation from the temporary_chat_link. Automatically sends the initial agent message if configured (send_initial_message=true and initial_agent_message is not null). Returns session details including initial message information for frontend display. Maintains backward compatibility by creating a new conversation_id if no source_conversation_id is specified in the link.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration: 20250110000003_update_create_temp_chat_session_function';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Status: COMPLETED';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated create_temp_chat_session function:';
  RAISE NOTICE '  ✓ Now uses source_conversation_id for context preservation';
  RAISE NOTICE '  ✓ Automatically sends initial agent message when configured';
  RAISE NOTICE '  ✓ Returns initial message info to frontend';
  RAISE NOTICE '  ✓ Maintains backward compatibility for links without source';
  RAISE NOTICE '';
  RAISE NOTICE 'New return columns:';
  RAISE NOTICE '  ✓ initial_agent_message - The greeting message (if any)';
  RAISE NOTICE '  ✓ should_send_initial - Whether message was auto-sent';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact: Temporary chat sessions now link back to original';
  RAISE NOTICE 'conversations and proactively engage users with greeting messages.';
  RAISE NOTICE '=================================================================';
END $$;

