-- Drop unused views with unrestricted RLS
-- Date: October 13, 2025
-- Reason: Views created but never used in code - only in auto-generated types

-- Investigation findings:
-- 1. These views were created as part of contact/permissions system
-- 2. Zero usage in frontend (src/) or backend (supabase/functions/)
-- 3. Only exist in database.types.ts (auto-generated)
-- 4. Have no RLS policies or unrestricted RLS
-- 5. Present security risk if exposed without proper access control

-- Drop summary/helper views that are unused
DROP VIEW IF EXISTS public.agent_permission_summary CASCADE;
DROP VIEW IF EXISTS public.agent_contact_permission_status CASCADE;
DROP VIEW IF EXISTS public.contact_interaction_summary CASCADE;
DROP VIEW IF EXISTS public.contact_group_hierarchy CASCADE;

-- Migration note:
-- These were created as convenience views for the contact system
-- but were never actually used in any queries
-- The underlying tables (agent_contact_permissions, contacts, etc.) 
-- are still present and actively used with proper RLS

-- If summary/reporting views are needed in future:
-- 1. Create them based on actual usage requirements
-- 2. Add proper RLS policies that filter by user_id/agent ownership
-- 3. Test with actual queries before deploying

