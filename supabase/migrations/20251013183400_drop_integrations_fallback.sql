-- Drop integrations_fallback table
-- Part of database cleanup - table is empty and unused
-- Date: October 13, 2025

-- Table is empty with no active usage
-- Only appears in auto-generated TypeScript types

DROP TABLE IF EXISTS public.integrations_fallback CASCADE;

-- Migration notes:
-- Table reported as empty
-- Zero usage in Supabase functions or frontend code
-- Safe to remove

