-- Drop redundant safe_agent_mcp_connections view
-- Date: October 13, 2025
-- Reason: View is never used in code - redundant with RLS on agent_mcp_connections table

-- Investigation findings:
-- 1. safe_agent_mcp_connections VIEW created for security (hide URLs)
-- 2. BUT: Zero references in codebase (not used anywhere)
-- 3. The actual agent_mcp_connections table already has:
--    - Proper RLS policies (users only see their own connections)
--    - Vault-encrypted URLs (vault_server_url_id)
--    - Security triggers preventing plain-text URLs
-- 4. All code uses agent_mcp_connections table directly, not the VIEW

-- The VIEW was an extra security layer that was never actually used
-- RLS on the base table provides the same protection

DROP VIEW IF EXISTS public.safe_agent_mcp_connections CASCADE;

-- Migration note:
-- All MCP connection access goes through agent_mcp_connections table with RLS
-- No code references to the safe view exist
-- Security is maintained via RLS policies on the base table

