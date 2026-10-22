-- Create reasoning_sessions table for MCP advanced reasoning system
-- This table tracks iterative reasoning sessions with confidence progression

-- Skip this migration if required tables don't exist (for shadow database compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
        RAISE NOTICE 'Skipping reasoning_sessions creation - agents table does not exist yet';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating reasoning_sessions table - agents table exists';
    
    EXECUTE $MIGRATION$
    CREATE TABLE IF NOT EXISTS reasoning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  
  -- Query and reasoning metadata
  query TEXT NOT NULL,
  reasoning_type TEXT NOT NULL CHECK (reasoning_type IN ('inductive', 'deductive', 'abductive', 'analogical', 'causal', 'probabilistic')),
  
  -- Iteration tracking
  iterations INTEGER NOT NULL DEFAULT 0,
  max_iterations INTEGER NOT NULL DEFAULT 6,
  
  -- Confidence progression
  initial_confidence DECIMAL(3,2) DEFAULT 0.50,
  final_confidence DECIMAL(3,2),
  confidence_threshold DECIMAL(3,2) DEFAULT 0.85,
  
  -- Results
  conclusion TEXT,
  insights JSONB DEFAULT '[]'::jsonb,
  memory_connections JSONB DEFAULT '{}'::jsonb,
  
  -- Session control
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  forced_stop BOOLEAN DEFAULT FALSE,
  stop_reason TEXT CHECK (stop_reason IN ('confidence_reached', 'max_iterations', 'forced_stop', 'error', 'timeout')),
  
  -- Performance tracking
  total_tokens_used INTEGER DEFAULT 0,
  total_processing_time_ms INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_agent_id ON reasoning_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_user_id ON reasoning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_conversation_id ON reasoning_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_created_at ON reasoning_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_reasoning_type ON reasoning_sessions(reasoning_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_reasoning_sessions_updated_at()
RETURNS TRIGGER AS $FUNC$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$FUNC$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reasoning_sessions_updated_at
  BEFORE UPDATE ON reasoning_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_reasoning_sessions_updated_at();

-- Add RLS policies
ALTER TABLE reasoning_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own reasoning sessions
CREATE POLICY "Users can view own reasoning sessions" ON reasoning_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reasoning sessions" ON reasoning_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reasoning sessions" ON reasoning_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can access all (for system operations)
CREATE POLICY "Service role full access to reasoning sessions" ON reasoning_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE reasoning_sessions IS 'Tracks iterative reasoning sessions with confidence progression and memory integration';
COMMENT ON COLUMN reasoning_sessions.reasoning_type IS 'Type of reasoning: inductive, deductive, abductive, analogical, causal, probabilistic';
COMMENT ON COLUMN reasoning_sessions.iterations IS 'Number of reasoning iterations completed';
COMMENT ON COLUMN reasoning_sessions.final_confidence IS 'Final confidence level achieved (0.00-1.00)';
COMMENT ON COLUMN reasoning_sessions.insights IS ''Array of insights generated during reasoning'';
COMMENT ON COLUMN reasoning_sessions.memory_connections IS ''JSON object tracking episodic and semantic memory usage'';
COMMENT ON COLUMN reasoning_sessions.forced_stop IS ''Whether reasoning was manually stopped via safety switch'';
    $MIGRATION$;
END $$;
