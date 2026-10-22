-- Create agent_generation_logs table for tracking AI-powered agent creation
CREATE TABLE IF NOT EXISTS agent_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Input from user
  user_description TEXT NOT NULL,
  
  -- Generation method
  generation_method VARCHAR(20) NOT NULL DEFAULT 'ai_full' 
    CHECK (generation_method IN ('ai_full', 'ai_assisted', 'manual')),
  
  -- AI Model details
  model_provider VARCHAR(50),
  model_name VARCHAR(100),
  prompt_tokens INTEGER CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER CHECK (completion_tokens >= 0),
  generation_time_ms INTEGER CHECK (generation_time_ms >= 0),
  
  -- Generated configuration
  generated_config JSONB NOT NULL,
  
  -- User actions
  was_accepted BOOLEAN DEFAULT false,
  was_modified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  agent_created_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_agent_generation_logs_user_id ON agent_generation_logs(user_id, created_at DESC);
CREATE INDEX idx_agent_generation_logs_created_at ON agent_generation_logs(created_at DESC);
CREATE INDEX idx_agent_generation_logs_method ON agent_generation_logs(generation_method);

-- Enable RLS
ALTER TABLE agent_generation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own generation logs
CREATE POLICY "Users can view their own generation logs"
  ON agent_generation_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own generation logs
CREATE POLICY "Users can insert their own generation logs"
  ON agent_generation_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all generation logs
CREATE POLICY "Admins can view all generation logs"
  ON agent_generation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE agent_generation_logs IS 'Tracks AI-powered agent generation for analytics and continuous improvement';


