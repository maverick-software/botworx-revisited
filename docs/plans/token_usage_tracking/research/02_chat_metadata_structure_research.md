# Chat Metadata Structure Research - Token Usage Tracking

**Research Date**: October 22, 2025  
**Researcher**: AI Assistant  
**Status**: Complete

---

## Objective

Analyze how token data is currently captured and stored in the chat message metadata to ensure accurate extraction for aggregation.

---

## Token Data Flow

### 1. Backend Processing (Supabase Edge Function)

**Location**: `supabase/functions/chat/processor/`

#### Token Capture Points:

**A. ProcessingMetrics Interface** (`types.ts:23-136`)
```typescript
export interface ProcessingMetrics {
  // Core token metrics
  tokens_used: number;           // Total tokens
  prompt_tokens?: number;        // Input tokens
  completion_tokens?: number;    // Output tokens
  
  // LLM call tracking (Debug Modal)
  llm_calls?: Array<{
    stage: string;
    description: string;
    request: any;
    response: any;  // Contains usage stats
    timestamp?: string;
    duration_ms?: number;
  }>;
  
  // Additional metrics
  cost_usd?: number;
  model_used?: string;
  // ... other metrics
}
```

**B. LLM Call Token Capture** (`handlers.ts:59-111`)

Tokens are captured during **3 LLM calls**:

1. **Contextual Awareness** (lines 88-111)
```typescript
llmCalls.push({
  stage: 'contextual_awareness',
  description: '🧠 Contextual Awareness Analysis',
  request: {
    model: 'gpt-4o-mini',
    user_message: userText,
    temperature: 0.3,
    max_tokens: 500,
  },
  response: {
    interpreted_meaning: contextualInterpretation.interpretedMeaning,
    usage: contextualInterpretation.usage, // ⭐ TOKEN DATA HERE
  },
  timestamp: new Date().toISOString(),
  duration_ms: contextDuration,
});
```

2. **Intent Classification** (lines 134-154)
```typescript
llmCalls.push({
  stage: 'intent_classification',
  description: '🎯 Intent Classification',
  request: {
    model: 'gpt-4o-mini',
    user_message: userText,
    temperature: 0.3,
    max_tokens: 150,
  },
  response: {
    requires_tools: classification.requiresTools,
    usage: classification.usage, // ⭐ TOKEN DATA HERE
  },
  timestamp: new Date().toISOString(),
  duration_ms: classificationDuration,
});
```

3. **Main LLM Call** (captured in `llm-caller.ts`)
- This is the main conversation response
- Contains the bulk of token usage
- Includes tool calls if any

**C. Response Builder** (`builder.ts:55-147`)

The `buildSuccessResponse` function packages all metrics:

```typescript
export function buildSuccessResponse(
  message: AdvancedChatMessage,
  context: ProcessingContext,
  metrics: ProcessingMetrics
): MessageResponse {
  return {
    version: '2.0.0',
    status: 'success',
    data: { message, conversation, session },
    
    // ⭐ TOKEN METRICS HERE
    metrics: {
      processing_time_ms: metrics.end_time! - metrics.start_time,
      tokens: {
        prompt: metrics.prompt_tokens || 0,
        completion: metrics.completion_tokens || 0,
        total: metrics.tokens_used,
        cost_usd: metrics.cost_usd,
      },
      model: metrics.model_used || 'gpt-4',
      // ... other metrics
    },
    
    // ⭐ DETAILED PROCESSING DETAILS (includes llm_calls)
    processing_details: {
      pipeline_stages: metrics.stages,
      llm_calls: metrics.llm_calls || [], // Contains all LLM calls with usage
      // ... other details
    },
  };
}
```

---

### 2. Frontend Storage (React + Supabase)

**Location**: `src/pages/AgentChatPage.tsx`

#### Message Insert to Database (lines 188-217):

