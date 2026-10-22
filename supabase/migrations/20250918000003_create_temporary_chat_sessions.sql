-- Migration: Create Temporary Chat Sessions Table
-- Description: Individual chat sessions for temporary chat links with Vault token storage
-- Date: 2025-09-18

-- Create the temporary_chat_sessions table
CREATE TABLE IF NOT EXISTS temporary_chat_sessions (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link relationship
  link_id UUID NOT NULL REFERENCES temporary_chat_links(id) ON DELETE CASCADE,
  
  -- Session identification (using Vault for security)
  vault_session_token_id UUID NOT NULL UNIQUE REFERENCES vault.secrets(id),
  
  -- Integration with existing chat system
  conversation_id UUID NOT NULL, -- Links to conversation_sessions via conversation_id
  conversation_session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  
  -- Participant information (anonymous)
  participant_identifier TEXT, -- Optional: email, phone, or provided name
  participant_name TEXT CHECK (LENGTH(participant_name) <= 100),
  participant_metadata JSONB NOT NULL DEFAULT '{}',
  
  -- Session lifecycle
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Usage metrics
  message_count INTEGER NOT NULL DEFAULT 0,
  session_duration_seconds INTEGER,
  total_characters_sent INTEGER NOT NULL DEFAULT 0,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired', 'terminated', 'error')),
  end_reason TEXT CHECK (end_reason IN ('completed', 'timeout', 'expired', 'terminated', 'error', 'max_messages', 'max_duration')),
  
  -- Security and monitoring
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  country_code TEXT, -- Optional: for analytics
  
  -- Rate limiting tracking
  last_message_at TIMESTAMPTZ,
  messages_in_current_minute INTEGER NOT NULL DEFAULT 0,
  rate_limit_violations INTEGER NOT NULL DEFAULT 0,
  
  -- Quality metrics
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  feedback_text TEXT CHECK (LENGTH(feedback_text) <= 1000),
  
  -- Session metadata
  session_metadata JSONB NOT NULL DEFAULT '{}',
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_session_duration CHECK (
    (ended_at IS NULL) OR (ended_at >= started_at)
  )
);

-- Add table comments for documentation
COMMENT ON TABLE temporary_chat_sessions IS 'Individual chat sessions created through temporary chat links';
COMMENT ON COLUMN temporary_chat_sessions.vault_session_token_id IS 'Vault secret ID containing the encrypted session token - never stored in plain text';
COMMENT ON COLUMN temporary_chat_sessions.link_id IS 'The temporary chat link that created this session';
COMMENT ON COLUMN temporary_chat_sessions.conversation_id IS 'Links to the conversation in the existing chat system';
COMMENT ON COLUMN temporary_chat_sessions.conversation_session_id IS 'Optional link to conversation_sessions table for integration';
COMMENT ON COLUMN temporary_chat_sessions.participant_identifier IS 'Optional identifier provided by the participant (email, phone, etc.)';
COMMENT ON COLUMN temporary_chat_sessions.participant_name IS 'Optional name provided by the participant';
COMMENT ON COLUMN temporary_chat_sessions.status IS 'Current status of the chat session';
COMMENT ON COLUMN temporary_chat_sessions.ip_address IS 'IP address of the participant for security monitoring';
COMMENT ON COLUMN temporary_chat_sessions.user_agent IS 'Browser user agent for analytics and security';
COMMENT ON COLUMN temporary_chat_sessions.messages_in_current_minute IS 'Tracks messages sent in current minute for rate limiting';
COMMENT ON COLUMN temporary_chat_sessions.rate_limit_violations IS 'Count of rate limit violations for abuse detection';

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_temporary_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at management
CREATE TRIGGER temp_sessions_updated_at_trigger
  BEFORE UPDATE ON temporary_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_temporary_chat_sessions_updated_at();

