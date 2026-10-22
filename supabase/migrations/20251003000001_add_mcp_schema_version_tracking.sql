-- Migration: Add schema version tracking to MCP tools cache
-- This enables detection of stale schemas and automatic refresh triggers
-- File: 20251003000001_add_mcp_schema_version_tracking.sql

-- Add version tracking columns
ALTER TABLE mcp_tools_cache
ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS schema_hash TEXT,
ADD COLUMN IF NOT EXISTS refresh_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_schema_error TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT true;

-- Add index for TTL queries
CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_last_updated 
ON mcp_tools_cache(last_updated);

-- Add index for error tracking
CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_last_error 
ON mcp_tools_cache(last_schema_error) 
WHERE last_schema_error IS NOT NULL;

-- Function to check if schema is stale (older than 7 days)
CREATE OR REPLACE FUNCTION is_mcp_schema_stale(p_connection_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  oldest_update TIMESTAMPTZ;
  stale_threshold INTERVAL := INTERVAL '7 days';
BEGIN
  -- Get the oldest tool update time for this connection
  SELECT MIN(last_updated) INTO oldest_update
  FROM mcp_tools_cache
  WHERE connection_id = p_connection_id;
  
  -- If no tools found, consider it stale
  IF oldest_update IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if older than threshold
  RETURN (NOW() - oldest_update) > stale_threshold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark schema refresh needed
CREATE OR REPLACE FUNCTION mark_mcp_schema_refresh_needed(
  p_connection_id UUID,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Update all tools for this connection
  UPDATE mcp_tools_cache
  SET 
    last_schema_error = NOW(),
    auto_refresh_enabled = true
  WHERE connection_id = p_connection_id;
  
  -- Log the refresh request
  RAISE NOTICE 'Schema refresh marked for connection %: %', 
    p_connection_id, COALESCE(p_error_message, 'Manual refresh requested');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get connections needing schema refresh
CREATE OR REPLACE FUNCTION get_mcp_connections_needing_refresh()
RETURNS TABLE (
  connection_id UUID,
  connection_name TEXT,
  agent_id UUID,
  last_updated TIMESTAMPTZ,
  days_old INTEGER,
  tool_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    amc.id as connection_id,
    amc.connection_name,
    amc.agent_id,
    MIN(mtc.last_updated) as last_updated,
    EXTRACT(DAY FROM NOW() - MIN(mtc.last_updated))::INTEGER as days_old,
    COUNT(mtc.id) as tool_count
  FROM agent_mcp_connections amc
  LEFT JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
  WHERE amc.is_active = true
    AND (
      -- No tools cached yet
      mtc.id IS NULL
      OR
      -- Tools older than 7 days
      (NOW() - mtc.last_updated) > INTERVAL '7 days'
      OR
      -- Recent schema errors and auto-refresh enabled
      (mtc.last_schema_error IS NOT NULL 
       AND mtc.auto_refresh_enabled = true
       AND (NOW() - mtc.last_schema_error) < INTERVAL '1 hour')
    )
  GROUP BY amc.id, amc.connection_name, amc.agent_id
  ORDER BY days_old DESC NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the schema
COMMENT ON COLUMN mcp_tools_cache.schema_version IS 'Version of the tool schema from MCP server';
COMMENT ON COLUMN mcp_tools_cache.schema_hash IS 'Hash of the schema for change detection';
COMMENT ON COLUMN mcp_tools_cache.refresh_count IS 'Number of times schema has been refreshed';
COMMENT ON COLUMN mcp_tools_cache.last_schema_error IS 'Timestamp of last schema validation error';
COMMENT ON COLUMN mcp_tools_cache.auto_refresh_enabled IS 'Whether automatic refresh is enabled for this tool';

COMMENT ON FUNCTION is_mcp_schema_stale IS 'Check if MCP connection schemas are older than 7 days';
COMMENT ON FUNCTION mark_mcp_schema_refresh_needed IS 'Mark a connection as needing schema refresh';
COMMENT ON FUNCTION get_mcp_connections_needing_refresh IS 'Get list of connections with stale schemas';