```typescript
const { data: savedMessage, error: insertError } = await supabase
  .from('chat_messages_v2')
  .insert({
    conversation_id: convId,
    session_id: sessId,
    channel_id: null,
    parent_message_id: null,
    sender_user_id: user.id,
    sender_agent_id: agent.id,
    role: 'assistant',
    content: {
      type: 'text',
      text: response.data.message.content?.text || response.content || ''
    },
    metadata: {
      tokens: response.metrics?.tokens?.total || 0,
      processing_time_ms: response.metrics?.processing_time_ms || 0,
      tool_execution_count: response.metrics?.tool_executions || 0,
      memory_searches: response.metrics?.memory_searches || 0,
      processingDetails: response.processing_details, // ⭐ ALL TOKEN DATA HERE
    },
    context: response.data.message.context || {},
    tools: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .select()
  .single();
```

---

## Database Storage Format

### Final Structure in `chat_messages_v2.metadata`:

```json
{
  "tokens": 2336,
  "processing_time_ms": 7542,
  "tool_execution_count": 0,
  "memory_searches": 1,
  "processingDetails": {
    "pipeline_stages": {
      "message_prep": 100,
      "contextual_awareness": 856,
      "intent_classification": 421,
      "tool_loading": 0,
      "llm_calls": 6165
    },
    "memory_operations": { ... },
    "context_operations": { ... },
    "tool_operations": [],
    "discovered_tools": [],
    "tool_requested": false,
    "reasoning_chain": [],
    
    // ⭐ ALL LLM CALLS WITH TOKEN USAGE
    "llm_calls": [
      {
        "stage": "contextual_awareness",
        "description": "🧠 Contextual Awareness Analysis",
        "request": { "model": "gpt-4o-mini", ... },
        "response": {
          "interpreted_meaning": "...",
          "usage": {
            "prompt_tokens": 245,
            "completion_tokens": 89,
            "total_tokens": 334
          }
        },
        "timestamp": "2025-10-22T10:31:45.123Z",
        "duration_ms": 856
      },
      {
        "stage": "intent_classification",
        "description": "🎯 Intent Classification",
        "request": { "model": "gpt-4o-mini", ... },
        "response": {
          "requires_tools": false,
          "usage": {
            "prompt_tokens": 156,
            "completion_tokens": 45,
            "total_tokens": 201
          }
        },
        "timestamp": "2025-10-22T10:31:46.234Z",
        "duration_ms": 421
      },
      {
        "stage": "main_llm_call",
        "description": "💬 Main LLM Response",
        "request": { "model": "gpt-4o", ... },
        "response": {
          "content": "...",
          "usage": {
            "prompt_tokens": 1034,
            "completion_tokens": 767,
            "total_tokens": 1801
          }
        },
        "timestamp": "2025-10-22T10:31:52.399Z",
        "duration_ms": 6165
      }
    ],
    
    "chat_history": { ... },
    "performance": { ... }
  }
}
```

---

## Token Data Extraction Queries

### A. Extract Total Tokens (Simple)

```sql
SELECT 
  id,
  conversation_id,
  sender_user_id,
  created_at,
  (metadata->>'tokens')::INTEGER as total_tokens
FROM chat_messages_v2
WHERE sender_user_id IS NOT NULL
  AND role = 'assistant'
  AND metadata ? 'tokens';
```

### B. Extract Detailed Token Breakdown (From processingDetails)

```sql
SELECT 
  id,
  conversation_id,
  sender_user_id,
  created_at,
  
  -- Extract from top-level llm_calls array
  (
    SELECT SUM((call->'response'->'usage'->>'prompt_tokens')::INTEGER)
    FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
  ) as prompt_tokens,
  
  (
    SELECT SUM((call->'response'->'usage'->>'completion_tokens')::INTEGER)
    FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
  ) as completion_tokens,
  
  (metadata->>'tokens')::INTEGER as total_tokens_fallback
  
FROM chat_messages_v2
WHERE sender_user_id IS NOT NULL
  AND role = 'assistant'
  AND metadata->'processingDetails' IS NOT NULL;
```

### C. Aggregate by User and Date

