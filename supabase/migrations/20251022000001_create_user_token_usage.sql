-- Migration: Create User Token Usage System
-- Description: Implements token usage tracking and aggregation for admin analytics
-- Author: Agentopia Development Team
-- Date: 2025-10-22

-- =============================================================================
-- TABLE CREATION
-- =============================================================================

CREATE TABLE user_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  total_prompt_tokens BIGINT NOT NULL DEFAULT 0,
  total_completion_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  conversation_count INTEGER NOT NULL DEFAULT 0,
  agent_ids UUID[] DEFAULT '{}',
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT user_token_usage_unique_period UNIQUE (user_id, period_start, period_type),
  CONSTRAINT user_token_usage_tokens_non_negative CHECK (
    total_prompt_tokens >= 0 AND
    total_completion_tokens >= 0 AND
    total_tokens >= 0
  ),
  CONSTRAINT user_token_usage_counts_non_negative CHECK (
    message_count >= 0 AND
    conversation_count >= 0
  ),
  CONSTRAINT user_token_usage_period_valid CHECK (period_end > period_start)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_user_token_usage_user_period 
  ON user_token_usage(user_id, period_start DESC, period_type)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_user_token_usage_period 
  ON user_token_usage(period_start DESC, period_end DESC);

CREATE INDEX idx_user_token_usage_updated 
  ON user_token_usage(updated_at DESC) 
  WHERE period_type = 'daily';

