-- Drop organization/multi-tenancy tables
-- Part of database cleanup
-- Date: October 13, 2025

-- These tables were designed for enterprise/multi-tenant functionality that was never implemented
-- Comment: "Multi-tenant organizations for MCP server management" with subscription tiers
-- All tables are empty and not actively used in the codebase

-- Drop in dependency order
DROP TABLE IF EXISTS public.organization_api_keys CASCADE;      -- Empty, for programmatic org access
DROP TABLE IF EXISTS public.organization_invitations CASCADE;   -- Empty, pending org invitations
DROP TABLE IF EXISTS public.organization_memberships CASCADE;   -- Empty, user memberships in orgs
DROP TABLE IF EXISTS public.organizations CASCADE;              -- Empty, multi-tenant org management

-- Drop related functions/validation
DROP FUNCTION IF EXISTS public.validate_organization_slug(text) CASCADE;

-- Migration notes:
-- These tables were planned for enterprise/multi-tenant features:
-- - Organization management with roles (admin, member, viewer)
-- - API keys for programmatic access
-- - Invitation system
-- - Subscription tiers (free, pro, enterprise)
-- - Max concurrent connections management
--
-- Since the feature was never implemented and tables are empty, safe to remove
-- If multi-tenancy is needed in future, can implement from scratch with modern requirements

