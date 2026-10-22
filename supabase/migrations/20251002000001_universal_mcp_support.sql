-- Migration: Universal MCP Support
-- Convert Zapier-specific MCP system to universal MCP system
-- This migration enables support for ANY MCP-compliant server (Zapier, Retell, Anthropic, OpenAI, custom, etc.)

-- Step 1: Drop the restrictive connection type constraint
ALTER TABLE agent_mcp_connections 
  DROP CONSTRAINT IF EXISTS valid_connection_type;

-- Step 2: Update connection_type column to be more flexible
-- Set default to 'generic' for new connections
ALTER TABLE agent_mcp_connections 
  ALTER COLUMN connection_type SET DEFAULT 'generic';

-- Step 3: Add server capabilities column for MCP server metadata
ALTER TABLE agent_mcp_connections 
  ADD COLUMN IF NOT EXISTS server_capabilities JSONB DEFAULT '{}';

-- Step 4: Add server info column for storing initialize response data
ALTER TABLE agent_mcp_connections 
  ADD COLUMN IF NOT EXISTS server_info JSONB DEFAULT '{}';

-- Step 5: Add protocol version column
ALTER TABLE agent_mcp_connections 
  ADD COLUMN IF NOT EXISTS protocol_version TEXT DEFAULT '2024-11-05';

-- Step 6: Add last successful call timestamp for health monitoring
ALTER TABLE agent_mcp_connections 
  ADD COLUMN IF NOT EXISTS last_successful_call TIMESTAMPTZ;

