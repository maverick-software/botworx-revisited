-- Drop agent_droplet_tools and agent_droplets tables
-- Part of deprecated per-agent droplet system cleanup
-- Date: October 13, 2025
-- Architecture Change: Migrated to account-level shared droplets

-- These tables were part of the old architecture where each agent had its own droplet
-- New architecture uses:
--   - account_tool_environments (shared droplet per user account)
--   - account_tool_instances (tool instances on shared droplets)

-- Drop dependent table first
DROP TABLE IF EXISTS public.agent_droplet_tools CASCADE;

-- Drop parent table
DROP TABLE IF EXISTS public.agent_droplets CASCADE;

-- Migration notes:
-- Old System: One DigitalOcean droplet per agent
-- New System: One shared droplet per user account with multiple tool instances
-- The new tables (account_tool_environments, account_tool_instances) are actively used
-- These old tables only exist in database.types.ts (auto-generated) with no active usage