CREATE INDEX idx_user_token_usage_period_type 
  ON user_token_usage(period_type, period_start DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE user_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_all_token_usage"
  ON user_token_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

CREATE POLICY "user_view_own_token_usage"
  ON user_token_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function: Aggregate Token Usage
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
  v_start := COALESCE(p_start_date, DATE_TRUNC('day', CURRENT_DATE - INTERVAL '1 day'));
  v_end := COALESCE(p_end_date, DATE_TRUNC('day', CURRENT_DATE));
  
  RAISE NOTICE 'Starting aggregation from % to % for user %', v_start, v_end, COALESCE(p_user_id::TEXT, 'ALL');
  
  v_period_start := v_start;
  
  WHILE v_period_start < v_end LOOP
    v_period_end := v_period_start + INTERVAL '1 day';
    
    FOR v_user IN (
      SELECT DISTINCT sender_user_id
      FROM chat_messages_v2
      WHERE (p_user_id IS NULL OR sender_user_id = p_user_id)
        AND sender_user_id IS NOT NULL
        AND role = 'assistant'
        AND created_at >= v_period_start
        AND created_at < v_period_end
        AND metadata ? 'tokens'
    ) LOOP
      
      SELECT EXISTS (
        SELECT 1 FROM user_token_usage
        WHERE user_id = v_user.sender_user_id
          AND period_start = v_period_start
          AND period_type = 'daily'
      ) INTO v_existed;
      
      INSERT INTO user_token_usage (
        user_id, period_start, period_end, period_type,
        total_prompt_tokens, total_completion_tokens, total_tokens,
        message_count, conversation_count, agent_ids, last_activity
      )
      SELECT
        v_user.sender_user_id, v_period_start, v_period_end, 'daily',
        COALESCE(SUM(CASE 
          WHEN metadata->'processingDetails'->'llm_calls' IS NOT NULL 
          THEN (SELECT SUM(COALESCE((call->'response'->'usage'->>'prompt_tokens')::INTEGER, 0))
                FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call)
          ELSE 0 END), 0),
        COALESCE(SUM(CASE 
          WHEN metadata->'processingDetails'->'llm_calls' IS NOT NULL 
          THEN (SELECT SUM(COALESCE((call->'response'->'usage'->>'completion_tokens')::INTEGER, 0))
                FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call)
          ELSE 0 END), 0),
        COALESCE(SUM((metadata->>'tokens')::INTEGER), 0),
        COUNT(*), COUNT(DISTINCT conversation_id),
        ARRAY_AGG(DISTINCT sender_agent_id) FILTER (WHERE sender_agent_id IS NOT NULL),
        MAX(created_at)
      FROM chat_messages_v2
      WHERE sender_user_id = v_user.sender_user_id
        AND role = 'assistant'
        AND created_at >= v_period_start
        AND created_at < v_period_end
        AND metadata ? 'tokens'
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

GRANT EXECUTE ON FUNCTION aggregate_user_token_usage TO service_role;

-- Function: Backfill Historical Data
CREATE OR REPLACE FUNCTION backfill_token_usage(
  p_start_date DATE,
  p_end_date DATE,
  p_batch_size INTEGER DEFAULT 30
)
RETURNS TABLE (
  batch_start DATE, batch_end DATE,
  users_processed INTEGER, records_created INTEGER, records_updated INTEGER,
  status TEXT, duration_seconds NUMERIC
) AS $$
DECLARE
  v_batch_start DATE := p_start_date;
  v_batch_end DATE;
  v_result RECORD;
  v_start_time TIMESTAMP;
  v_duration NUMERIC;
BEGIN
  WHILE v_batch_start < p_end_date LOOP
    v_batch_end := LEAST(v_batch_start + p_batch_size, p_end_date);
    v_start_time := clock_timestamp();
    
    BEGIN
      SELECT * INTO v_result FROM aggregate_user_token_usage(
        NULL, v_batch_start::timestamp, v_batch_end::timestamp
      );
      
      v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
      RETURN QUERY SELECT v_batch_start, v_batch_end, v_result.users_processed,
        v_result.records_created, v_result.records_updated, 'success'::TEXT, v_duration;
      
    EXCEPTION WHEN OTHERS THEN
      v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
      RETURN QUERY SELECT v_batch_start, v_batch_end, 0, 0, 0,
        'error: ' || SQLERRM, v_duration;
    END;
    
    v_batch_start := v_batch_end;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION backfill_token_usage TO service_role;

-- Function: Update Timestamp Trigger
CREATE OR REPLACE FUNCTION update_user_token_usage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_token_usage_timestamp
  BEFORE UPDATE ON user_token_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_user_token_usage_timestamp();

-- =============================================================================
-- CRON JOB SETUP
-- =============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to run daily at 1:00 AM UTC
SELECT cron.schedule(
  'aggregate-token-usage-daily',
  '0 1 * * *',
  $$
    SELECT aggregate_user_token_usage(
      p_user_id := NULL,
      p_start_date := CURRENT_DATE - INTERVAL '1 day',
      p_end_date := CURRENT_DATE
    );
  $$
);

-- Function: Check cron job status
CREATE OR REPLACE FUNCTION get_cron_job_status(p_job_name VARCHAR DEFAULT 'aggregate-token-usage-daily')
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cj.jobid,
    cj.schedule,
    cj.command,
    cj.active
  FROM cron.job cj
  WHERE cj.jobname = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_cron_job_status TO service_role;

-- Function: Manually trigger aggregation (for testing)
CREATE OR REPLACE FUNCTION trigger_token_aggregation(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_result RECORD;
  v_start_time TIMESTAMP := clock_timestamp();
  v_duration NUMERIC;
BEGIN
  SELECT * INTO v_result
  FROM aggregate_user_token_usage(
    p_user_id := NULL,
    p_start_date := p_start_date::timestamp,
    p_end_date := p_end_date::timestamp
  );
  
  v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
  
  RETURN jsonb_build_object(
    'success', true,
    'users_processed', v_result.users_processed,
    'records_created', v_result.records_created,
    'records_updated', v_result.records_updated,
    'total_tokens_aggregated', v_result.total_tokens_aggregated,
    'duration_seconds', v_duration,
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION trigger_token_aggregation TO service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_token_usage IS 'Aggregated token usage metrics per user per time period';
COMMENT ON COLUMN user_token_usage.period_type IS 'Type of time period: daily, weekly, or monthly';
COMMENT ON COLUMN user_token_usage.agent_ids IS 'Array of agent IDs that were used during this period';
COMMENT ON FUNCTION aggregate_user_token_usage IS 'Aggregates token usage from chat_messages_v2 into user_token_usage table';
COMMENT ON FUNCTION backfill_token_usage IS 'Backfills historical token usage data in batches';
COMMENT ON FUNCTION get_cron_job_status IS 'Returns status of the token aggregation cron job';
COMMENT ON FUNCTION trigger_token_aggregation IS 'Manually trigger token aggregation for testing';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Token usage tracking system migration complete!';
  RAISE NOTICE '   - Table: user_token_usage created';
  RAISE NOTICE '   - Indexes: 4 indexes created';
  RAISE NOTICE '   - RLS Policies: 2 policies created';
  RAISE NOTICE '   - Functions: 5 functions created';
  RAISE NOTICE '   - Cron Job: Daily aggregation scheduled at 1:00 AM UTC';
END
$$;