-- Step 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_mcp_connections_type 
  ON agent_mcp_connections(connection_type, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_agent_mcp_connections_protocol 
  ON agent_mcp_connections(protocol_version);

-- Step 8: Create GIN index for server_capabilities JSONB queries
CREATE INDEX IF NOT EXISTS idx_agent_mcp_connections_capabilities 
  ON agent_mcp_connections USING GIN(server_capabilities);

-- Step 9: Add helpful comments for documentation
COMMENT ON COLUMN agent_mcp_connections.connection_type IS 
  'Type of MCP server (e.g., zapier, retell, anthropic, openai, custom, generic). No validation constraint - any MCP-compliant server is supported.';

COMMENT ON COLUMN agent_mcp_connections.server_capabilities IS 
  'MCP server capabilities discovered during initialization. Includes available features like tools, prompts, resources, sampling.';

COMMENT ON COLUMN agent_mcp_connections.server_info IS 
  'Server information from MCP initialize response (name, version, vendor, etc.)';

COMMENT ON COLUMN agent_mcp_connections.protocol_version IS 
  'MCP protocol version supported by this connection (e.g., 2024-11-05, 2025-06-18)';

COMMENT ON COLUMN agent_mcp_connections.last_successful_call IS 
  'Timestamp of last successful tool execution. Used for health monitoring and connection validation.';

-- Step 10: Create function to get server type statistics
CREATE OR REPLACE FUNCTION public.get_mcp_server_type_stats()
RETURNS TABLE(
  server_type TEXT,
  active_connections BIGINT,
  total_connections BIGINT,
  total_tools BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    amc.connection_type as server_type,
    COUNT(*) FILTER (WHERE amc.is_active = true) as active_connections,
    COUNT(*) as total_connections,
    COUNT(mtc.id) as total_tools
  FROM agent_mcp_connections amc
  LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
  GROUP BY amc.connection_type
  ORDER BY active_connections DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Create function to validate MCP server health
CREATE OR REPLACE FUNCTION public.check_mcp_server_health(p_connection_id UUID)
RETURNS TABLE(
  is_healthy BOOLEAN,
  status TEXT,
  last_call TIMESTAMPTZ,
  days_since_last_call INTEGER,
  tool_count BIGINT
) AS $$
DECLARE
  connection_record RECORD;
  tool_count_val BIGINT;
BEGIN
  -- Get connection details
  SELECT * INTO connection_record
  FROM agent_mcp_connections
  WHERE id = p_connection_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Connection not found'::TEXT, NULL::TIMESTAMPTZ, NULL::INTEGER, 0::BIGINT;
    RETURN;
  END IF;

  -- Get tool count
  SELECT COUNT(*) INTO tool_count_val
  FROM mcp_tools_cache
  WHERE connection_id = p_connection_id;

  -- Determine health status
  IF NOT connection_record.is_active THEN
    RETURN QUERY SELECT false, 'Connection disabled'::TEXT, connection_record.last_successful_call, 
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  ELSIF connection_record.last_successful_call IS NULL THEN
    RETURN QUERY SELECT false, 'Never connected'::TEXT, NULL::TIMESTAMPTZ, NULL::INTEGER, tool_count_val;
  ELSIF connection_record.last_successful_call < (NOW() - INTERVAL '7 days') THEN
    RETURN QUERY SELECT false, 'Stale (>7 days)'::TEXT, connection_record.last_successful_call,
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  ELSIF tool_count_val = 0 THEN
    RETURN QUERY SELECT false, 'No tools available'::TEXT, connection_record.last_successful_call,
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  ELSE
    RETURN QUERY SELECT true, 'Healthy'::TEXT, connection_record.last_successful_call,
      EXTRACT(day FROM (NOW() - connection_record.last_successful_call))::INTEGER, tool_count_val;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Create function to update server capabilities
CREATE OR REPLACE FUNCTION public.update_mcp_server_capabilities(
  p_connection_id UUID,
  p_capabilities JSONB,
  p_server_info JSONB,
  p_protocol_version TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Only service role can update server capabilities
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to update server capabilities';
  END IF;

  UPDATE agent_mcp_connections
  SET 
    server_capabilities = p_capabilities,
    server_info = p_server_info,
    protocol_version = p_protocol_version,
    updated_at = NOW()
  WHERE id = p_connection_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Create function to record successful tool execution
CREATE OR REPLACE FUNCTION public.record_mcp_tool_success(p_connection_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only service role can record tool execution
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges to record tool execution';
  END IF;

  UPDATE agent_mcp_connections
  SET last_successful_call = NOW()
  WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 14: Migrate existing Zapier connections to have proper metadata
-- This is safe to run multiple times (idempotent)
UPDATE agent_mcp_connections
SET 
  server_capabilities = jsonb_build_object(
    'tools', jsonb_build_object('listChanged', false),
    'experimental', jsonb_build_object('zapier-ai-actions', true)
  ),
  server_info = jsonb_build_object(
    'name', 'Zapier MCP Server',
    'vendor', 'Zapier',
    'inferred', true
  )
WHERE connection_type = 'zapier' 
  AND (server_capabilities IS NULL OR server_capabilities = '{}');

-- Step 15: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_mcp_server_type_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_mcp_server_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_mcp_server_capabilities(UUID, JSONB, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_mcp_tool_success(UUID) TO service_role;

-- Step 16: Create view for safe server type statistics (public)
CREATE OR REPLACE VIEW public.mcp_server_type_summary AS
SELECT 
  connection_type as server_type,
  COUNT(*) as total_connections,
  COUNT(*) FILTER (WHERE is_active = true) as active_connections,
  MIN(created_at) as first_connection_date,
  MAX(updated_at) as last_updated
FROM agent_mcp_connections
GROUP BY connection_type
ORDER BY active_connections DESC;

GRANT SELECT ON public.mcp_server_type_summary TO authenticated;

COMMENT ON VIEW public.mcp_server_type_summary IS 
  'Public view showing MCP server type distribution and statistics without exposing sensitive connection details';

-- Step 17: Add audit trail comment
COMMENT ON TABLE agent_mcp_connections IS 
  'Universal MCP server connections. Supports ANY MCP-compliant server including Zapier, Retell AI, Anthropic, OpenAI, custom implementations, etc. Connection type is informational only and not restricted.';

-- Migration complete
-- Existing Zapier connections will continue to work without any changes
-- New connections can be any MCP-compliant server type

