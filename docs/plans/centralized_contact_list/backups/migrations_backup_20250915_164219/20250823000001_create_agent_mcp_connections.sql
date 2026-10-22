-- Create agent MCP connections table
CREATE TABLE IF NOT EXISTS agent_mcp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    connection_name TEXT NOT NULL,
    server_url TEXT NOT NULL,
    connection_type TEXT NOT NULL DEFAULT 'zapier',
    is_active BOOLEAN NOT NULL DEFAULT true,
    auth_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique connection names per agent
    UNIQUE(agent_id, connection_name),
    
    -- Validate connection type
    CONSTRAINT valid_connection_type CHECK (connection_type IN ('zapier', 'custom')),
    
    -- Validate server URL format
    CONSTRAINT valid_server_url CHECK (server_url ~ '^https?://.*')
);

-- Create MCP tools cache table
CREATE TABLE IF NOT EXISTS mcp_tools_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES agent_mcp_connections(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    tool_schema JSONB NOT NULL,
    openai_schema JSONB NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique tool names per connection
    UNIQUE(connection_id, tool_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_mcp_connections_agent_id ON agent_mcp_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_mcp_connections_active ON agent_mcp_connections(agent_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_connection_id ON mcp_tools_cache(connection_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tools_cache_tool_name ON mcp_tools_cache(connection_id, tool_name);

-- Enable RLS
ALTER TABLE agent_mcp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_tools_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_mcp_connections
CREATE POLICY "Users can view their own agent MCP connections" ON agent_mcp_connections
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert MCP connections for their own agents" ON agent_mcp_connections
    FOR INSERT WITH CHECK (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own agent MCP connections" ON agent_mcp_connections
    FOR UPDATE USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own agent MCP connections" ON agent_mcp_connections
    FOR DELETE USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for mcp_tools_cache
CREATE POLICY "Users can view MCP tools for their own agent connections" ON mcp_tools_cache
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM agent_mcp_connections 
            WHERE agent_id IN (
                SELECT id FROM agents WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System can manage MCP tools cache" ON mcp_tools_cache
    FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_mcp_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_agent_mcp_connections_updated_at
    BEFORE UPDATE ON agent_mcp_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_mcp_connections_updated_at();

-- Create function to get agent MCP tools
CREATE OR REPLACE FUNCTION get_agent_mcp_tools(p_agent_id UUID)
RETURNS TABLE (
    connection_id UUID,
    connection_name TEXT,
    tool_name TEXT,
    openai_schema JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        amc.id as connection_id,
        amc.connection_name,
        mtc.tool_name,
        mtc.openai_schema
    FROM agent_mcp_connections amc
    JOIN mcp_tools_cache mtc ON amc.id = mtc.connection_id
    WHERE amc.agent_id = p_agent_id 
    AND amc.is_active = true
    ORDER BY amc.connection_name, mtc.tool_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON agent_mcp_connections TO authenticated;
GRANT ALL ON mcp_tools_cache TO authenticated;
GRANT EXECUTE ON FUNCTION get_agent_mcp_tools(UUID) TO authenticated;
