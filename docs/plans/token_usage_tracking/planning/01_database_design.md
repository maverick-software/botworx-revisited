# Database Design - Token Usage Tracking

**Planning Date**: October 22, 2025  
**Status**: Complete  
**Phase**: Planning (2.1)

---

## Objective

Finalize complete database schema design including tables, columns, indexes, constraints, RLS policies, and functions for the token usage tracking system.

---

## Table Schema

### Primary Table: `user_token_usage`

```sql
CREATE TABLE user_token_usage (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Time Period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  
  -- Token Metrics
  total_prompt_tokens BIGINT NOT NULL DEFAULT 0,
  total_completion_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  
  -- Activity Metrics
  message_count INTEGER NOT NULL DEFAULT 0,
  conversation_count INTEGER NOT NULL DEFAULT 0,
  agent_ids UUID[] DEFAULT '{}',
  
  -- Metadata
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Constraints
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
```

### Indexes

```sql
-- Primary lookup: Get usage for specific user by date range
CREATE INDEX idx_user_token_usage_user_period 
  ON user_token_usage(user_id, period_start DESC, period_type)
  WHERE user_id IS NOT NULL;

-- Secondary lookup: Get all usage for a specific date (for cron job validation)
CREATE INDEX idx_user_token_usage_period 
  ON user_token_usage(period_start DESC, period_end DESC);

-- Optimization: Find recently updated records
CREATE INDEX idx_user_token_usage_updated 
  ON user_token_usage(updated_at DESC) 
  WHERE period_type = 'daily';

-- Optimization: Get usage by period type
CREATE INDEX idx_user_token_usage_period_type 
  ON user_token_usage(period_type, period_start DESC);
```

### Estimated Storage

**Per Row**: ~200 bytes
- UUID (16) + UUID (16) + Timestamps (24) + Bigints (24) + Integers (8) + Array (variable, ~50) + Overhead (~60)

**Projected Growth**:
- Daily records: 365 rows per user per year
- 100 active users: 36,500 rows/year = ~7.3 MB/year
- 1,000 active users: 365,000 rows/year = ~73 MB/year
- 10,000 active users: 3.65M rows/year = ~730 MB/year

**Conclusion**: Storage is not a concern, performance will remain excellent

---

## Row Level Security (RLS) Policies

```sql
-- Enable RLS
ALTER TABLE user_token_usage ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view all token usage
CREATE POLICY "admin_view_all_token_usage"
  ON user_token_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'admin'
    )
  );

-- Policy 2: Users can view their own token usage (future self-service)
CREATE POLICY "user_view_own_token_usage"
  ON user_token_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 3: Only service role can insert/update (via functions/cron)
-- No INSERT/UPDATE policies for regular users
-- All writes happen via service role in Edge Functions or cron jobs

-- Policy 4: No DELETE for anyone (data retention)
-- Admins can manually delete via SQL if absolutely necessary
```

---

## Database Functions

### Function 1: Aggregate Token Usage

