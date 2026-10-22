-- Migration: Create Temporary Chat Functions and Cleanup Jobs
-- Description: Core functions for temporary chat links with Vault integration and automated cleanup
-- Date: 2025-09-18

-- =============================================================================
-- CORE UTILITY FUNCTIONS
-- =============================================================================

-- Function: Generate secure link token and store in Vault
CREATE OR REPLACE FUNCTION generate_temp_chat_token()
RETURNS UUID AS $$
DECLARE
  token_uuid UUID;
  timestamp_part TEXT;
  random_part TEXT;
  final_token TEXT;
  vault_secret_id UUID;
BEGIN
  -- Generate components for cryptographically secure token
  token_uuid := gen_random_uuid();
  timestamp_part := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  random_part := encode(gen_random_bytes(16), 'base64');
  
  -- Clean up base64 for URL safety
  random_part := replace(replace(random_part, '+', '-'), '/', '_');
  random_part := rtrim(random_part, '=');
  
  -- Combine components for final token
  final_token := encode(
    (token_uuid::TEXT || '-' || timestamp_part || '-' || random_part)::BYTEA,
    'base64'
  );
  
  -- Make URL safe
  final_token := replace(replace(final_token, '+', '-'), '/', '_');
  final_token := rtrim(final_token, '=');
  
  -- Store token in Vault and return the vault secret ID
  vault_secret_id := vault.create_secret(final_token);
  
  RETURN vault_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Generate session token and store in Vault
CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS UUID AS $$
DECLARE
  session_uuid UUID;
  timestamp_part TEXT;
  final_token TEXT;
  vault_secret_id UUID;
BEGIN
  session_uuid := gen_random_uuid();
  timestamp_part := EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  
  final_token := encode(
    (session_uuid::TEXT || '-' || timestamp_part)::BYTEA,
    'base64'
  );
  
  -- Make URL safe
  final_token := replace(replace(final_token, '+', '-'), '/', '_');
  final_token := rtrim(final_token, '=');
  
  -- Store token in Vault and return the vault secret ID
  vault_secret_id := vault.create_secret(final_token);
  
  RETURN vault_secret_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SESSION MANAGEMENT FUNCTIONS
-- =============================================================================

