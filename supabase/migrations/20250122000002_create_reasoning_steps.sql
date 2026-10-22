-- Create reasoning_steps table to track individual steps within reasoning sessions
-- This provides detailed audit trail and enables step-by-step analysis

-- Skip this migration if reasoning_sessions table doesn't exist (for shadow database compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reasoning_sessions') THEN
        RAISE NOTICE 'Skipping reasoning_steps creation - reasoning_sessions table does not exist yet';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating reasoning_steps table - reasoning_sessions table exists';
    
    EXECUTE $MIGRATION$
    CREATE TABLE IF NOT EXISTS reasoning_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES reasoning_sessions(id) ON DELETE CASCADE,
  
  -- Step metadata
  step_number INTEGER NOT NULL,
  reasoning_state TEXT NOT NULL CHECK (reasoning_state IN ('analyze', 'hypothesize', 'test', 'observe', 'update', 'conclude')),
  
  -- Step content
  question TEXT NOT NULL,
  hypothesis TEXT,
  action JSONB,
  observation JSONB,
  conclusion TEXT,
  
  -- Confidence and timing
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  processing_time_ms INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  
  -- Memory integration
  memories_used JSONB DEFAULT '{}'::jsonb,
  memory_insights TEXT[],
  episodic_count INTEGER DEFAULT 0,
  semantic_count INTEGER DEFAULT 0,
  
  -- Context
  facts_considered TEXT[],
  tools_available TEXT[],
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_session_id ON reasoning_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_step_number ON reasoning_steps(session_id, step_number);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_reasoning_state ON reasoning_steps(reasoning_state);
CREATE INDEX IF NOT EXISTS idx_reasoning_steps_created_at ON reasoning_steps(created_at);

-- Add RLS policies
ALTER TABLE reasoning_steps ENABLE ROW LEVEL SECURITY;

-- Users can only access steps from their own reasoning sessions
CREATE POLICY "Users can view own reasoning steps" ON reasoning_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reasoning_sessions rs 
      WHERE rs.id = reasoning_steps.session_id 
      AND rs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reasoning steps for own sessions" ON reasoning_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reasoning_sessions rs 
      WHERE rs.id = reasoning_steps.session_id 
      AND rs.user_id = auth.uid()
    )
  );

-- Service role can access all
CREATE POLICY "Service role full access to reasoning steps" ON reasoning_steps
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comments
COMMENT ON TABLE reasoning_steps IS 'Individual steps within reasoning sessions, providing detailed audit trail';
COMMENT ON COLUMN reasoning_steps.reasoning_state IS ''Current state in Markov chain: analyze, hypothesize, test, observe, update, conclude'';
COMMENT ON COLUMN reasoning_steps.memories_used IS ''JSON object containing episodic and semantic memories used in this step'';
COMMENT ON COLUMN reasoning_steps.memory_insights IS ''Array of insights extracted from memories for this step'';
COMMENT ON COLUMN reasoning_steps.facts_considered IS ''Array of facts/context considered in this reasoning step'';
    $MIGRATION$;
END $$;