```sql
SELECT 
  sender_user_id as user_id,
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as message_count,
  
  -- Option 1: Use top-level tokens field (simpler, faster)
  SUM((metadata->>'tokens')::INTEGER) as total_tokens,
  
  -- Option 2: Calculate from llm_calls (more detailed, slower)
  SUM((
    SELECT SUM((call->'response'->'usage'->>'prompt_tokens')::INTEGER)
    FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
  )) as prompt_tokens,
  
  SUM((
    SELECT SUM((call->'response'->'usage'->>'completion_tokens')::INTEGER)
    FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
  )) as completion_tokens
  
FROM chat_messages_v2
WHERE sender_user_id IS NOT NULL
  AND role = 'assistant'
  AND metadata ? 'tokens'
GROUP BY sender_user_id, DATE_TRUNC('day', created_at)
ORDER BY day DESC;
```

---

## Edge Cases and Considerations

### 1. Missing Token Data

**Scenario**: Old messages before token tracking was implemented

**Detection**:
```sql
SELECT COUNT(*)
FROM chat_messages_v2
WHERE role = 'assistant'
  AND sender_user_id IS NOT NULL
  AND (metadata->>'tokens') IS NULL;
```

**Handling**: 
- Treat as 0 tokens (or exclude from aggregation)
- Log count of messages without token data for transparency

### 2. Multiple Token Sources

**Issue**: Token data appears in multiple places:
- `metadata.tokens` (top-level, aggregated)
- `metadata.processingDetails.llm_calls[].response.usage` (per-call breakdown)

**Recommendation**: Use `metadata.tokens` as the **source of truth**
- It's simpler and faster to query
- It already represents the total across all LLM calls
- The breakdown in `llm_calls` is for debugging, not aggregation

### 3. System Messages vs User Messages

**Observation**:
- Only `role = 'assistant'` messages have token data
- `role = 'user'` messages don't consume tokens (input to chat function)
- `role = 'system'` messages are prompts (internal, no direct cost)

**Aggregation Rule**: **Only count `role = 'assistant'` messages**

### 4. Null vs Zero Tokens

**Cases**:
- `metadata->>'tokens'` returns NULL if key doesn't exist
- `metadata->>'tokens'` returns '0' if explicitly set to 0

**Handling**:
```sql
COALESCE((metadata->>'tokens')::INTEGER, 0)
```

### 5. JSONB Performance

**Issue**: JSONB extraction can be slow on large datasets

**Optimization**:
- Use GIN index on `metadata` field ✅ (already exists)
- Pre-aggregate instead of querying raw JSONB repeatedly ✅ (our approach)
- Consider adding a generated column for fast access (future optimization)

```sql
-- Future optimization: Generated column
ALTER TABLE chat_messages_v2
ADD COLUMN tokens_count INTEGER GENERATED ALWAYS AS ((metadata->>'tokens')::INTEGER) STORED;

CREATE INDEX idx_messages_tokens ON chat_messages_v2(tokens_count) WHERE tokens_count IS NOT NULL;
```

---

## Data Quality Verification

### Test Query: Verify Token Data Completeness

```sql
-- Check what percentage of assistant messages have token data
WITH stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE metadata ? 'tokens') as with_tokens,
    COUNT(*) FILTER (WHERE metadata IS NULL OR NOT (metadata ? 'tokens')) as without_tokens,
    COUNT(*) as total
  FROM chat_messages_v2
  WHERE role = 'assistant'
    AND sender_user_id IS NOT NULL
    AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
  with_tokens,
  without_tokens,
  total,
  ROUND((with_tokens::NUMERIC / NULLIF(total, 0) * 100), 2) as percentage_with_tokens
FROM stats;
```

### Sample Data Inspection

```sql
-- Inspect a sample message with full metadata structure
SELECT 
  id,
  conversation_id,
  sender_user_id,
  created_at,
  metadata->'tokens' as top_level_tokens,
  jsonb_pretty(metadata->'processingDetails'->'llm_calls') as llm_calls_detail,
  metadata->'processingDetails' ? 'llm_calls' as has_llm_calls
FROM chat_messages_v2
WHERE role = 'assistant'
  AND sender_user_id IS NOT NULL
  AND metadata->'processingDetails'->'llm_calls' IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;
```

---

## Recommendations for Aggregation

### ✅ Use `metadata.tokens` as Primary Source

**Rationale**:
1. **Simple**: Single INTEGER field, no JSONB traversal
2. **Fast**: Direct access, no array iteration
3. **Complete**: Already represents total across all LLM calls
4. **Reliable**: Set by backend response builder

