# Database Schema Research - Token Usage Tracking

**Research Date**: October 22, 2025  
**Researcher**: AI Assistant  
**Status**: Complete

---

## Objective

Research optimal database schema design for storing and aggregating token usage data across user accounts, considering:
- Performance at scale
- Query efficiency
- Storage optimization
- Historical data retention
- Aggregation strategies

---

## Current System Analysis

### Existing Tables

#### 1. `chat_messages_v2` (Source of Token Data)
```sql
CREATE TABLE chat_messages_v2 (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  sender_user_id UUID,
  sender_agent_id UUID,
  role VARCHAR(20) NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',  -- ⭐ Contains token data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Token Data Structure in `metadata`**:
```json
{
  "tokens": 2336,
  "processing_time_ms": 7542,
  "processingDetails": {
    "prompt_tokens": 1435,
    "completion_tokens": 901,
    "total_tokens": 2336,
    "llm_calls": [...]
  }
}
```

**Key Observations**:
- ✅ Token data IS already being captured per message
- ✅ Includes breakdown: prompt_tokens, completion_tokens, total_tokens
- ⚠️ Data is in JSONB, requires extraction for aggregation
- ⚠️ No indexes on metadata fields (would need GIN index for JSONB queries)
- ⚠️ Historical messages could be millions of rows per user

#### 2. `conversation_sessions` (User-Agent Linking)
```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  agent_id UUID REFERENCES agents(id),
  message_count INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_tokens_used INTEGER DEFAULT 0,  -- ⚠️ May not be populated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Observations**:
- ✅ Already has `total_tokens_used` field (but likely not populated)
- ✅ Links conversations to users for aggregation
- ⚠️ No mechanism to update `total_tokens_used` from messages

#### 3. `profiles` (User Information)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Aggregation Strategy Options

### Option A: Real-Time Aggregation (Query on Demand)

**Approach**: Calculate token usage by querying `chat_messages_v2.metadata` directly

```sql
SELECT 
  sender_user_id,
  SUM((metadata->'processingDetails'->>'prompt_tokens')::INTEGER) as total_prompt,
  SUM((metadata->'processingDetails'->>'completion_tokens')::INTEGER) as total_completion,
  COUNT(*) as message_count
FROM chat_messages_v2
WHERE sender_user_id = $1
  AND created_at >= $2
  AND created_at <= $3
  AND role = 'assistant'  -- Only count AI responses
GROUP BY sender_user_id;
```

**Pros**:
- ✅ Always accurate (no sync issues)
- ✅ No additional storage required
- ✅ Simple to implement

**Cons**:
- ❌ Slow for users with many messages
- ❌ Expensive JSONB extraction on every query
- ❌ No historical snapshots
- ❌ Can't efficiently query "all users' usage"

**Verdict**: ❌ Not suitable for admin dashboard with multiple users

---

### Option B: Materialized View

**Approach**: Create a materialized view that aggregates token data

```sql
CREATE MATERIALIZED VIEW user_token_usage_summary AS
SELECT 
  sender_user_id as user_id,
  DATE_TRUNC('day', created_at) as day,
  SUM((metadata->'processingDetails'->>'prompt_tokens')::INTEGER) as prompt_tokens,
  SUM((metadata->'processingDetails'->>'completion_tokens')::INTEGER) as completion_tokens,
  SUM((metadata->'processingDetails'->>'total_tokens')::INTEGER) as total_tokens,
  COUNT(*) as message_count
FROM chat_messages_v2
WHERE sender_user_id IS NOT NULL
  AND role = 'assistant'
GROUP BY sender_user_id, DATE_TRUNC('day', created_at);
```

**Refresh Strategy**: `REFRESH MATERIALIZED VIEW CONCURRENTLY` (daily via cron)

**Pros**:
- ✅ Fast queries (pre-computed)
- ✅ Can add indexes on user_id, day
- ✅ Supports historical analysis

**Cons**:
- ❌ Not real-time (stale until refresh)
- ❌ Refresh can be slow on large datasets
- ❌ Locks during refresh (unless CONCURRENTLY)
- ❌ Requires unique index for CONCURRENTLY

