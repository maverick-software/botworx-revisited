-- Drop mcp_server_type_summary view
-- Part of database cleanup - view is unused
-- Date: October 13, 2025

-- Note: This is a VIEW, not a table
-- It was created in the universal MCP support migration but is not used anywhere in the codebase

DROP VIEW IF EXISTS public.mcp_server_type_summary CASCADE;

-- Migration notes:
-- View created for MCP server type statistics
-- Zero usage in frontend or backend code
-- Data reported as empty
-- Safe to remove

