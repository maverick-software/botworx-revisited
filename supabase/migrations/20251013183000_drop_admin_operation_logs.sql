-- Drop admin_operation_logs table
-- Part of deprecated admin MCP management system cleanup
-- Date: October 13, 2025
-- Related archived code: archive/admin_mcp_system_20251013_122457/

-- Drop the table and all related objects
DROP TABLE IF EXISTS public.admin_operation_logs CASCADE;

-- Migration notes:
-- This table was part of the legacy admin MCP server management system
-- The related code (AdminMCPService, AdminMCPMarketplaceManagement, OneClickMCPDeployment)
-- has been archived to archive/admin_mcp_system_20251013_122457/
-- The /admin/marketplace route has been removed from the application

