-- Migration: Add successful parameters tracking to MCP tools cache
-- This enables learning from successful tool executions and providing 
-- working parameter examples to the LLM during retries
-- File: 20251011000001_add_mcp_successful_parameters.sql

-- Add successful_parameters column to track working parameter combinations
ALTER TABLE mcp_tools_cache
ADD COLUMN IF NOT EXISTS successful_parameters JSONB DEFAULT '[]'::jsonb;

-- Add last_successful_call timestamp
ALTER TABLE mcp_tools_cache
ADD COLUMN IF NOT EXISTS last_successful_call TIMESTAMPTZ;

-- Add success_count for analytics
ALTER TABLE mcp_tools_cache
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;

-- Add index for successful parameter queries
CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_last_successful_call 
ON mcp_tools_cache(last_successful_call DESC) 
WHERE last_successful_call IS NOT NULL;

-- Function to record successful tool execution with parameters
CREATE OR REPLACE FUNCTION record_mcp_tool_execution(
  p_connection_id UUID,
  p_tool_name TEXT,
  p_parameters JSONB,
  p_success BOOLEAN DEFAULT true
)
RETURNS VOID AS $$
DECLARE
  v_existing_params JSONB;
  v_params_array JSONB;
  v_param_exists BOOLEAN;
BEGIN
  IF p_success THEN
    -- Get current successful parameters array
    SELECT successful_parameters INTO v_existing_params
    FROM mcp_tools_cache
    WHERE connection_id = p_connection_id 
      AND tool_name = p_tool_name;
    
    -- Initialize as empty array if NULL
    IF v_existing_params IS NULL THEN
      v_existing_params := '[]'::jsonb;
    END IF;
    
    -- Check if these exact parameters already exist
    SELECT EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(v_existing_params) AS elem
      WHERE elem = p_parameters
    ) INTO v_param_exists;
    
    -- Only add if parameters don't already exist (avoid duplicates)
    IF NOT v_param_exists THEN
      -- Append new successful parameters (keep last 10 unique combinations)
      v_params_array := v_existing_params || jsonb_build_array(p_parameters);
      
      -- Keep only the most recent 10 successful parameter combinations
      IF jsonb_array_length(v_params_array) > 10 THEN
        v_params_array := (
          SELECT jsonb_agg(elem)
          FROM (
            SELECT elem
            FROM jsonb_array_elements(v_params_array) AS elem
            ORDER BY ordinality DESC
            LIMIT 10
          ) AS limited
        );
      END IF;
    ELSE
      v_params_array := v_existing_params;
    END IF;
    
    -- Update the cache with successful parameters
    UPDATE mcp_tools_cache
    SET 
      successful_parameters = v_params_array,
      last_successful_call = NOW(),
      success_count = success_count + 1,
      last_updated = NOW()
    WHERE connection_id = p_connection_id 
      AND tool_name = p_tool_name;
      
    -- Also update the connection's last successful call
    UPDATE agent_mcp_connections
    SET last_successful_call = NOW()
    WHERE id = p_connection_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get successful parameters for a tool (for LLM context)
CREATE OR REPLACE FUNCTION get_mcp_tool_successful_params(
  p_connection_id UUID,
  p_tool_name TEXT
)
RETURNS TABLE (
  parameters JSONB,
  last_success TIMESTAMPTZ,
  success_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    successful_parameters,
    last_successful_call,
    mcp_tools_cache.success_count
  FROM mcp_tools_cache
  WHERE connection_id = p_connection_id 
    AND tool_name = p_tool_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing function to allow signature change
DROP FUNCTION IF EXISTS get_agent_mcp_tools(UUID);

-- Update get_agent_mcp_tools to include successful parameters for LLM guidance
CREATE OR REPLACE FUNCTION get_agent_mcp_tools(p_agent_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    tool_name TEXT,
    openai_schema JSONB,
    successful_parameters JSONB,
    last_successful_call TIMESTAMPTZ,
    success_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        amc.id as connection_id,
        amc.connection_name,
        mtc.tool_name,
        mtc.openai_schema,
        mtc.successful_parameters,
        mtc.last_successful_call,
        mtc.success_count
    FROM agent_mcp_connections amc
    JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
    WHERE amc.agent_id = p_agent_id 
    AND amc.is_active = true
    ORDER BY amc.connection_name, mtc.tool_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION record_mcp_tool_execution(UUID, TEXT, JSONB, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_mcp_tool_successful_params(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_agent_mcp_tools(UUID) TO authenticated, service_role;

-- Add helpful comments
COMMENT ON COLUMN mcp_tools_cache.successful_parameters IS 'Array of successful parameter combinations (max 10 most recent)';
COMMENT ON COLUMN mcp_tools_cache.last_successful_call IS 'Timestamp of last successful tool execution';
COMMENT ON COLUMN mcp_tools_cache.success_count IS 'Total number of successful executions';
COMMENT ON FUNCTION record_mcp_tool_execution IS 'Records successful tool execution parameters for learning';
COMMENT ON FUNCTION get_mcp_tool_successful_params IS 'Retrieves successful parameter examples for LLM context';
COMMENT ON FUNCTION get_agent_mcp_tools IS 'Returns MCP tools with successful parameter examples for LLM guidance';

