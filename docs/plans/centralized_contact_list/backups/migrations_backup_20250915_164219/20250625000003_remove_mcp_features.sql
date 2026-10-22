-- Migration: Remove MCP Features
-- Date: 2025-06-25 12:45:00
-- Purpose: Remove all MCP-related tables, functions, columns, and constraints

-- Drop MCP-related functions first (to avoid dependency issues)
DROP FUNCTION IF EXISTS "public"."get_agent_mcp_servers"("p_agent_id" "uuid");
DROP FUNCTION IF EXISTS "public"."get_available_mcp_servers"("p_user_id" "uuid");
DROP FUNCTION IF EXISTS "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone);
DROP FUNCTION IF EXISTS "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid");

-- Drop MCP-related tables (order matters due to foreign key constraints)
DROP TABLE IF EXISTS "public"."agent_mcp_connection_logs" CASCADE;
DROP TABLE IF EXISTS "public"."agent_mcp_connections" CASCADE;
DROP TABLE IF EXISTS "public"."agent_mcp_server_access" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_server_deployments" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_server_status_logs" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_configurations" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_servers" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_server_catalog" CASCADE;

-- Drop MCP-related sequences
DROP SEQUENCE IF EXISTS "public"."mcp_servers_id_seq" CASCADE;

-- Remove MCP-related columns from existing tables
ALTER TABLE "public"."account_tool_instances" 
DROP COLUMN IF EXISTS "mcp_server_type",
DROP COLUMN IF EXISTS "mcp_server_capabilities",
DROP COLUMN IF EXISTS "mcp_transport_type";

ALTER TABLE "public"."organizations" 
DROP COLUMN IF EXISTS "max_mcp_servers";

-- Drop MCP-related indexes (if they still exist after table drops)
DROP INDEX IF EXISTS "idx_account_tool_instances_mcp_server_type";
DROP INDEX IF EXISTS "idx_agent_mcp_server_access_agent_id";
DROP INDEX IF EXISTS "idx_mcp_server_discovery";
DROP INDEX IF EXISTS "idx_mcp_servers_config_id";

-- Clean up any remaining MCP-related constraints
-- (Most should be removed with CASCADE, but being explicit)
ALTER TABLE "public"."account_tool_instances" 
DROP CONSTRAINT IF EXISTS "account_tool_instances_mcp_server_type_check",
DROP CONSTRAINT IF EXISTS "chk_mcp_server_required_fields";

-- Note: We're keeping account_tool_environments and account_tool_instances tables
-- as they may be used for non-MCP tools as well. Only removing MCP-specific columns.

COMMENT ON MIGRATION IS 'Removed all MCP (Model Context Protocol) related features including tables, functions, columns, and constraints while preserving core tool management functionality.'; 