-- Force Remove MCP Tables - Alternative Approach
-- Date: 2025-06-25 13:00:00

-- Drop all MCP tables with CASCADE to remove dependencies
DROP TABLE IF EXISTS "public"."agent_mcp_connection_logs" CASCADE;
DROP TABLE IF EXISTS "public"."agent_mcp_connections" CASCADE; 
DROP TABLE IF EXISTS "public"."agent_mcp_server_access" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_server_deployments" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_server_status_logs" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_configurations" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_servers" CASCADE;
DROP TABLE IF EXISTS "public"."mcp_server_catalog" CASCADE;

-- Drop sequence
DROP SEQUENCE IF EXISTS "public"."mcp_servers_id_seq" CASCADE;

-- Drop MCP functions
DROP FUNCTION IF EXISTS "public"."get_agent_mcp_servers"("p_agent_id" "uuid") CASCADE;
DROP FUNCTION IF EXISTS "public"."get_available_mcp_servers"("p_user_id" "uuid") CASCADE;
DROP FUNCTION IF EXISTS "public"."grant_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid", "p_access_level" "text", "p_allowed_tools" "jsonb", "p_expires_at" timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS "public"."revoke_agent_mcp_access"("p_agent_id" "uuid", "p_instance_id" "uuid") CASCADE;

-- Remove MCP columns from account_tool_instances
ALTER TABLE IF EXISTS "public"."account_tool_instances" 
DROP COLUMN IF EXISTS "mcp_server_type" CASCADE,
DROP COLUMN IF EXISTS "mcp_server_capabilities" CASCADE,
DROP COLUMN IF EXISTS "mcp_transport_type" CASCADE;

-- Remove MCP column from organizations
ALTER TABLE IF EXISTS "public"."organizations" 
DROP COLUMN IF EXISTS "max_mcp_servers" CASCADE; 