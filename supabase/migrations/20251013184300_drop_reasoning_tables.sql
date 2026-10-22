-- Drop unused reasoning tables
-- Date: October 13, 2025
-- Reason: Tables are empty - advanced-reasoning feature not being used

-- Investigation findings:
-- 1. Code exists: advanced-reasoning edge function has full implementation
-- 2. INSERT statements exist: Both reasoning_sessions and reasoning_steps have proper inserts
-- 3. BUT: Tables are completely empty - feature never used by user
-- 4. The advanced-reasoning system is a complex iterative reasoning feature that's not actively used

-- Related edge function: advanced-reasoning/
-- - Implements iterative Markov chain reasoning
-- - Has ~1000+ lines of sophisticated reasoning logic
-- - Creates sessions and tracks reasoning steps
-- - Feature exists but is not called/used

DROP TABLE IF EXISTS public.reasoning_steps CASCADE;
DROP TABLE IF EXISTS public.reasoning_sessions CASCADE;

-- Migration note:
-- If advanced reasoning is needed in future, the edge function still exists
-- Tables can be recreated from the original migration schema
-- Current state: Feature implemented but not actively used

