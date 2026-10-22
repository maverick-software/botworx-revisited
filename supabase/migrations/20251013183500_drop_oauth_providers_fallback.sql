-- Drop oauth_providers_fallback view and related migration artifacts
-- Part of database cleanup - migration fallback no longer needed
-- Date: October 13, 2025

-- This was a backward compatibility view created during oauth_providers → service_providers migration
-- The migration is complete and this fallback is no longer needed

-- Drop the view
DROP VIEW IF EXISTS public.oauth_providers_fallback CASCADE;

-- Drop related monitoring functions
DROP FUNCTION IF EXISTS public.log_oauth_providers_fallback() CASCADE;
DROP FUNCTION IF EXISTS public.get_migration_fallback_stats(integer) CASCADE;

-- Migration notes:
-- Created during service_providers migration for backward compatibility
-- Zero usage in Supabase functions or frontend code
-- Migration completed, fallback no longer needed
-- Safe to remove

