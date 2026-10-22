-- Drop agent_tool_capabilities table
-- Part of database cleanup - table is empty and unused
-- Date: October 13, 2025

-- Note: This is different from agent_tool_capability_permissions which IS actively used
-- agent_tool_capabilities appears to be an orphaned/unused table

DROP TABLE IF EXISTS public.agent_tool_capabilities CASCADE;

-- Migration notes:
-- Table was reported as empty and not found in any codebase searches
-- No active usage in Supabase functions or frontend code
-- Safe to remove

