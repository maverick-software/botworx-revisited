# Aggregation Strategy Research - Token Usage Tracking

**Research Date**: October 22, 2025  
**Researcher**: AI Assistant  
**Status**: Complete

---

## Objective

Determine the optimal strategy for aggregating token usage data from raw chat messages into the `user_token_usage` table, including automation, scheduling, and historical backfill approaches.

---

## Aggregation Approaches Comparison

### Option A: Real-Time Trigger (INSERT)

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION aggregate_token_on_message_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert into user_token_usage for today
  INSERT INTO user_token_usage (
    user_id,
    period_start,
    period_end,
    period_type,
    total_tokens,
    message_count
  )
  VALUES (
    NEW.sender_user_id,
    DATE_TRUNC('day', NOW()),
    DATE_TRUNC('day', NOW()) + INTERVAL '1 day',
    'daily',
    COALESCE((NEW.metadata->>'tokens')::INTEGER, 0),
    1
  )
  ON CONFLICT (user_id, period_start, period_type)
  DO UPDATE SET
    total_tokens = user_token_usage.total_tokens + COALESCE((NEW.metadata->>'tokens')::INTEGER, 0),
    message_count = user_token_usage.message_count + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_token_usage_on_insert
AFTER INSERT ON chat_messages_v2
FOR EACH ROW
WHEN (NEW.role = 'assistant' AND NEW.metadata ? 'tokens')
EXECUTE FUNCTION aggregate_token_on_message_insert();
```

**Pros**:
- ✅ Always up-to-date (no delay)
- ✅ Simple to understand
- ✅ No scheduling needed

**Cons**:
- ❌ Adds overhead to every message insert
- ❌ Can slow down chat responses
- ❌ Doesn't handle historical data
- ❌ Harder to implement prompt/completion breakdown

**Verdict**: ❌ Not recommended (performance impact on chat)

---

### Option B: Scheduled Cron Job (RECOMMENDED) ✅

**Implementation**: Daily aggregation at midnight

```sql
-- Aggregation function
CREATE OR REPLACE FUNCTION aggregate_daily_token_usage()
RETURNS void AS $$
DECLARE
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
  v_period_start TIMESTAMP WITH TIME ZONE := v_yesterday::timestamp;
  v_period_end TIMESTAMP WITH TIME ZONE := (v_yesterday + INTERVAL '1 day')::timestamp;
BEGIN
  -- Insert or update daily token usage for all users with activity yesterday
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
    v_period_start,
    v_period_end,
    'daily',
    COALESCE(SUM((metadata->'processingDetails'->'llm_calls'->0->'response'->'usage'->>'prompt_tokens')::INTEGER), 0),
    COALESCE(SUM((metadata->'processingDetails'->'llm_calls'->0->'response'->'usage'->>'completion_tokens')::INTEGER), 0),
    COALESCE(SUM((metadata->>'tokens')::INTEGER), 0),
    COUNT(*),
    COUNT(DISTINCT conversation_id),
    ARRAY_AGG(DISTINCT sender_agent_id) FILTER (WHERE sender_agent_id IS NOT NULL),
    MAX(created_at)
  FROM chat_messages_v2
  WHERE sender_user_id IS NOT NULL
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
  
  RAISE NOTICE 'Aggregated token usage for %', v_yesterday;
