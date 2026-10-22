-- Drop entire toolbox/droplet MCP deployment system
-- Part of comprehensive system cleanup
-- Date: October 13, 2025
-- Archive: archive/toolbox_system_20251013_125624/

-- This migration removes the entire toolbox system which allowed users to provision
-- DigitalOcean droplets for deploying MCP servers. The system has been replaced by
-- the internal MCP system which handles MCP connections directly.

-- Related edge functions archived and deleted:
--   - toolbox-tools
--   - agent-toolbelt
--   - mcp-template-manager
--   - mcp-server-manager
--   - get-agent-tool-credentials

-- Drop tables in dependency order (children first, then parents)

-- Agent tool configuration tables
DROP TABLE IF EXISTS public.agent_tool_capability_permissions CASCADE;
DROP TABLE IF EXISTS public.agent_tool_credentials CASCADE;
DROP TABLE IF EXISTS public.agent_toolbelt_items CASCADE;
DROP TABLE IF EXISTS public.agent_toolbox_access CASCADE;

-- Tool instance and environment tables
DROP TABLE IF EXISTS public.account_tool_instances CASCADE;
DROP TABLE IF EXISTS public.account_tool_environments CASCADE;

-- Tool catalog
DROP TABLE IF EXISTS public.tool_catalog CASCADE;

-- SSH keys table (was used for droplet access)
DROP TABLE IF EXISTS public.user_ssh_keys CASCADE;

-- Drop related enums if they exist and are unused
DROP TYPE IF EXISTS public.tool_packaging_type_enum CASCADE;
DROP TYPE IF EXISTS public.catalog_tool_status_enum CASCADE;
DROP TYPE IF EXISTS public.account_tool_installation_status_enum CASCADE;
DROP TYPE IF EXISTS public.account_tool_environment_status_enum CASCADE;

-- Migration notes:
-- The toolbox system was deprecated in favor of direct MCP connections
-- Users no longer need to provision droplets for MCP servers
-- New system uses agent_mcp_connections table for universal MCP support
-- All toolbox-related code has been archived

