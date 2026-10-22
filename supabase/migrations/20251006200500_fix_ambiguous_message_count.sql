-- Fix ambiguous message_count column reference in summarization trigger
-- Date: 2025-10-06
-- Issue: Line 29 of queue_conversation_summarization() function has ambiguous column reference

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
  -- FIX: Add table alias 'csb' to resolve ambiguous column reference
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed ambiguous message_count column reference in queue_conversation_summarization()';
END $$;