**Verdict**: ⚠️ Good option, but requires careful refresh management

---

### Option C: Dedicated Aggregation Table (RECOMMENDED) ✅

**Approach**: Create a separate table with pre-aggregated data, updated via trigger or cron

```sql
CREATE TABLE user_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  period_type VARCHAR(10) NOT NULL, -- 'daily', 'weekly', 'monthly'
  
  -- Token metrics
  total_prompt_tokens BIGINT DEFAULT 0,
  total_completion_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  
  -- Activity metrics
  message_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  agent_ids UUID[] DEFAULT '{}',  -- Array of agent IDs used
  
  -- Metadata
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user per period
  UNIQUE(user_id, period_start, period_type)
);

-- Indexes for performance
CREATE INDEX idx_token_usage_user_period 
  ON user_token_usage(user_id, period_start DESC, period_type);

CREATE INDEX idx_token_usage_period 
  ON user_token_usage(period_start DESC, period_end DESC);

CREATE INDEX idx_token_usage_updated 
  ON user_token_usage(updated_at DESC) 
  WHERE period_type = 'daily';  -- Partial index for recent updates
```

**Update Strategy**: 
- **Option 1**: Database trigger on `chat_messages_v2` INSERT (real-time, but adds overhead)
- **Option 2**: Cron job runs aggregation function daily (performant, slight delay)
- **Recommended**: **Option 2** (Cron) with on-demand recalculation available

**Aggregation Function**:
```sql
CREATE OR REPLACE FUNCTION aggregate_user_token_usage(
  p_user_id UUID,
  p_period_start TIMESTAMP WITH TIME ZONE,
  p_period_end TIMESTAMP WITH TIME ZONE,
  p_period_type VARCHAR(10)
)
RETURNS VOID AS $$
BEGIN
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
    sender_user_id,
    p_period_start,
    p_period_end,
    p_period_type,
    COALESCE(SUM((metadata->'processingDetails'->>'prompt_tokens')::INTEGER), 0),
    COALESCE(SUM((metadata->'processingDetails'->>'completion_tokens')::INTEGER), 0),
    COALESCE(SUM((metadata->'processingDetails'->>'total_tokens')::INTEGER), 0),
    COUNT(*),
    COUNT(DISTINCT conversation_id),
    ARRAY_AGG(DISTINCT sender_agent_id) FILTER (WHERE sender_agent_id IS NOT NULL),
    MAX(created_at)
  FROM chat_messages_v2
  WHERE sender_user_id = p_user_id
    AND created_at >= p_period_start
    AND created_at < p_period_end
    AND role = 'assistant'
    AND metadata->'processingDetails' IS NOT NULL
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
END;
$$ LANGUAGE plpgsql;
```

**Pros**:
- ✅ Fast queries (indexed, pre-computed)
- ✅ Historical snapshots preserved
- ✅ Flexible period types (daily, weekly, monthly)
- ✅ Can track additional metrics (agents used, conversations)
- ✅ Minimal impact on chat writes
- ✅ Easy to add cost calculations later

**Cons**:
- ⚠️ Slight delay (daily aggregation)
- ⚠️ Additional storage (minimal compared to messages)
- ⚠️ Requires cron job setup

**Verdict**: ✅ **RECOMMENDED** - Best balance of performance, flexibility, and maintainability

---

## Time-Series Data Best Practices

### Partitioning Strategy (Future Optimization)

If token usage data grows large (>10M rows), consider partitioning by period_start:

```sql
-- Not needed initially, but good to plan for
CREATE TABLE user_token_usage_2025 PARTITION OF user_token_usage
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE user_token_usage_2026 PARTITION OF user_token_usage
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

**Benefits**:
- Faster queries (partition pruning)
- Easier archival (drop old partitions)
- Better vacuum performance

**When to implement**: When table exceeds 10M rows or queries slow down

---

## Data Retention Policy

**Recommendation**:
- **Raw Messages** (`chat_messages_v2`): Retain indefinitely (user data)
- **Daily Aggregates**: Retain 90 days (detailed recent history)
- **Monthly Aggregates**: Retain 24 months (long-term trends)
- **Yearly Aggregates**: Retain indefinitely (historical records)

**Implementation**: Cron job to create monthly/yearly aggregates from daily data

---

## RLS (Row Level Security) Policies

```sql
-- Admin can view all token usage
CREATE POLICY "admin_view_all_token_usage"
  ON user_token_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name = 'admin'
    )
  );

-- Users can view their own token usage (future self-service)
CREATE POLICY "user_view_own_token_usage"
  ON user_token_usage
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Only system can insert/update (via service role)
-- No INSERT/UPDATE policies for regular users
```

---

## Migration Strategy

### Phase 1: Create Table and Function
1. Create `user_token_usage` table
2. Create aggregation function
3. Create RLS policies
4. Add indexes

### Phase 2: Historical Backfill
1. Create backfill script to process existing messages
2. Run in batches (1000 users at a time) to avoid timeouts
3. Process oldest to newest (can resume if interrupted)

```sql
-- Backfill script (run via Edge Function or SQL script)
DO $$
DECLARE
  v_user RECORD;
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
  FOR v_user IN (
    SELECT DISTINCT sender_user_id
    FROM chat_messages_v2
    WHERE sender_user_id IS NOT NULL
    ORDER BY sender_user_id
  ) LOOP
    -- Get date range for this user
    SELECT MIN(DATE_TRUNC('day', created_at)), MAX(DATE_TRUNC('day', created_at)) + INTERVAL '1 day'
    INTO v_start_date, v_end_date
    FROM chat_messages_v2
    WHERE sender_user_id = v_user.sender_user_id;
    
    -- Aggregate by day
    WHILE v_start_date < v_end_date LOOP
      PERFORM aggregate_user_token_usage(
        v_user.sender_user_id,
        v_start_date,
        v_start_date + INTERVAL '1 day',
        'daily'
      );
      v_start_date := v_start_date + INTERVAL '1 day';
    END LOOP;
  END LOOP;
END $$;
```

### Phase 3: Set Up Cron Job
1. Create Supabase Cron job to run `aggregate_user_token_usage` daily at midnight
2. Process previous day's data

---

## Backup Plan

**Files to Backup**:
- `database/schema/current_remote_schema.sql` (full schema snapshot)
- Any existing migrations that touch related tables

**Reversal Strategy**:
1. Drop `user_token_usage` table
2. Drop aggregation function
3. Restore from backup if needed

---

## Recommendations Summary

### ✅ Implement Option C: Dedicated Aggregation Table

**Why**:
1. **Performance**: Fast queries for admin dashboard
2. **Flexibility**: Multiple period types, additional metrics
3. **Scalability**: Handles millions of messages efficiently
4. **Historical Data**: Preserves snapshots over time
5. **Cost-Effective**: Minimal storage overhead

**Key Design Decisions**:
- Use daily cron job for aggregation (not real-time trigger)
- Store multiple period types (daily, weekly, monthly)
- Include activity metrics (conversation count, agents used)
- Plan for partitioning if data grows large (>10M rows)
- Implement RLS for admin-only access initially

### 📋 Action Items for Implementation

1. Create migration file: `20251022000001_create_user_token_usage.sql`
2. Implement aggregation function: `aggregate_user_token_usage`
3. Create backfill script: `scripts/backfill_token_usage.ts`
4. Set up Supabase Cron job
5. Create Edge Function: `admin-get-user-token-usage`

---

## References

- **Existing Schema**: `database/schema/current_remote_schema.sql`
- **Chat Processor**: `supabase/functions/chat/processor/types.ts`
- **Token Data Capture**: `supabase/functions/chat/processor/builder.ts` (processingDetails)
- **Supabase Cron**: [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pg_cron)

---

**Research Complete**: ✅  
**Confidence Level**: High  
**Recommended Approach**: Option C - Dedicated Aggregation Table

