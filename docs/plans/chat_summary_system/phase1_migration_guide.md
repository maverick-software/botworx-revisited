# Phase 1 Migration Guide - Conversation Summary System

## Overview

This guide walks through applying the database migration for the Conversation Summary System and verifying it works correctly.

## Prerequisites

- Supabase CLI installed
- Supabase project configured locally
- PostgreSQL 14+ (for pg_vector support)
- Access to Supabase dashboard

## Step 1: Review the Migration

The migration file is located at:
```
supabase/migrations/20251006151102_create_conversation_summary_system.sql
```

**What it creates:**
- `conversation_summaries` table with vector search
- `working_memory_chunks` table for short-term context
- `conversation_summary_boards` table for background agent "whiteboard"
- HNSW indexes for fast vector similarity search
- Helper functions for cleanup and timestamp updates
- RLS policies for security

## Step 2: Apply the Migration (Local)

### Option A: Using Supabase CLI (Recommended)

```powershell
# Reset local database to test migration from scratch (OPTIONAL)
# WARNING: This will delete all local data!
# supabase db reset

# Apply all pending migrations
supabase db push
```

### Option B: Manual Application (Testing)

```powershell
# Apply migration directly to local database
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/20251006151102_create_conversation_summary_system.sql
```

## Step 3: Verify Migration

Run the test script to verify everything is working:

```powershell
# Using Supabase CLI
supabase db execute -f supabase/migrations/test_conversation_summary_system.sql

# OR using psql directly
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/migrations/test_conversation_summary_system.sql
```

**Expected Output:**
```
NOTICE:  ✅ Test 1 PASSED: pg_vector extension is enabled
NOTICE:  ✅ Test 2 PASSED: All tables created successfully
NOTICE:  ✅ Test 3 PASSED: HNSW vector indexes created
NOTICE:  ✅ Test 4 PASSED: Row Level Security enabled on all tables
NOTICE:  ✅ Test 5 PASSED: All helper functions created
NOTICE:  ✅ Test 6 PASSED: Vector similarity search working (similarity: 1.0)
NOTICE:  🧹 Test data cleaned up
NOTICE:  ✅ Test 7 PASSED: Cleanup function executed (cleaned 0 chunks)
NOTICE:  ✅ Test 8 PASSED: All triggers created and active
NOTICE:  ════════════════════════════════════════════════════════════
NOTICE:  🎉 ALL TESTS PASSED! Conversation Summary System is ready.
NOTICE:  ════════════════════════════════════════════════════════════
```

## Step 4: Verify in Supabase Dashboard

1. Open Supabase Studio (local or cloud)
2. Navigate to **Table Editor**
3. Verify these tables exist:
   - `conversation_summaries`
   - `working_memory_chunks`
   - `conversation_summary_boards`

4. Check each table's structure:
   - Should see `embedding` column with type `vector(1536)`
   - Verify indexes are created (check Database → Indexes)

## Step 5: Test Vector Search Manually

```sql
-- Insert a test summary with a mock embedding
INSERT INTO conversation_summaries (
  conversation_id,
  agent_id,
  user_id,
  summary_text,
  embedding,
  message_count
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM agents LIMIT 1),
  auth.uid(),
  'This is a test conversation about email automation using Gmail',
  array_fill(0.1::float, ARRAY[1536])::VECTOR(1536),
  15
);

-- Test vector similarity search
SELECT 
  id,
  summary_text,
  1 - (embedding <=> array_fill(0.1::float, ARRAY[1536])::VECTOR(1536)) AS similarity
FROM conversation_summaries
ORDER BY embedding <=> array_fill(0.1::float, ARRAY[1536])::VECTOR(1536)
LIMIT 5;

-- Cleanup test data
DELETE FROM conversation_summaries 
WHERE summary_text LIKE '%This is a test%';
```

## Step 6: Apply to Production (When Ready)

**⚠️ IMPORTANT**: Only after thorough local testing

```powershell
# Using Supabase CLI (recommended)
supabase db push --include-all

# This will prompt you to confirm before applying to production
```

## Troubleshooting

### Issue: pg_vector extension not found

**Solution**:
```sql
-- Manually enable the extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: Permission denied errors

**Solution**: Ensure you're using the service role key or have proper admin permissions

### Issue: HNSW index creation fails

**Solution**: This usually means pg_vector isn't properly installed. Check Supabase version supports pg_vector (should be available on all recent versions)

### Issue: RLS policies blocking access

**Solution**: Service role operations should bypass RLS. If testing as a user, ensure the user has proper authentication.

## Verification Checklist

Before proceeding to Phase 1.2, verify:

- [ ] All tables created successfully
- [ ] pg_vector extension is enabled
- [ ] HNSW indexes exist and are functional
- [ ] RLS policies are in place
- [ ] Helper functions work correctly
- [ ] Triggers are active
- [ ] Test script passes all tests
- [ ] No errors in Supabase logs

## Next Steps

Once migration is verified:

1. ✅ Mark Phase 1.1 as complete
2. 🔄 Begin Phase 1.2: Background Summarization Service
3. 🔄 Create Edge Function: `conversation-summarizer`
4. 🔄 Implement trigger system for async updates

## Rollback Plan

If issues arise, you can rollback the migration:

```sql
-- Drop tables (this will cascade to dependent objects)
DROP TABLE IF EXISTS conversation_summary_boards CASCADE;
DROP TABLE IF EXISTS working_memory_chunks CASCADE;
DROP TABLE IF EXISTS conversation_summaries CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_working_memory() CASCADE;
DROP FUNCTION IF EXISTS update_summary_board_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_summary_timestamp() CASCADE;

-- Note: pg_vector extension will remain (safe to keep for future use)
```

## Support

For issues or questions:
- Check `logs/chat_summary_implementation_20251006.log`
- Review migration file for detailed comments
- Consult main implementation plan: `docs/plans/chat_summary_system/implementation_plan.md`

---

**Last Updated**: October 6, 2025  
**Status**: Phase 1.1 Complete - Ready for Phase 1.2

