# Aggregation Workflow & Cron Design - Token Usage Tracking

**Planning Date**: October 22, 2025  
**Status**: Complete  
**Phase**: Planning (2.4)

---

## Objective

Design the automated token usage aggregation workflow, including cron job scheduling, backfill strategy, error handling, and monitoring for the token usage tracking system.

---

## Aggregation Strategy Overview

### Why Daily Aggregation?

**Reasons**:
1. **Performance**: Querying millions of raw messages is slow
2. **Cost**: Reduces database load and improves Edge Function response times
3. **Historical Analysis**: Pre-computed metrics for fast dashboard loading
4. **Scalability**: System scales to millions of messages without performance degradation

### Aggregation Schedule

```
┌─────────────┬─────────────────────────────────────────────┐
│   Schedule  │               Description                   │
├─────────────┼─────────────────────────────────────────────┤
│ Daily Cron  │ Runs at 1:00 AM UTC every day              │
│             │ Aggregates previous day's data             │
│             │ Catches up any missed days                 │
├─────────────┼─────────────────────────────────────────────┤
│ On-Demand   │ Manual trigger via Edge Function            │
│             │ Used for:                                   │
│             │ - Backfilling historical data              │
│             │ - Re-aggregating corrected data            │
│             │ - Testing and debugging                    │
└─────────────┴─────────────────────────────────────────────┘
```

---

## Cron Job Implementation

### Supabase pg_cron Setup

**File**: `supabase/migrations/20251022000002_create_token_aggregation_cron.sql`

```sql
-- =============================================================================
-- CRON JOB: Daily Token Usage Aggregation
-- =============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job to run daily at 1:00 AM UTC
-- This aggregates the previous day's token usage
SELECT cron.schedule(
  'aggregate-token-usage-daily',           -- Job name
  '0 1 * * *',                              -- Schedule (1:00 AM UTC daily)
  $$
    -- Call the aggregation function for yesterday
    SELECT aggregate_user_token_usage(
      p_user_id := NULL,                    -- All users
      p_start_date := CURRENT_DATE - INTERVAL '1 day',
      p_end_date := CURRENT_DATE
    );
  $$
);

-- Log successful cron job creation
DO $$
BEGIN
  RAISE NOTICE 'Token aggregation cron job created: runs daily at 1:00 AM UTC';
END
$$;

-- =============================================================================
-- OPTIONAL: Create a cron job status tracking table
-- =============================================================================

CREATE TABLE IF NOT EXISTS cron_job_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(255) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  users_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  duration_seconds NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cron_job_log_job_name ON cron_job_log(job_name);
CREATE INDEX idx_cron_job_log_started_at ON cron_job_log(started_at DESC);
CREATE INDEX idx_cron_job_log_status ON cron_job_log(status);

-- =============================================================================
-- MONITORING FUNCTION: Check cron job status
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cron_job_status(p_job_name VARCHAR DEFAULT 'aggregate-token-usage-daily')
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  active BOOLEAN,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  run_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cj.jobid,
    cj.schedule,
    cj.command,
    cj.active,
    jr.last_run,
    jr.next_run,
    jr.run_count
  FROM cron.job cj
  LEFT JOIN LATERAL (
    SELECT 
      MAX(runid) as last_runid,
      COUNT(*) as run_count,
      MAX(end_time) as last_run,
      cron.get_next_run_time(cj.schedule) as next_run
    FROM cron.job_run_details
    WHERE jobid = cj.jobid
  ) jr ON true
  WHERE cj.jobname = p_job_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_cron_job_status TO service_role;

-- =============================================================================
-- UTILITY: Manually trigger aggregation (for testing)
-- =============================================================================

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
  -- Call aggregation function
  SELECT * INTO v_result
  FROM aggregate_user_token_usage(
    p_user_id := NULL,
    p_start_date := p_start_date::timestamp,
    p_end_date := p_end_date::timestamp
  );
  
  v_duration := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time));
  
  -- Return results as JSON
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
```

---

## Backfill Strategy

### When to Backfill?

- **Initial Deployment**: Backfill all historical data from the start of chat_messages_v2
- **After Gaps**: If cron job fails for multiple days
- **Data Corrections**: If raw message data is corrected/updated

### Backfill Process

```
┌────────────────────────────────────────────────────────────┐
│                 BACKFILL WORKFLOW                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Determine Date Range                                   │
│     - Find earliest message in chat_messages_v2           │
│     - Check latest aggregated date in user_token_usage    │
│     - Calculate gap                                        │
│                                                            │
│  2. Batch Processing (30 days per batch)                   │
│     ┌────────────┐                                        │
│     │ Batch 1    │ Jan 1 - Jan 30                         │
│     └────────────┘                                        │
│     ┌────────────┐                                        │
│     │ Batch 2    │ Jan 31 - Mar 1                         │
│     └────────────┘                                        │
│     ┌────────────┐                                        │
│     │ Batch N    │ ...                                    │
│     └────────────┘                                        │
│                                                            │
│  3. Error Handling                                         │
│     - If batch fails, log error and continue              │
│     - Retry failed batches separately                     │
│     - Don't fail entire backfill due to one batch         │
│                                                            │
│  4. Validation                                             │
│     - Compare raw totals vs aggregated totals             │
│     - Check for missing days                              │
│     - Report discrepancies                                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Backfill SQL Query

```sql
-- Example: Backfill all historical data from Jan 1, 2025 to today
SELECT * FROM backfill_token_usage(
  p_start_date := '2025-01-01',
  p_end_date := CURRENT_DATE,
  p_batch_size := 30  -- 30 days per batch
);

