-- Add reasoning configuration to agents table
-- This allows per-agent reasoning settings and preferences

-- Skip this migration if agents table doesn't exist (for shadow database compatibility)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
    RAISE NOTICE 'Skipping reasoning_config addition - agents table does not exist yet';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Adding reasoning_config to agents table - agents table exists';

  -- Add reasoning_config column to agents table if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'reasoning_config'
  ) THEN
    EXECUTE 'ALTER TABLE agents ADD COLUMN reasoning_config JSONB DEFAULT ''{
      "enabled": true,
      "threshold": 0.3,
      "max_iterations": 6,
      "confidence_threshold": 0.85,
      "preferred_styles": ["inductive", "deductive", "abductive"],
      "timeout_ms": 30000,
      "safety_switch_enabled": true
    }''::jsonb';
  END IF;
  
  -- Create index for reasoning config queries
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_agents_reasoning_config ON agents USING GIN (reasoning_config)';

  -- Add comment
  EXECUTE 'COMMENT ON COLUMN agents.reasoning_config IS ''JSON configuration for agent reasoning behavior including thresholds, styles, and safety settings''';

  -- Update existing agents to have default reasoning config if they don't have one
  EXECUTE 'UPDATE agents 
  SET reasoning_config = ''{
    "enabled": true,
    "threshold": 0.3,
    "max_iterations": 6,
    "confidence_threshold": 0.85,
    "preferred_styles": ["inductive", "deductive", "abductive"],
    "timeout_ms": 30000,
    "safety_switch_enabled": true
  }''::jsonb
  WHERE reasoning_config IS NULL OR reasoning_config = ''{}''::jsonb';
END $$;
