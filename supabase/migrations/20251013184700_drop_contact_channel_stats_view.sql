-- Drop unused contact_channel_stats view
-- Date: October 13, 2025
-- Reason: View never used in code, only in auto-generated types

-- Investigation:
-- 1. contact_channel_stats VIEW exists
-- 2. Only 1 reference: database.types.ts (auto-generated)
-- 3. Zero usage in frontend (src/) or backend (supabase/functions/)
-- 4. Has no RLS policy defined
-- 5. The underlying table (contact_communication_channels) has proper RLS

-- The view aggregates channel statistics by user_id and channel_type
-- but it's never actually queried by any code

DROP VIEW IF EXISTS public.contact_channel_stats CASCADE;

-- Migration note:
-- The underlying table contact_communication_channels still exists
-- and has proper RLS policies for user data protection
-- If statistics are needed in future, can create new view with:
-- 1. Actual usage requirements
-- 2. Proper RLS filtering by auth.uid()
-- 3. Test with real queries before deploying