-- Expected output:
--  batch_start | batch_end  | users_processed | records_created | records_updated | status  | duration_seconds 
-- -------------+------------+-----------------+-----------------+-----------------+---------+------------------
--  2025-01-01  | 2025-01-31 |              45 |             987 |               0 | success |             4.56
--  2025-02-01  | 2025-02-28 |              48 |            1123 |               0 | success |             5.12
--  2025-03-01  | 2025-03-31 |              52 |            1456 |               0 | success |             6.34
--  ...
```

### Backfill Edge Function

**File**: `supabase/functions/backfill-token-usage/index.ts`

**Purpose**: Admin-only endpoint to manually trigger historical backfill

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  batchSize?: number; // Optional, default 30
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify admin status (check JWT from request)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('roles!inner(name)')
      .eq('user_id', user.id)
      .eq('roles.name', 'admin')
      .maybeSingle();

    if (!roles) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required', code: 'FORBIDDEN' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json() as BackfillRequest;
    const { startDate, endDate, batchSize = 30 } = body;

    // Validate inputs
    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: startDate, endDate', 
          code: 'INVALID_REQUEST' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call database function
    const { data, error } = await supabaseClient.rpc('backfill_token_usage', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_batch_size: batchSize,
    });

    if (error) {
      console.error('[backfill-token-usage] Database error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message, 
          code: 'DATABASE_ERROR' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate summary
    const batches = data || [];
    const summary = {
      totalBatches: batches.length,
      successfulBatches: batches.filter((b: any) => b.status === 'success').length,
      failedBatches: batches.filter((b: any) => b.status !== 'success').length,
      totalUsersProcessed: batches.reduce((sum: number, b: any) => sum + (b.users_processed || 0), 0),
      totalRecordsCreated: batches.reduce((sum: number, b: any) => sum + (b.records_created || 0), 0),
      totalRecordsUpdated: batches.reduce((sum: number, b: any) => sum + (b.records_updated || 0), 0),
      totalDurationSeconds: batches.reduce((sum: number, b: any) => sum + (b.duration_seconds || 0), 0),
      dateRange: { start: startDate, end: endDate },
    };

    console.log('[backfill-token-usage] Backfill complete:', summary);

    return new Response(
      JSON.stringify({ success: true, data: { batches, summary } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[backfill-token-usage] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error', 
        code: 'INTERNAL_ERROR' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Error Handling & Recovery

### Cron Job Failure Scenarios

| Scenario | Impact | Recovery Strategy |
|----------|--------|-------------------|
| **Database Connection Timeout** | One day's data not aggregated | Automatic retry on next cron run (function catches up missing days) |
| **Out of Memory** | Partial aggregation | Reduce batch size, retry failed period |
| **Invalid Data** | Specific user's data not aggregated | Log error, continue with other users |
| **Extension Disabled** | Cron job doesn't run | Re-enable pg_cron, manually trigger backfill |
| **Function Error** | Day's aggregation fails | Check logs, fix bug, re-run manually |

### Automatic Catch-Up Logic

The `aggregate_user_token_usage` function automatically catches up missed days:

```sql
-- If cron job fails on Oct 20th, when it runs on Oct 21st:
-- It will check: "Is there data for Oct 19th?"
-- If not, it will aggregate Oct 19th, then Oct 20th

-- This ensures no days are skipped even if cron fails
```

### Manual Recovery Commands

```sql
-- 1. Check cron job status
SELECT * FROM get_cron_job_status('aggregate-token-usage-daily');

-- 2. Check recent cron runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'aggregate-token-usage-daily')
ORDER BY start_time DESC 
LIMIT 10;

-- 3. Find missing days
SELECT day::DATE as missing_date
FROM generate_series('2025-01-01'::DATE, CURRENT_DATE, '1 day'::interval) day
WHERE NOT EXISTS (
  SELECT 1 FROM user_token_usage
  WHERE period_start::DATE = day::DATE
  AND period_type = 'daily'
);

-- 4. Manually backfill missing days
SELECT * FROM backfill_token_usage(
  p_start_date := '2025-10-15',  -- First missing day
  p_end_date := '2025-10-20',    -- Last missing day
  p_batch_size := 5
);
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Cron Job Success Rate**
   - Alert if job fails 2+ consecutive days

2. **Aggregation Duration**
   - Baseline: <10 seconds for typical day
   - Alert if >60 seconds

3. **Data Completeness**
   - Check for missing days daily
   - Alert if gap detected

4. **User Coverage**
   - All active users should have recent data
   - Alert if major discrepancies

