-- Fix vault function names in create_temp_chat_session
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
  error_message TEXT
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
  v_new_conversation_id UUID;
  v_conversation_session_id UUID;
  v_current_sessions INTEGER;
  v_max_sessions INTEGER;
  v_is_active BOOLEAN;
  v_expires_at TIMESTAMPTZ;
  v_vault_link_token_id UUID;
  v_decrypted_token TEXT;
BEGIN
  -- Find and validate link token using Vault
  -- We need to check all links and decrypt their tokens to find a match
  FOR v_link_id, v_agent_id, v_agent_name, v_max_sessions, v_is_active, v_expires_at, v_vault_link_token_id IN
    SELECT tcl.id, tcl.agent_id, a.name, tcl.max_sessions, tcl.is_active, tcl.expires_at, tcl.vault_link_token_id
    FROM temporary_chat_links tcl
    JOIN agents a ON tcl.agent_id = a.id
    WHERE tcl.is_active = true
  LOOP
    -- Decrypt and compare token
    v_decrypted_token := vault_decrypt(v_vault_link_token_id::TEXT);
    
    -- Remove whitespace for comparison
    IF REPLACE(REPLACE(v_decrypted_token, E'\n', ''), ' ', '') = REPLACE(REPLACE(p_link_token, E'\n', ''), ' ', '') THEN
      -- Found matching link
      EXIT;
    ELSE
      -- Reset variables if not matching
      v_link_id := NULL;
    END IF;
  END LOOP;
  
  -- Check if link exists
  IF v_link_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, FALSE, 'Invalid chat link'::TEXT;
    RETURN;
  END IF;
  
  -- Check if link is active and not expired
  IF NOT v_is_active OR v_expires_at <= NOW() THEN
    RETURN QUERY SELECT NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, FALSE, 'Chat link has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check current active sessions count
  SELECT COUNT(*) INTO v_current_sessions
  FROM temporary_chat_sessions
  WHERE link_id = v_link_id AND status = 'active';
  
  -- Check session limit
  IF v_current_sessions >= v_max_sessions THEN
    RETURN QUERY SELECT NULL::UUID, ''::TEXT, NULL::UUID, NULL::UUID, ''::TEXT, FALSE, 'Maximum sessions reached'::TEXT;
    RETURN;
  END IF;
  
  -- Generate new session components
  v_new_session_id := gen_random_uuid();
  v_vault_session_token_id := generate_session_token();
  v_new_conversation_id := gen_random_uuid();
  
  -- Get the actual session token for return (decrypt from vault)
  v_new_session_token := vault_decrypt(v_vault_session_token_id::TEXT);
  
  -- Create conversation session in existing table
  INSERT INTO conversation_sessions (
    id, conversation_id, agent_id, status, started_at
  ) VALUES (
    gen_random_uuid(), v_new_conversation_id, v_agent_id, 'active', NOW()
  ) RETURNING id INTO v_conversation_session_id;
  
  -- Create temporary chat session
  INSERT INTO temporary_chat_sessions (
    id, link_id, vault_session_token_id, conversation_id, conversation_session_id,
    participant_identifier, participant_name, ip_address, user_agent, referrer
  ) VALUES (
    v_new_session_id, v_link_id, v_vault_session_token_id, v_new_conversation_id, v_conversation_session_id,
    p_participant_identifier, p_participant_name, p_ip_address, p_user_agent, p_referrer
  );
  
  -- Update link session count
  UPDATE temporary_chat_links 
  SET session_count = session_count + 1,
      last_accessed_at = NOW()
  WHERE id = v_link_id;
  
  -- Return success
  RETURN QUERY SELECT 
    v_new_session_id, v_new_session_token, v_new_conversation_id, 
    v_agent_id, v_agent_name, TRUE, ''::TEXT;
END;
$$ LANGUAGE plpgsql;
