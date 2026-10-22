-- Create tool execution logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS tool_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_provider TEXT NOT NULL,
  parameters JSONB,
  result_data JSONB,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  execution_time_ms INTEGER,
  quota_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_agent_id ON tool_execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_user_id ON tool_execution_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_created_at ON tool_execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_execution_logs_tool_provider ON tool_execution_logs(tool_provider);

-- Enable RLS
ALTER TABLE tool_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own tool execution logs" ON tool_execution_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all tool execution logs" ON tool_execution_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_tool_execution_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tool_execution_logs_updated_at
  BEFORE UPDATE ON tool_execution_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_tool_execution_logs_updated_at();

-- Grant permissions
GRANT SELECT ON tool_execution_logs TO anon, authenticated;
GRANT INSERT ON tool_execution_logs TO authenticated;
GRANT UPDATE ON tool_execution_logs TO authenticated;

-- Add comment
COMMENT ON TABLE tool_execution_logs IS 'Logs all tool executions by agents for audit and debugging purposes'; 