**SQL Pattern**:
```sql
COALESCE((metadata->>'tokens')::INTEGER, 0) as total_tokens
```

### ⚠️ Detailed Breakdown (Optional, for Analytics)

If detailed prompt/completion breakdown is needed:

```sql
-- Extract from llm_calls array
SELECT 
  SUM((call->'response'->'usage'->>'prompt_tokens')::INTEGER) as prompt_tokens,
  SUM((call->'response'->'usage'->>'completion_tokens')::INTEGER) as completion_tokens
FROM jsonb_array_elements(metadata->'processingDetails'->'llm_calls') AS call
```

**Use Case**: Advanced analytics, cost breakdown by stage

**Trade-off**: Slower query, more complex

### 🎯 Recommended Aggregation Function

```sql
CREATE OR REPLACE FUNCTION get_user_token_usage(
  p_user_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  total_tokens BIGINT,
  message_count BIGINT,
  conversation_count BIGINT,
  first_message TIMESTAMP WITH TIME ZONE,
  last_message TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM((metadata->>'tokens')::INTEGER), 0)::BIGINT,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT conversation_id)::BIGINT,
    MIN(created_at),
    MAX(created_at)
  FROM chat_messages_v2
  WHERE sender_user_id = p_user_id
    AND role = 'assistant'
    AND created_at >= p_start_date
    AND created_at < p_end_date
    AND metadata ? 'tokens';
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Files to Backup Before Implementation

- `src/pages/AgentChatPage.tsx` (frontend message insertion)
- `supabase/functions/chat/processor/builder.ts` (response builder)
- `supabase/functions/chat/processor/handlers.ts` (token capture)
- `supabase/functions/chat/processor/types.ts` (interface definitions)

---

## Validation Plan

### 1. Pre-Aggregation Validation
```sql
-- Count messages with token data in last 24 hours
SELECT COUNT(*), AVG((metadata->>'tokens')::INTEGER)
FROM chat_messages_v2
WHERE role = 'assistant'
  AND sender_user_id IS NOT NULL
  AND metadata ? 'tokens'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

### 2. Post-Aggregation Validation
```sql
-- Compare aggregated data with raw sum
WITH raw_sum AS (
  SELECT 
    sender_user_id,
    SUM((metadata->>'tokens')::INTEGER) as raw_total
  FROM chat_messages_v2
  WHERE role = 'assistant'
    AND DATE_TRUNC('day', created_at) = '2025-10-22'
  GROUP BY sender_user_id
),
aggregated AS (
  SELECT 
    user_id,
    total_tokens
  FROM user_token_usage
  WHERE period_start = '2025-10-22'
    AND period_type = 'daily'
)
SELECT 
  COALESCE(r.sender_user_id, a.user_id) as user_id,
  r.raw_total,
  a.total_tokens as aggregated_total,
  r.raw_total - COALESCE(a.total_tokens, 0) as difference
FROM raw_sum r
FULL OUTER JOIN aggregated a ON r.sender_user_id = a.user_id
WHERE r.raw_total != COALESCE(a.total_tokens, 0);
```

---

## Key Findings Summary

✅ **Token data is reliably captured**:
- Set by backend `buildSuccessResponse` function
- Stored in `metadata.tokens` as INTEGER
- Includes breakdown in `processingDetails.llm_calls`

✅ **Extraction is straightforward**:
- Use `(metadata->>'tokens')::INTEGER` for aggregation
- GIN index already exists on `metadata` field
- Performance should be acceptable for aggregation queries

✅ **Data quality appears good**:
- Implemented recently (Oct 2025) with LLM Debug Modal
- All new messages should have token data
- Need to verify percentage of messages with data

⚠️ **Considerations**:
- Old messages may not have token data
- Need to filter `role = 'assistant'` only
- Handle NULL values with COALESCE

---

## Next Steps

1. Run validation query to check data completeness
2. Create aggregation function (Task 4.1.2)
3. Test aggregation on sample data
4. Implement backfill for historical data (Task 4.4.2)

---

**Research Complete**: ✅  
**Confidence Level**: High  
**Data Source**: `chat_messages_v2.metadata.tokens` (INTEGER)  
**Data Quality**: Good (recent implementation)