### Monitoring Query (Run Daily)

```sql
-- Daily health check query
WITH cron_status AS (
  SELECT 
    jobname,
    active,
    MAX(end_time) as last_run,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as recent_failures
  FROM cron.job j
  LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
  WHERE j.jobname = 'aggregate-token-usage-daily'
    AND jrd.start_time >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY jobname, active
),
missing_days AS (
  SELECT COUNT(*) as gap_count
  FROM generate_series(CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '1 day', '1 day') day
  WHERE NOT EXISTS (
    SELECT 1 FROM user_token_usage
    WHERE period_start::DATE = day::DATE AND period_type = 'daily'
  )
),
recent_aggregations AS (
  SELECT 
    COUNT(DISTINCT user_id) as users_with_data,
    SUM(total_tokens) as total_tokens_aggregated
  FROM user_token_usage
  WHERE period_start >= CURRENT_DATE - INTERVAL '7 days'
    AND period_type = 'daily'
)
SELECT 
  cs.jobname,
  cs.active as cron_active,
  cs.last_run,
  cs.recent_failures,
  md.gap_count as missing_days,
  ra.users_with_data,
  ra.total_tokens_aggregated,
  CASE 
    WHEN NOT cs.active THEN 'CRITICAL: Cron job disabled'
    WHEN cs.recent_failures > 2 THEN 'CRITICAL: Multiple failures'
    WHEN md.gap_count > 0 THEN 'WARNING: Missing days detected'
    WHEN cs.last_run < CURRENT_DATE - INTERVAL '2 days' THEN 'WARNING: Last run too old'
    ELSE 'OK'
  END as health_status
FROM cron_status cs
CROSS JOIN missing_days md
CROSS JOIN recent_aggregations ra;
```

---

## Performance Optimization

### Strategies

1. **Incremental Processing**
   - Only process new messages, not re-scan entire table
   - Use `metadata ? 'tokens'` filter to skip irrelevant messages

2. **Batch Size Tuning**
   - Default: 1 day at a time
   - Backfill: 30 days per batch
   - Adjust based on message volume

3. **Parallel Processing (Future)**
   - Process multiple users in parallel
   - Requires more complex orchestration

4. **Index Optimization**
   - Ensure indexes exist on:
     - `chat_messages_v2(sender_user_id, created_at)`
     - `chat_messages_v2(conversation_id)`
     - `user_token_usage(user_id, period_start)`

### Expected Performance

| Data Volume | Aggregation Time | Notes |
|-------------|------------------|-------|
| 1,000 messages/day | <5 seconds | Typical small deployment |
| 10,000 messages/day | <15 seconds | Medium deployment |
| 100,000 messages/day | <60 seconds | Large deployment |
| 1,000,000 messages/day | <300 seconds | Very large, consider partitioning |

---

## Deployment Checklist

### Pre-Deployment

- [ ] Review database migration for `user_token_usage` table
- [ ] Review database migration for cron job setup
- [ ] Test aggregation function with sample data
- [ ] Test backfill function with historical data
- [ ] Verify RLS policies work correctly
- [ ] Create monitoring dashboard

### Deployment Steps

1. **Apply Database Migrations**
   ```powershell
   supabase db push --include-all
   ```

2. **Deploy Edge Functions**
   ```powershell
   supabase functions deploy get-user-token-usage
   supabase functions deploy aggregate-token-usage
   supabase functions deploy backfill-token-usage
   ```

3. **Run Initial Backfill**
   ```powershell
   # Via API call (requires admin token)
   curl -X POST https://[PROJECT].supabase.co/functions/v1/backfill-token-usage \
     -H "Authorization: Bearer [ADMIN_JWT]" \
     -H "Content-Type: application/json" \
     -d '{ "startDate": "2025-01-01", "endDate": "2025-10-22", "batchSize": 30 }'
   ```

4. **Verify Cron Job**
   ```sql
   SELECT * FROM get_cron_job_status('aggregate-token-usage-daily');
   ```

5. **Test Frontend Integration**
   - Open Admin User Management page
   - Click "View Usage" on a user
   - Verify modal shows data and charts

### Post-Deployment

- [ ] Monitor cron job for first 7 days
- [ ] Check for any missing days
- [ ] Verify performance meets expectations
- [ ] Set up alerting for failures
- [ ] Document any edge cases discovered

---

## Future Enhancements

### Phase 2 (Optional)

1. **Weekly & Monthly Aggregations**
   - Aggregate daily data into weekly/monthly summaries
   - Separate cron jobs

2. **Agent-Level Metrics**
   - Track token usage per agent (not just per user)
   - Identify most expensive agents

3. **Cost Estimation**
   - Calculate $ cost based on token usage
   - Different rates for different models

4. **Usage Alerts**
   - Email admins when users exceed thresholds
   - Automatic warnings to high-usage users

5. **Real-Time Aggregation**
   - Trigger on message insert (via database trigger)
   - Update today's usage in near-real-time

---

**Aggregation Design Complete**: ✅  
**Cron Job**: Scheduled  
**Backfill Strategy**: Defined  
**Monitoring**: Planned