END;
$$ LANGUAGE plpgsql;
```

**Schedule with pg_cron**:
```sql
-- Schedule daily aggregation at 12:05 AM UTC
SELECT cron.schedule(
  'aggregate-daily-token-usage',
  '5 0 * * *',  -- Run at 00:05 AM every day
  'SELECT aggregate_daily_token_usage();'
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
```

**Pros**:
- ✅ No performance impact on chat
- ✅ Handles bulk aggregation efficiently
- ✅ Easy to monitor and debug
- ✅ Can aggregate prompt/completion breakdown
- ✅ Can be re-run if issues occur
- ✅ Predictable schedule

**Cons**:
- ⚠️ 24-hour delay in admin UI (acceptable for analytics)
- ⚠️ Requires pg_cron extension (already enabled)

**Verdict**: ✅ **RECOMMENDED** - Best balance of performance and accuracy

---

### Option C: On-Demand via Edge Function

**Implementation**: Edge Function that can be called manually or via webhook

```typescript
// supabase/functions/aggregate-token-usage/index.ts
serve(async (req) => {
  // ... auth check (admin only or service role)
  
  const { userId, startDate, endDate } = await req.json();
  
  const supabaseAdmin = createClient(/* service role */);
  
  // Call aggregation function
  const { error } = await supabaseAdmin.rpc('aggregate_user_token_usage', {
    p_user_id: userId || null,  // null = all users
    p_start_date: startDate,
    p_end_date: endDate
  });
  
  if (error) throw error;
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

**Pros**:
- ✅ Can trigger manually when needed
- ✅ Can aggregate specific users or date ranges
- ✅ Useful for backfilling historical data
- ✅ Can be called from admin UI

**Cons**:
- ⚠️ Not automatic (requires manual triggering)
- ⚠️ Can timeout on large datasets

**Verdict**: ⚠️ **Use as supplement** to cron job for manual operations

---

## Recommended Hybrid Approach ✅

**Primary**: Scheduled cron job (Option B)  
**Secondary**: On-demand Edge Function (Option C) for manual operations

### Implementation Plan

#### 1. Database Function for Aggregation

```sql
-- Function that can aggregate for specific user or all users
CREATE OR REPLACE FUNCTION aggregate_user_token_usage(
  p_user_id UUID DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  users_processed INTEGER,
  records_created INTEGER,
  records_updated INTEGER
) AS $$
DECLARE
  v_start TIMESTAMP WITH TIME ZONE;
  v_end TIMESTAMP WITH TIME ZONE;
  v_period_start TIMESTAMP WITH TIME ZONE;
  v_period_end TIMESTAMP WITH TIME ZONE;
  v_users_processed INTEGER := 0;
  v_records_created INTEGER := 0;
  v_records_updated INTEGER := 0;
  v_user RECORD;
BEGIN
  -- Default to yesterday if no dates provided
  v_start := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '1 day');
  v_end := COALESCE(p_end_date, CURRENT_DATE);
  
  -- Loop through each day in the range
  v_period_start := DATE_TRUNC('day', v_start);
  
  WHILE v_period_start < v_end LOOP
    v_period_end := v_period_start + INTERVAL '1 day';
    
    -- Get list of users to process (either specific user or all with activity)
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
      -- Aggregate for this user and day
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
        COALESCE(SUM((metadata->'processingDetails'->'llm_calls'->0->'response'->'usage'->>'prompt_tokens')::INTEGER), 0),
        COALESCE(SUM((metadata->'processingDetails'->'llm_calls'->0->'response'->'usage'->>'completion_tokens')::INTEGER), 0),
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
      
      IF FOUND THEN
        v_records_updated := v_records_updated + 1;
      ELSE
        v_records_created := v_records_created + 1;
      END IF;
      
      v_users_processed := v_users_processed + 1;
    END LOOP;
    
    v_period_start := v_period_start + INTERVAL '1 day';
  END LOOP;
  
  RETURN QUERY SELECT v_users_processed, v_records_created, v_records_updated;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Cron Job Setup

```sql
-- Migration: 20251022000002_setup_token_usage_cron.sql

-- Schedule daily aggregation at 12:05 AM UTC
-- Runs every day and aggregates the previous day's data
SELECT cron.schedule(
  'aggregate-daily-token-usage',
  '5 0 * * *',  -- 00:05 AM UTC daily
  $$
  SELECT aggregate_user_token_usage(
    p_user_id := NULL,  -- All users
    p_start_date := CURRENT_DATE - INTERVAL '1 day',
    p_end_date := CURRENT_DATE
  );
  $$
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- Optional: Schedule weekly and monthly aggregations
SELECT cron.schedule(
  'aggregate-weekly-token-usage',
  '10 0 * * 0',  -- 00:10 AM UTC every Sunday
  $$
  SELECT aggregate_weekly_token_usage();  -- Separate function for weekly
  $$
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');
```

#### 3. Edge Function for Manual Triggering

```typescript
// supabase/functions/aggregate-token-usage/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Auth check (admin only)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    );
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: isAdmin } = await supabaseClient.rpc('user_has_role', {
      user_id: user?.id,
      role_name: 'admin'
    });
    
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Parse request
    const { userId, startDate, endDate } = await req.json();
    
    console.log(`Admin ${user?.id} triggering token aggregation`, {
      userId: userId || 'all',
      startDate,
      endDate
    });
    
    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    // Call aggregation function
    const { data, error } = await supabaseAdmin.rpc('aggregate_user_token_usage', {
      p_user_id: userId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null
    });
    
    if (error) {
      console.error("Aggregation error:", error);
      throw new Error(`Failed to aggregate: ${error.message}`);
    }
    
    console.log("Aggregation complete:", data);
    
    return new Response(JSON.stringify({
      success: true,
      result: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error("Error in aggregate-token-usage:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
```

---

## Historical Backfill Strategy

### Approach: Batched Processing

**Goal**: Aggregate all historical messages without timing out

**Implementation**:

```sql
-- Backfill function that processes one month at a time
CREATE OR REPLACE FUNCTION backfill_token_usage(
  p_start_date DATE,
  p_end_date DATE,
  p_batch_size INTEGER DEFAULT 30  -- Days per batch
)
RETURNS TABLE (
  batch_start DATE,
  batch_end DATE,
  users_processed INTEGER,
  status TEXT
) AS $$
DECLARE
  v_batch_start DATE := p_start_date;
  v_batch_end DATE;
  v_result RECORD;
BEGIN
  WHILE v_batch_start < p_end_date LOOP
    v_batch_end := LEAST(v_batch_start + p_batch_size, p_end_date);
    
    BEGIN
      -- Call main aggregation function for this batch
      SELECT * INTO v_result
      FROM aggregate_user_token_usage(
        p_user_id := NULL,
        p_start_date := v_batch_start::timestamp,
        p_end_date := v_batch_end::timestamp
      );
      
      RETURN QUERY SELECT 
        v_batch_start,
        v_batch_end,
        v_result.users_processed,
        'success'::TEXT;
        
      RAISE NOTICE 'Backfilled % to %: % users', v_batch_start, v_batch_end, v_result.users_processed;
      
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT 
        v_batch_start,
        v_batch_end,
        0,
        'error: ' || SQLERRM;
      
      RAISE WARNING 'Backfill failed for % to %: %', v_batch_start, v_batch_end, SQLERRM;
    END;
    
    v_batch_start := v_batch_end;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Usage**:
```sql
-- Backfill last 90 days (in 30-day batches)
SELECT * FROM backfill_token_usage(
  p_start_date := CURRENT_DATE - INTERVAL '90 days',
  p_end_date := CURRENT_DATE,
  p_batch_size := 30
);
```

**Alternative**: PowerShell script for controlled backfill

```powershell
# scripts/backfill-token-usage.ps1
param(
  [Parameter(Mandatory=$true)]
  [string]$ProjectRef,
  
  [Parameter(Mandatory=$false)]
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  
  [Parameter(Mandatory=$false)]
  [int]$DaysToBackfill = 90,
  
  [Parameter(Mandatory=$false)]
  [int]$BatchSizeDays = 7
)

$baseUrl = "https://$ProjectRef.supabase.co"
$headers = @{
  "apikey" = $ServiceRoleKey
  "Authorization" = "Bearer $ServiceRoleKey"
  "Content-Type" = "application/json"
}

$endDate = Get-Date
$currentDate = $endDate.AddDays(-$DaysToBackfill)

Write-Host "Starting backfill from $currentDate to $endDate"

while ($currentDate -lt $endDate) {
  $batchEnd = $currentDate.AddDays($BatchSizeDays)
  if ($batchEnd -gt $endDate) { $batchEnd = $endDate }
  
  Write-Host "Processing batch: $($currentDate.ToString('yyyy-MM-dd')) to $($batchEnd.ToString('yyyy-MM-dd'))"
  
  $body = @{
    userId = $null
    startDate = $currentDate.ToString('yyyy-MM-ddT00:00:00Z')
    endDate = $batchEnd.ToString('yyyy-MM-ddT23:59:59Z')
  } | ConvertTo-Json
  
  try {
    $response = Invoke-RestMethod -Uri "$baseUrl/functions/v1/aggregate-token-usage" -Method Post -Headers $headers -Body $body
    Write-Host "  ✓ Success: $($response.result.users_processed) users processed" -ForegroundColor Green
  } catch {
    Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
  }
  
  $currentDate = $batchEnd
  Start-Sleep -Seconds 2  # Rate limiting
}

Write-Host "Backfill complete!" -ForegroundColor Green
```

---

## Monitoring and Maintenance

### 1. Cron Job Status

```sql
-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname LIKE '%token%';

-- View job execution history
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%token%')
ORDER BY start_time DESC
LIMIT 20;
```

### 2. Data Quality Checks

```sql
-- Check for missing days
SELECT 
  user_id,
  period_start::DATE as missing_date
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) AS period_start
CROSS JOIN (
  SELECT DISTINCT user_id FROM user_token_usage
) AS users
WHERE NOT EXISTS (
  SELECT 1 FROM user_token_usage utu
  WHERE utu.user_id = users.user_id
    AND utu.period_start::DATE = period_start::DATE
    AND utu.period_type = 'daily'
)
ORDER BY user_id, missing_date;

-- Compare aggregated vs raw counts
SELECT 
  u.user_id,
  u.total_tokens as aggregated_tokens,
  (
    SELECT COALESCE(SUM((metadata->>'tokens')::INTEGER), 0)
    FROM chat_messages_v2
    WHERE sender_user_id = u.user_id
      AND role = 'assistant'
      AND DATE_TRUNC('day', created_at) = u.period_start
  ) as raw_tokens,
  u.total_tokens - (
    SELECT COALESCE(SUM((metadata->>'tokens')::INTEGER), 0)
    FROM chat_messages_v2
    WHERE sender_user_id = u.user_id
      AND role = 'assistant'
      AND DATE_TRUNC('day', created_at) = u.period_start
  ) as difference
FROM user_token_usage u
WHERE u.period_type = 'daily'
  AND u.period_start >= CURRENT_DATE - INTERVAL '7 days'
HAVING ABS(u.total_tokens - (
  SELECT COALESCE(SUM((metadata->>'tokens')::INTEGER), 0)
  FROM chat_messages_v2
  WHERE sender_user_id = u.user_id
    AND role = 'assistant'
    AND DATE_TRUNC('day', created_at) = u.period_start
)) > 0;
```

### 3. Performance Monitoring

```sql
-- Check aggregation performance
SELECT 
  period_start::DATE,
  COUNT(*) as users_aggregated,
  SUM(message_count) as total_messages,
  SUM(total_tokens) as total_tokens,
  MAX(updated_at) - MAX(period_end) as aggregation_delay
FROM user_token_usage
WHERE period_type = 'daily'
  AND period_start >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY period_start::DATE
ORDER BY period_start DESC;
```

---

## Recommendations Summary

### ✅ Primary Strategy: Scheduled Cron Job

**Why**:
1. **Performance**: No impact on chat operations
2. **Reliability**: Predictable schedule, easy to monitor
3. **Efficiency**: Bulk processing is faster than per-message
4. **Flexibility**: Can re-run if issues occur
5. **Scalability**: Handles millions of messages efficiently

**Implementation**:
- Daily cron at 00:05 AM UTC
- Aggregates previous day's data
- Processes all users in one job
- Stores in `user_token_usage` table

### ✅ Secondary Strategy: On-Demand Edge Function

**Use Cases**:
1. Manual backfill of historical data
2. Re-aggregation after data corrections
3. Admin-triggered updates for specific users
4. Testing and validation

**Implementation**:
- Edge Function: `aggregate-token-usage`
- Admin-only access
- Accepts date range and user ID parameters
- Returns processing statistics

### ✅ Backfill Strategy: Batched Processing

**Approach**:
- Process 7-30 days at a time
- Use PowerShell script or SQL function
- Include error handling and resume capability
- Monitor progress and validate results

---

## Migration Checklist

1. ✅ Create `aggregate_user_token_usage()` function
2. ✅ Create `backfill_token_usage()` function
3. ✅ Schedule cron job via migration
4. ✅ Create `aggregate-token-usage` Edge Function
5. ✅ Run backfill for historical data
6. ✅ Validate aggregated data accuracy
7. ✅ Monitor cron job execution
8. ✅ Document monitoring queries

---

**Research Complete**: ✅  
**Recommended Approach**: Hybrid (Cron + Edge Function)  
**Cron Schedule**: Daily at 00:05 AM UTC  
**Backfill Strategy**: 7-day batches via PowerShell script