```sql
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
  
  -- Log start
  RAISE NOTICE 'Starting aggregation from % to % for user %', v_start, v_end, COALESCE(p_user_id::TEXT, 'ALL');
  
  -- Loop through each day in the range
  v_period_start := v_start;
  
  WHILE v_period_start < v_end LOOP
    v_period_end := v_period_start + INTERVAL '1 day';
    
    -- Get list of users with activity in this period
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
      
      -- Check if record already exists
      SELECT EXISTS (
        SELECT 1 FROM user_token_usage
        WHERE user_id = v_user.sender_user_id
          AND period_start = v_period_start
          AND period_type = 'daily'
      ) INTO v_existed;
      
      -- Aggregate tokens for this user and day
      INSERT INTO user_token_usage (
        user_id,
        period_start,
        period_end,
        period_type,
        total_prompt_tokens,
        total_completion_tokens,
        total_tokens,
        message_count,
        conversation_count,
        agent_ids,
        last_activity
      )
      SELECT
        v_user.sender_user_id,
        v_period_start,
        v_period_end,
        'daily',
        -- Extract prompt tokens (fallback to 0 if not found)
        COALESCE(
          SUM(
            CASE 
              WHEN metadata->'processingDetails'->'llm_calls' IS NOT NULL 
              THEN (
                SELECT SUM(COALESCE((call->'response'->'usage'->>'prompt_tokens')::INTEGER, 0))
                FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
              )
              ELSE 0
            END
          ), 0
        ),
        -- Extract completion tokens
        COALESCE(
          SUM(
            CASE 
              WHEN metadata->'processingDetails'->'llm_calls' IS NOT NULL 
              THEN (
                SELECT SUM(COALESCE((call->'response'->'usage'->>'completion_tokens')::INTEGER, 0))
                FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
              )
              ELSE 0
            END
          ), 0
        ),
        -- Use top-level tokens field (most reliable)
        COALESCE(SUM((metadata->>'tokens')::INTEGER), 0),
        COUNT(*),
        COUNT(DISTINCT conversation_id),
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
      
      -- Update counters
      IF v_existed THEN
        v_records_updated := v_records_updated + 1;
      ELSE
        v_records_created := v_records_created + 1;
      END IF;
      
      v_users_processed := v_users_processed + 1;
      
      -- Get total tokens for this record
      SELECT total_tokens INTO v_total_tokens
      FROM user_token_usage
      WHERE user_id = v_user.sender_user_id
        AND period_start = v_period_start
        AND period_type = 'daily';
      
    END LOOP;
    
    RAISE NOTICE 'Completed period %: % users', v_period_start::DATE, v_users_processed;
    
    v_period_start := v_period_start + INTERVAL '1 day';
  END LOOP;
  
  RAISE NOTICE 'Aggregation complete: % users, % created, % updated, % total tokens',
    v_users_processed, v_records_created, v_records_updated, v_total_tokens;
  
  RETURN QUERY SELECT v_users_processed, v_records_created, v_records_updated, v_total_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION aggregate_user_token_usage TO service_role;
```

### Function 2: Backfill Historical Data

```sql
CREATE OR REPLACE FUNCTION backfill_token_usage(
  p_start_date DATE,
  p_end_date DATE,
  p_batch_size INTEGER DEFAULT 30
)
RETURNS TABLE (
  batch_start DATE,
  batch_end DATE,
  users_processed INTEGER,
  records_created INTEGER,
  records_updated INTEGER,
  status TEXT,
  duration_seconds NUMERIC
) AS $$
DECLARE
  v_batch_start DATE := p_start_date;
  v_batch_end DATE;
  v_result RECORD;
  v_start_time TIMESTAMP;
  v_duration NUMERIC;
BEGIN
  RAISE NOTICE 'Starting backfill from % to % (batch size: % days)', p_start_date, p_end_date, p_batch_size;
  
  WHILE v_batch_start < p_end_date LOOP
    v_batch_end := LEAST(v_batch_start + p_batch_size, p_end_date);
    v_start_time := clock_timestamp();
    
    BEGIN
      -- Call main aggregation function for this batch
      SELECT * INTO v_result
      FROM aggregate_user_token_usage(
        p_user_id := NULL,
        p_start_date := v_batch_start::timestamp,
        p_end_date := v_batch_end::timestamp
      );
      
      v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
      
      RETURN QUERY SELECT 
        v_batch_start,
        v_batch_end,
        v_result.users_processed,
        v_result.records_created,
        v_result.records_updated,
        'success'::TEXT,
        v_duration;
        
      RAISE NOTICE 'Backfilled % to %: % users, % created, % updated (%.2f sec)', 
        v_batch_start, v_batch_end, 
        v_result.users_processed, v_result.records_created, v_result.records_updated,
        v_duration;
      
    EXCEPTION WHEN OTHERS THEN
      v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
      
      RETURN QUERY SELECT 
        v_batch_start,
        v_batch_end,
        0,
        0,
        0,
        'error: ' || SQLERRM,
        v_duration;
      
      RAISE WARNING 'Backfill failed for % to %: %', v_batch_start, v_batch_end, SQLERRM;
    END;
    
    v_batch_start := v_batch_end;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete!';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role and admins
GRANT EXECUTE ON FUNCTION backfill_token_usage TO service_role;
```

### Function 3: Update Timestamp Trigger

```sql
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
```

---

## Migration File

