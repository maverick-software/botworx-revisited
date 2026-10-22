-- ============================================================================
-- Migration: Create Automatic Summarization Trigger
-- Date: 2025-10-06
-- Purpose: Automatically trigger conversation summarization after N messages
-- ============================================================================

-- ============================================================================
-- FUNCTION: Queue summarization request
-- Purpose: Called by trigger to queue async summarization
-- ============================================================================

CREATE OR REPLACE FUNCTION queue_conversation_summarization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  message_count INTEGER;
  last_summary_count INTEGER;
  update_frequency INTEGER DEFAULT 5;  -- Default: summarize every 5 messages
  should_summarize BOOLEAN DEFAULT FALSE;
BEGIN
  -- Get the conversation's current message count
  SELECT COUNT(*) INTO message_count
  FROM chat_messages_v2
  WHERE conversation_id = NEW.conversation_id;
  
  -- Get the last summarized message count
  SELECT COALESCE(csb.message_count, 0), COALESCE(csb.update_frequency, 5)
  INTO last_summary_count, update_frequency
  FROM conversation_summary_boards csb
  WHERE csb.conversation_id = NEW.conversation_id;
  
  -- Determine if we should summarize
  -- Summarize if we've accumulated enough new messages
  IF message_count - last_summary_count >= update_frequency THEN
    should_summarize := TRUE;
  END IF;
  
  -- If this is the first time (no summary board exists), create one after 5 messages
  IF NOT FOUND AND message_count >= 5 THEN
    should_summarize := TRUE;
  END IF;
  
  -- Queue summarization if needed
  IF should_summarize THEN
    -- Use pg_notify to send async notification
    -- The conversation-summarizer Edge Function will listen for these
    PERFORM pg_notify(
      'summarization_queue',
      json_build_object(
        'conversation_id', NEW.conversation_id,
        'agent_id', NEW.sender_agent_id,
        'user_id', NEW.sender_user_id,
        'message_count', message_count,
        'timestamp', NOW()
      )::text
    );
    
    RAISE NOTICE '[Summarization Trigger] Queued summarization for conversation %', NEW.conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGER: Attach to chat_messages_v2 table
-- Purpose: Fire after each message insert to check for summarization needs
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_queue_summarization ON chat_messages_v2;

-- Create trigger that fires after each insert
CREATE TRIGGER trigger_queue_summarization
  AFTER INSERT ON chat_messages_v2
  FOR EACH ROW
  WHEN (NEW.role = 'user' OR NEW.role = 'assistant')
  EXECUTE FUNCTION queue_conversation_summarization();

-- ============================================================================
-- FUNCTION: Manual summarization trigger
-- Purpose: Allow manual triggering of summarization for a conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_manual_summarization(
  p_conversation_id UUID,
  p_force_full BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id UUID;
  v_user_id UUID;
  v_message_count INTEGER;
BEGIN
  -- Get agent_id from messages (try assistant messages first)
  SELECT sender_agent_id INTO v_agent_id
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id
    AND sender_agent_id IS NOT NULL
  LIMIT 1;
  
  -- Get user_id from messages (try user messages first)
  SELECT sender_user_id INTO v_user_id
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id
    AND sender_user_id IS NOT NULL
  LIMIT 1;
  
  -- If no agent_id found, this might be a user-only conversation
  -- Try to get the agent from the current user's context
  IF v_agent_id IS NULL THEN
    -- Default to authenticated user's first agent
    SELECT id INTO v_agent_id
    FROM agents
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- If still no user_id, use authenticated user
  IF v_user_id IS NULL THEN
    v_user_id := auth.uid();
  END IF;
  
  -- Get message count
  SELECT COUNT(*) INTO v_message_count
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id;
  
  IF v_agent_id IS NULL OR v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Could not find agent_id or user_id for conversation. Please ensure conversation exists and you have access.',
      'conversation_id', p_conversation_id,
      'message_count', v_message_count
    );
  END IF;
  
  -- Send notification with force flag
  PERFORM pg_notify(
    'summarization_queue',
    json_build_object(
      'conversation_id', p_conversation_id,
      'agent_id', v_agent_id,
      'user_id', v_user_id,
      'message_count', v_message_count,
      'force_full_summary', p_force_full,
      'manual_trigger', TRUE,
      'timestamp', NOW()
    )::text
  );
  
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Summarization queued',
    'conversation_id', p_conversation_id,
    'message_count', v_message_count
  );
END;
$$;

-- ============================================================================
-- FUNCTION: Update summary board update frequency
-- Purpose: Allow users to customize how often summaries are generated
-- ============================================================================

CREATE OR REPLACE FUNCTION set_summary_update_frequency(
  p_conversation_id UUID,
  p_frequency INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate frequency (must be between 1 and 50 messages)
  IF p_frequency < 1 OR p_frequency > 50 THEN
    RAISE EXCEPTION 'Update frequency must be between 1 and 50 messages';
  END IF;
  
  -- Update or insert summary board with new frequency
  INSERT INTO conversation_summary_boards (
    conversation_id,
    agent_id,
    user_id,
    update_frequency
  )
  SELECT 
    p_conversation_id,
    sender_agent_id,
    sender_user_id,
    p_frequency
  FROM chat_messages_v2
  WHERE conversation_id = p_conversation_id
    AND sender_agent_id IS NOT NULL
  LIMIT 1
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    update_frequency = p_frequency,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- GRANTS: Ensure proper permissions
-- ============================================================================

-- Allow authenticated users to call manual trigger
GRANT EXECUTE ON FUNCTION trigger_manual_summarization(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION set_summary_update_frequency(UUID, INTEGER) TO authenticated;

-- Service role can execute all functions
GRANT EXECUTE ON FUNCTION queue_conversation_summarization() TO service_role;
GRANT EXECUTE ON FUNCTION trigger_manual_summarization(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION set_summary_update_frequency(UUID, INTEGER) TO service_role;

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================

COMMENT ON FUNCTION queue_conversation_summarization() IS 
  'Trigger function that queues conversation summarization after N messages. Called automatically on message insert.';

COMMENT ON FUNCTION trigger_manual_summarization(UUID, BOOLEAN) IS 
  'Manually trigger summarization for a specific conversation. Set force_full=TRUE to regenerate complete summary.';

COMMENT ON FUNCTION set_summary_update_frequency(UUID, INTEGER) IS 
  'Set how many messages should accumulate before triggering automatic summarization (1-50).';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Summarization trigger system created successfully';
  RAISE NOTICE '🔔 Automatic summarization will trigger every 5 messages (default)';
  RAISE NOTICE '📞 Use trigger_manual_summarization() to manually trigger summarization';
  RAISE NOTICE '⚙️  Use set_summary_update_frequency() to customize update frequency';
  RAISE NOTICE '⚡ Ready for Phase 1 testing!';
END $$;

