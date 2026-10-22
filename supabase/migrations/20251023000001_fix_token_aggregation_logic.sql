-- Migration: Fix Token Usage Aggregation Logic
-- Description: Corrects the aggregation function to properly query chat_messages_v2
-- Date: 2025-10-23

-- Drop and recreate the aggregation function with correct logic
CREATE OR REPLACE FUNCTION aggregate_user_token_usage(
  p_user_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  users_processed INTEGER,
  records_created INTEGER,
  records_updated INTEGER,
  total_tokens_aggregated BIGINT
) AS $$
DECLARE
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
  v_period_start TIMESTAMP WITH TIME ZONE;
  v_period_end TIMESTAMP WITH TIME ZONE;
  v_users_processed INTEGER := 0;
  v_records_created INTEGER := 0;
  v_records_updated INTEGER := 0;
  v_total_tokens BIGINT := 0;
  v_user RECORD;
  v_existed BOOLEAN;
BEGIN
  -- Default to yesterday if no dates provided
  v_start := COALESCE(p_start_date, DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day'));
  v_end := COALESCE(p_end_date, DATE_TRUNC('day', CURRENT_DATE));
  
  RAISE NOTICE 'Starting aggregation from % to % for user %', v_start, v_end, COALESCE(p_user_id::TEXT, 'ALL');
  
  v_period_start := v_start;
  
  -- Loop through each day in the date range
  WHILE v_period_start < v_end LOOP
    v_period_end := v_period_start + INTERVAL '1 day';
    
    -- Find all users who have messages with LLM call data in this period
    FOR v_user IN (
      SELECT DISTINCT sender_user_id
      FROM chat_messages_v2
      WHERE (p_user_id IS NULL OR sender_user_id = p_user_id)
        AND sender_user_id IS NOT NULL
        AND created_at >= v_period_start
        AND created_at < v_period_end
        AND metadata->'processingDetails'->'llm_calls' IS NOT NULL
        AND jsonb_array_length(metadata->'processingDetails'->'llm_calls') > 0
    ) LOOP
      
      -- Check if record already exists
      SELECT EXISTS (
        SELECT 1 FROM user_token_usage
        WHERE user_id = v_user.sender_user_id
          AND period_start = v_period_start
          AND period_type = 'daily'
      ) INTO v_existed;
      
      -- Aggregate and insert/update the token usage for this user and period
      INSERT INTO user_token_usage (
        user_id, period_start, period_end, period_type,
        total_prompt_tokens, total_completion_tokens, total_tokens,
        message_count, conversation_count, agent_ids, last_activity
      )
      SELECT
        v_user.sender_user_id,
        v_period_start,
        v_period_end,
        'daily',
        -- Sum all prompt tokens from all LLM calls
        COALESCE(SUM(
          (SELECT SUM(COALESCE((call->'response'->'usage'->>'prompt_tokens')::BIGINT, 0))
           FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call)
        ), 0),
        -- Sum all completion tokens from all LLM calls
        COALESCE(SUM(
          (SELECT SUM(COALESCE((call->'response'->'usage'->>'completion_tokens')::BIGINT, 0))
           FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call)
        ), 0),
        -- Sum all total tokens from all LLM calls
        COALESCE(SUM(
          (SELECT SUM(COALESCE((call->'response'->'usage'->>'total_tokens')::BIGINT, 0))
           FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call)
        ), 0),
        -- Count messages
        COUNT(DISTINCT id),
        -- Count unique conversations
        COUNT(DISTINCT conversation_id),
        -- Collect unique agent IDs from conversation_sessions
        (SELECT ARRAY_AGG(DISTINCT cs.agent_id) 
         FROM conversation_sessions cs
         WHERE cs.conversation_id IN (
           SELECT DISTINCT cm.conversation_id 
           FROM chat_messages_v2 cm 
           WHERE cm.sender_user_id = v_user.sender_user_id
             AND cm.created_at >= v_period_start
             AND cm.created_at < v_period_end
         )
         AND cs.agent_id IS NOT NULL
        ),
        -- Last activity timestamp
        MAX(created_at)
      FROM chat_messages_v2
      WHERE sender_user_id = v_user.sender_user_id
        AND created_at >= v_period_start
        AND created_at < v_period_end
        AND metadata->'processingDetails'->'llm_calls' IS NOT NULL
        AND jsonb_array_length(metadata->'processingDetails'->'llm_calls') > 0
      GROUP BY sender_user_id
      ON CONFLICT (user_id, period_start, period_type)
      DO UPDATE SET
        total_prompt_tokens = EXCLUDED.total_prompt_tokens,
        total_completion_tokens = EXCLUDED.total_completion_tokens,
        total_tokens = EXCLUDED.total_tokens,
        message_count = EXCLUDED.message_count,
        conversation_count = EXCLUDED.conversation_count,
        agent_ids = EXCLUDED.agent_ids,
        last_activity = EXCLUDED.last_activity,
        updated_at = NOW();
      
      IF v_existed THEN
        v_records_updated := v_records_updated + 1;
      ELSE
        v_records_created := v_records_created + 1;
      END IF;
      
      v_users_processed := v_users_processed + 1;
    END LOOP;
    
    v_period_start := v_period_start + INTERVAL '1 day';
  END LOOP;
  
  RETURN QUERY SELECT v_users_processed, v_records_created, v_records_updated, v_total_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION aggregate_user_token_usage IS 'Aggregates token usage from chat_messages_v2.metadata.processingDetails.llm_calls';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Token aggregation logic fixed!';
  RAISE NOTICE '   - Now correctly queries metadata->processingDetails->llm_calls';
  RAISE NOTICE '   - Removed incorrect role filter';
  RAISE NOTICE '   - Properly aggregates all LLM calls per message';
END
$$;