-- Create trigger function for activity tracking
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_activity_at when message_count changes
  IF TG_OP = 'UPDATE' AND OLD.message_count != NEW.message_count THEN
    NEW.last_activity_at = NOW();
    NEW.last_message_at = NOW();
    
    -- Reset rate limiting counter if more than a minute has passed
    IF OLD.last_message_at IS NULL OR 
       EXTRACT(EPOCH FROM (NOW() - OLD.last_message_at)) >= 60 THEN
      NEW.messages_in_current_minute = 1;
    ELSE
      NEW.messages_in_current_minute = OLD.messages_in_current_minute + 1;
    END IF;
  END IF;
  
  -- Calculate session duration when session ends
  IF TG_OP = 'UPDATE' AND OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL THEN
    NEW.session_duration_seconds = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity tracking
CREATE TRIGGER temp_sessions_activity_trigger
  BEFORE UPDATE ON temporary_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_activity();

-- Create trigger function to update parent link statistics
CREATE OR REPLACE FUNCTION update_link_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update parent link statistics when session changes
  IF TG_OP = 'INSERT' THEN
    -- New session created
    UPDATE temporary_chat_links 
    SET session_count = session_count + 1,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.link_id;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.message_count != NEW.message_count THEN
    -- Message count changed
    UPDATE temporary_chat_links 
    SET total_messages = total_messages + (NEW.message_count - OLD.message_count),
        updated_at = NOW()
    WHERE id = NEW.link_id;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active' THEN
    -- Session ended, decrease active session count
    UPDATE temporary_chat_links 
    SET session_count = GREATEST(0, session_count - 1),
        updated_at = NOW()
    WHERE id = NEW.link_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for link statistics
CREATE TRIGGER temp_sessions_link_stats_trigger
  AFTER INSERT OR UPDATE ON temporary_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_link_statistics();

-- Create trigger function for security monitoring
CREATE OR REPLACE FUNCTION monitor_session_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Log suspicious activity
  IF TG_OP = 'UPDATE' THEN
    -- Check for rapid rate limit violations
    IF NEW.rate_limit_violations > OLD.rate_limit_violations + 5 THEN
      -- Log security event (would integrate with existing audit system)
      INSERT INTO tool_execution_logs (
        agent_id,
        user_id,
        tool_name,
        execution_status,
        execution_details,
        created_at
      ) VALUES (
        (SELECT agent_id FROM temporary_chat_links WHERE id = NEW.link_id),
        (SELECT user_id FROM temporary_chat_links WHERE id = NEW.link_id),
        'temporary_chat_security_alert',
        'warning',
        jsonb_build_object(
          'event_type', 'rate_limit_violations',
          'session_id', NEW.id,
          'violations_count', NEW.rate_limit_violations,
          'ip_address', NEW.ip_address,
          'user_agent', NEW.user_agent
        ),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create security monitoring trigger
CREATE TRIGGER temp_sessions_security_trigger
  AFTER UPDATE ON temporary_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION monitor_session_security();

-- Create function to automatically expire inactive sessions
CREATE OR REPLACE FUNCTION expire_inactive_sessions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER := 0;
BEGIN
  -- Expire sessions that have exceeded their timeout
  UPDATE temporary_chat_sessions 
  SET status = 'expired',
      ended_at = NOW(),
      end_reason = 'timeout',
      updated_at = NOW()
  FROM temporary_chat_links tcl
  WHERE temporary_chat_sessions.link_id = tcl.id
    AND temporary_chat_sessions.status = 'active'
    AND temporary_chat_sessions.last_activity_at < NOW() - (tcl.session_timeout_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log the migration
DO $$
DECLARE
  table_count INTEGER;
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_name = 'temporary_chat_sessions' AND table_schema = 'public';
  
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'temp_sessions_%';
  
  RAISE NOTICE 'Migration completed: temporary_chat_sessions table created (% table, % triggers)', 
    table_count, trigger_count;
END $$;