**Filename**: `supabase/migrations/20251022000001_create_user_token_usage.sql`

```sql
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
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_token_usage IS 'Aggregated token usage metrics per user per time period';
COMMENT ON COLUMN user_token_usage.period_type IS 'Type of time period: daily, weekly, or monthly';
COMMENT ON COLUMN user_token_usage.agent_ids IS 'Array of agent IDs that were used during this period';
COMMENT ON FUNCTION aggregate_user_token_usage IS 'Aggregates token usage from chat_messages_v2 into user_token_usage table';
COMMENT ON FUNCTION backfill_token_usage IS 'Backfills historical token usage data in batches';
```

---

## Validation Queries

### Query 1: Check Data Integrity

```sql
-- Verify aggregated totals match raw message data
WITH raw_totals AS (
  SELECT 
    sender_user_id,
    DATE_TRUNC('day', created_at) as day,
    SUM((metadata->>'tokens')::INTEGER) as raw_total
  FROM chat_messages_v2
  WHERE sender_user_id IS NOT NULL
    AND role = 'assistant'
    AND metadata ? 'tokens'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY sender_user_id, DATE_TRUNC('day', created_at)
)
SELECT 
  COALESCE(r.sender_user_id, u.user_id) as user_id,
  COALESCE(r.day, u.period_start) as date,
  r.raw_total as raw_tokens,
  u.total_tokens as aggregated_tokens,
  ABS(COALESCE(r.raw_total, 0) - COALESCE(u.total_tokens, 0)) as difference
FROM raw_totals r
FULL OUTER JOIN user_token_usage u 
  ON r.sender_user_id = u.user_id 
  AND r.day = u.period_start
  AND u.period_type = 'daily'
WHERE ABS(COALESCE(r.raw_total, 0) - COALESCE(u.total_tokens, 0)) > 0
ORDER BY difference DESC
LIMIT 20;
```

### Query 2: Find Missing Days

```sql
-- Check for gaps in daily aggregation
SELECT 
  u.user_id,
  u.email,
  missing_dates.day as missing_date
FROM (
  SELECT DISTINCT user_id FROM user_token_usage
) u
CROSS JOIN LATERAL (
  SELECT user_id FROM auth.users WHERE id = u.user_id
) au
CROSS JOIN LATERAL (
  SELECT id as user_id, email FROM auth.users WHERE id = u.user_id
) users
CROSS JOIN generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) AS missing_dates(day)
WHERE NOT EXISTS (
  SELECT 1 FROM user_token_usage utu
  WHERE utu.user_id = u.user_id
    AND utu.period_start::DATE = missing_dates.day::DATE
    AND utu.period_type = 'daily'
)
AND EXISTS (
  SELECT 1 FROM chat_messages_v2
  WHERE sender_user_id = u.user_id
    AND role = 'assistant'
    AND DATE_TRUNC('day', created_at) = missing_dates.day
)
ORDER BY user_id, missing_date;
```

---

## Rollback Plan

```sql
-- Rollback migration (if needed)
-- WARNING: This will delete all aggregated data

DROP TRIGGER IF EXISTS trigger_update_user_token_usage_timestamp ON user_token_usage;
DROP FUNCTION IF EXISTS update_user_token_usage_timestamp();
DROP FUNCTION IF EXISTS backfill_token_usage(DATE, DATE, INTEGER);
DROP FUNCTION IF EXISTS aggregate_user_token_usage(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);
DROP TABLE IF EXISTS user_token_usage CASCADE;
```

---

## Performance Testing

### Test Query 1: Single User Lookup (Expected: <10ms)

```sql
EXPLAIN ANALYZE
SELECT * FROM user_token_usage
WHERE user_id = '3f966af2-72a1-41bc-8fac-400b8002664b'
  AND period_type = 'daily'
  AND period_start >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY period_start DESC;
```

### Test Query 2: All Users for One Day (Expected: <50ms)

```sql
EXPLAIN ANALYZE
SELECT * FROM user_token_usage
WHERE period_start = '2025-10-22'::DATE
  AND period_type = 'daily';
```

---

**Planning Complete**: ✅  
**Migration File**: Ready to create  
**Validation**: Queries prepared  
**Rollback**: Plan documented