-- Function: Validate and get temporary chat session using Vault
CREATE OR REPLACE FUNCTION validate_temp_chat_session(
  p_session_token TEXT
) RETURNS TABLE (
  session_id UUID,
  link_id UUID,
  agent_id UUID,
  agent_name TEXT,
  conversation_id UUID,
  is_valid BOOLEAN,
  expires_at TIMESTAMPTZ,
  title TEXT,
  description TEXT,
  welcome_message TEXT,
  max_messages_per_session INTEGER,
  current_message_count INTEGER,
  rate_limit_per_minute INTEGER
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tcs.id as session_id,
    tcs.link_id,
    tcl.agent_id,
    a.name as agent_name,
    tcs.conversation_id,
    (
      tcs.status = 'active' 
      AND tcl.is_active = TRUE 
      AND tcl.expires_at > NOW()
      AND tcs.message_count < tcl.max_messages_per_session
    ) as is_valid,
    tcl.expires_at,
    tcl.title,
    tcl.description,
    tcl.welcome_message,
    tcl.max_messages_per_session,
    tcs.message_count as current_message_count,
    tcl.rate_limit_per_minute
  FROM temporary_chat_sessions tcs
  JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
  JOIN agents a ON tcl.agent_id = a.id
  WHERE vault.decrypt_secret(tcs.vault_session_token_id) = p_session_token;
END;
$$ LANGUAGE plpgsql;

-- Function: Create temporary chat session
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
BEGIN
  -- Find and validate link token using Vault
  SELECT tcl.id, tcl.agent_id, a.name, tcl.max_sessions, tcl.is_active, tcl.expires_at
  INTO v_link_id, v_agent_id, v_agent_name, v_max_sessions, v_is_active, v_expires_at
  FROM temporary_chat_links tcl
  JOIN agents a ON tcl.agent_id = a.id
  WHERE vault.decrypt_secret(tcl.vault_link_token_id) = p_link_token;
  
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
  v_new_session_token := vault.decrypt_secret(v_vault_session_token_id);
  
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
  
  -- Return success
  RETURN QUERY SELECT 
    v_new_session_id, v_new_session_token, v_new_conversation_id, 
    v_agent_id, v_agent_name, TRUE, ''::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function: End temporary chat session
CREATE OR REPLACE FUNCTION end_temp_chat_session(
  p_session_token TEXT,
  p_end_reason TEXT DEFAULT 'completed',
  p_satisfaction_rating INTEGER DEFAULT NULL,
  p_feedback_text TEXT DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_conversation_session_id UUID;
BEGIN
  -- Find session by token
  SELECT tcs.id, tcs.conversation_session_id
  INTO v_session_id, v_conversation_session_id
  FROM temporary_chat_sessions tcs
  WHERE vault.decrypt_secret(tcs.vault_session_token_id) = p_session_token
    AND status = 'active';
  
  IF v_session_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update temporary chat session
  UPDATE temporary_chat_sessions 
  SET status = 'ended',
      ended_at = NOW(),
      end_reason = p_end_reason,
      satisfaction_rating = p_satisfaction_rating,
      feedback_text = p_feedback_text,
      updated_at = NOW()
  WHERE id = v_session_id;
  
  -- Update conversation session
  IF v_conversation_session_id IS NOT NULL THEN
    UPDATE conversation_sessions
    SET status = 'completed',
        ended_at = NOW()
    WHERE id = v_conversation_session_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ANALYTICS FUNCTIONS
-- =============================================================================

-- Function: Get temporary chat analytics
CREATE OR REPLACE FUNCTION get_temp_chat_analytics(
  p_agent_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
  total_links INTEGER,
  active_links INTEGER,
  total_sessions INTEGER,
  active_sessions INTEGER,
  total_messages INTEGER,
  avg_session_duration INTERVAL,
  top_countries TEXT[],
  satisfaction_avg NUMERIC
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH link_stats AS (
    SELECT 
      COUNT(*) as total_links,
      COUNT(*) FILTER (WHERE is_active = TRUE AND expires_at > NOW()) as active_links
    FROM temporary_chat_links tcl
    WHERE (p_agent_id IS NULL OR tcl.agent_id = p_agent_id)
      AND (p_user_id IS NULL OR tcl.user_id = p_user_id)
      AND tcl.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ),
  session_stats AS (
    SELECT 
      COUNT(*) as total_sessions,
      COUNT(*) FILTER (WHERE tcs.status = 'active') as active_sessions,
      SUM(tcs.message_count) as total_messages,
      AVG(EXTRACT(EPOCH FROM (COALESCE(tcs.ended_at, NOW()) - tcs.started_at)) * INTERVAL '1 second') as avg_duration,
      ARRAY_AGG(DISTINCT tcs.country_code) FILTER (WHERE tcs.country_code IS NOT NULL) as countries,
      AVG(tcs.satisfaction_rating) FILTER (WHERE tcs.satisfaction_rating IS NOT NULL) as avg_satisfaction
    FROM temporary_chat_sessions tcs
    JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
    WHERE (p_agent_id IS NULL OR tcl.agent_id = p_agent_id)
      AND (p_user_id IS NULL OR tcl.user_id = p_user_id)
      AND tcs.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  )
  SELECT 
    ls.total_links::INTEGER,
    ls.active_links::INTEGER,
    COALESCE(ss.total_sessions, 0)::INTEGER,
    COALESCE(ss.active_sessions, 0)::INTEGER,
    COALESCE(ss.total_messages, 0)::INTEGER,
    COALESCE(ss.avg_duration, '0 seconds'::INTERVAL),
    COALESCE(ss.countries, ARRAY[]::TEXT[]),
    COALESCE(ss.avg_satisfaction, 0)::NUMERIC
  FROM link_stats ls
  CROSS JOIN session_stats ss;
END;
$$ LANGUAGE plpgsql;

-- Function: Get session details for a link
CREATE OR REPLACE FUNCTION get_temp_chat_session_details(
  p_link_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  session_id UUID,
  participant_name TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  message_count INTEGER,
  session_duration INTERVAL,
  status TEXT,
  satisfaction_rating INTEGER,
  country_code TEXT
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tcs.id,
    tcs.participant_name,
    tcs.started_at,
    tcs.ended_at,
    tcs.message_count,
    CASE 
      WHEN tcs.ended_at IS NOT NULL THEN 
        tcs.ended_at - tcs.started_at
      ELSE 
        NOW() - tcs.started_at
    END as duration,
    tcs.status,
    tcs.satisfaction_rating,
    tcs.country_code
  FROM temporary_chat_sessions tcs
  WHERE tcs.link_id = p_link_id
  ORDER BY tcs.started_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- =============================================================================

-- Function: Cleanup expired temporary chats
CREATE OR REPLACE FUNCTION cleanup_expired_temp_chats()
RETURNS TABLE (
  expired_links INTEGER,
  expired_sessions INTEGER,
  cleaned_vault_secrets INTEGER
) AS $$
DECLARE
  v_expired_links INTEGER := 0;
  v_expired_sessions INTEGER := 0;
  v_cleaned_secrets INTEGER := 0;
  v_vault_token_ids TEXT[];
BEGIN
  -- Collect vault token IDs from expired links before cleanup
  SELECT ARRAY_AGG(vault_link_token_id) INTO v_vault_token_ids
  FROM temporary_chat_links 
  WHERE expires_at < NOW() AND is_active = TRUE;
  
  -- Mark expired links as inactive
  UPDATE temporary_chat_links 
  SET is_active = FALSE, updated_at = NOW()
  WHERE expires_at < NOW() AND is_active = TRUE;
  
  GET DIAGNOSTICS v_expired_links = ROW_COUNT;
  
  -- End expired sessions
  UPDATE temporary_chat_sessions 
  SET status = 'expired', ended_at = NOW(), end_reason = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND (
      last_activity_at < NOW() - INTERVAL '30 minutes' OR
      link_id IN (SELECT id FROM temporary_chat_links WHERE is_active = FALSE)
    );
  
  GET DIAGNOSTICS v_expired_sessions = ROW_COUNT;
  
  -- Clean up vault secrets for very old expired links (older than 30 days)
  -- This is optional and should be done carefully
  SELECT COUNT(*) INTO v_cleaned_secrets
  FROM temporary_chat_links tcl
  WHERE tcl.expires_at < NOW() - INTERVAL '30 days'
    AND tcl.is_active = FALSE;
  
  -- Note: Actual vault secret deletion would require additional vault functions
  -- For now, we just count what would be cleaned
  
  RETURN QUERY SELECT v_expired_links, v_expired_sessions, v_cleaned_secrets;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get cleanup statistics
CREATE OR REPLACE FUNCTION get_temp_chat_cleanup_stats()
RETURNS TABLE (
  expired_links_count INTEGER,
  inactive_sessions_count INTEGER,
  old_vault_secrets_count INTEGER,
  cleanup_recommended BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM temporary_chat_links WHERE expires_at < NOW() AND is_active = TRUE),
    (SELECT COUNT(*)::INTEGER FROM temporary_chat_sessions 
     WHERE status = 'active' AND last_activity_at < NOW() - INTERVAL '30 minutes'),
    (SELECT COUNT(*)::INTEGER FROM temporary_chat_links 
     WHERE expires_at < NOW() - INTERVAL '30 days' AND is_active = FALSE),
    (SELECT COUNT(*) FROM temporary_chat_links WHERE expires_at < NOW() AND is_active = TRUE) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- RATE LIMITING FUNCTIONS
-- =============================================================================

-- Function: Check rate limit for session
CREATE OR REPLACE FUNCTION check_temp_chat_rate_limit(
  p_session_token TEXT
) RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  limit_per_minute INTEGER,
  reset_time TIMESTAMPTZ
) AS $$
DECLARE
  v_session_id UUID;
  v_current_count INTEGER;
  v_rate_limit INTEGER;
  v_last_message_time TIMESTAMPTZ;
BEGIN
  -- Get session info
  SELECT tcs.id, tcs.messages_in_current_minute, tcl.rate_limit_per_minute, tcs.last_message_at
  INTO v_session_id, v_current_count, v_rate_limit, v_last_message_time
  FROM temporary_chat_sessions tcs
  JOIN temporary_chat_links tcl ON tcs.link_id = tcl.id
  WHERE vault.decrypt_secret(tcs.vault_session_token_id) = p_session_token
    AND tcs.status = 'active';
  
  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, NOW();
    RETURN;
  END IF;
  
  -- Check if more than a minute has passed since last message
  IF v_last_message_time IS NULL OR 
     EXTRACT(EPOCH FROM (NOW() - v_last_message_time)) >= 60 THEN
    v_current_count := 0;
  END IF;
  
  RETURN QUERY SELECT 
    v_current_count < v_rate_limit,
    v_current_count,
    v_rate_limit,
    CASE 
      WHEN v_last_message_time IS NOT NULL THEN v_last_message_time + INTERVAL '1 minute'
      ELSE NOW() + INTERVAL '1 minute'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SCHEDULED CLEANUP JOBS
-- =============================================================================

-- Schedule cleanup job to run every 15 minutes
-- Note: This requires pg_cron extension to be enabled
SELECT cron.schedule(
  'cleanup-temp-chats',
  '*/15 * * * *',
  'SELECT cleanup_expired_temp_chats();'
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- Schedule session timeout check every 5 minutes
SELECT cron.schedule(
  'expire-inactive-temp-sessions',
  '*/5 * * * *',
  'SELECT expire_inactive_sessions();'
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- =============================================================================
-- FUNCTION COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION generate_temp_chat_token() IS 'Generates cryptographically secure tokens for temporary chat links and stores them in Supabase Vault';
COMMENT ON FUNCTION generate_session_token() IS 'Generates cryptographically secure tokens for temporary chat sessions and stores them in Supabase Vault';
COMMENT ON FUNCTION validate_temp_chat_session(TEXT) IS 'Validates a session token and returns session details if valid and active';
COMMENT ON FUNCTION create_temp_chat_session IS 'Creates a new temporary chat session for a given link token with participant information';
COMMENT ON FUNCTION end_temp_chat_session IS 'Ends a temporary chat session with optional feedback and satisfaction rating';
COMMENT ON FUNCTION get_temp_chat_analytics IS 'Returns comprehensive analytics for temporary chat links and sessions';
COMMENT ON FUNCTION cleanup_expired_temp_chats() IS 'Cleans up expired temporary chat links and inactive sessions';
COMMENT ON FUNCTION check_temp_chat_rate_limit(TEXT) IS 'Checks if a session has exceeded its rate limit for message sending';

-- Log the migration with function count
DO $$
DECLARE
  function_count INTEGER;
  scheduled_jobs INTEGER;
BEGIN
  -- Count functions created in this migration
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' 
    AND p.proname LIKE '%temp_chat%' OR p.proname LIKE '%temporary_chat%';
  
  -- Count scheduled jobs (if pg_cron is available)
  SELECT COALESCE(
    (SELECT COUNT(*) FROM cron.job WHERE jobname LIKE '%temp%'), 
    0
  ) INTO scheduled_jobs;
  
  RAISE NOTICE 'Migration completed: Created % functions and % scheduled cleanup jobs', 
    function_count, scheduled_jobs;
END $$;
