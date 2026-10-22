-- Migration: Create Advanced JSON Chat System Schema
-- Description: Implements comprehensive schema for memory management, state persistence, and structured messages
-- Author: Agentopia Development Team
-- Date: 2025-08-05

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- CORE MESSAGE TABLES
-- =====================================================

-- Create chat_messages_v2 table
CREATE TABLE IF NOT EXISTS chat_messages_v2 (
  -- Identification
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(10) NOT NULL DEFAULT '1.0.0',
  conversation_id UUID NOT NULL,
  session_id UUID NOT NULL,
  
  -- Relationships
  parent_message_id UUID REFERENCES chat_messages_v2(id),
  channel_id UUID REFERENCES chat_channels(id),
  
  -- Actors
  sender_user_id UUID REFERENCES auth.users(id),
  sender_agent_id UUID REFERENCES agents(id),
  
  -- Content
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content JSONB NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Context
  context JSONB DEFAULT '{}',
  
  -- Optional Components
  tools JSONB,
  memory_refs UUID[],
  state_snapshot_id UUID,
  
  -- Audit
  audit JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT check_actor_exclusivity CHECK (
    (sender_user_id IS NOT NULL AND sender_agent_id IS NULL) OR
    (sender_user_id IS NULL AND sender_agent_id IS NOT NULL) OR
    (role = 'system' AND sender_user_id IS NULL AND sender_agent_id IS NULL)
  ),
  CONSTRAINT check_content_structure CHECK (
    content ? 'type' AND 
    content->>'type' IN ('text', 'structured', 'multimodal', 'tool_result')
  )
);

-- Create indexes for chat_messages_v2
CREATE INDEX idx_messages_conversation ON chat_messages_v2(conversation_id, created_at);
CREATE INDEX idx_messages_session ON chat_messages_v2(session_id);
CREATE INDEX idx_messages_channel ON chat_messages_v2(channel_id) WHERE channel_id IS NOT NULL;
CREATE INDEX idx_messages_sender_user ON chat_messages_v2(sender_user_id) WHERE sender_user_id IS NOT NULL;
CREATE INDEX idx_messages_sender_agent ON chat_messages_v2(sender_agent_id) WHERE sender_agent_id IS NOT NULL;
CREATE INDEX idx_messages_content_gin ON chat_messages_v2 USING gin(content);
CREATE INDEX idx_messages_metadata_gin ON chat_messages_v2 USING gin(metadata);

-- Create message_versions table
CREATE TABLE IF NOT EXISTS message_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES chat_messages_v2(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(message_id, version_number)
);

-- Create index for message versions
CREATE INDEX idx_message_versions_message ON message_versions(message_id, version_number DESC);

-- =====================================================
-- MEMORY STORAGE TABLES
-- =====================================================

-- Create agent_memories table
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type VARCHAR(20) NOT NULL CHECK (memory_type IN ('episodic', 'semantic', 'procedural', 'working')),
  
  -- Content (type-specific)
  content JSONB NOT NULL,
  
  -- Vector embedding
  embeddings vector(1536),
  
  -- Metrics
  importance_score FLOAT DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  decay_rate FLOAT DEFAULT 0.1,
  access_count INTEGER DEFAULT 0,
  
  -- Relationships
  related_memories UUID[],
  source_message_id UUID REFERENCES chat_messages_v2(id),
  
  -- Timestamps
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints for memory type validation
  CONSTRAINT check_memory_content CHECK (
    CASE memory_type
      WHEN 'episodic' THEN content ? 'event' AND content ? 'temporal'
      WHEN 'semantic' THEN content ? 'concept' AND content ? 'definition'
      WHEN 'procedural' THEN content ? 'skill' AND content ? 'steps'
      WHEN 'working' THEN content ? 'items' AND content ? 'capacity'
      ELSE false
    END
  )
);

-- Create indexes for agent_memories
CREATE INDEX idx_memories_agent_type ON agent_memories(agent_id, memory_type);
CREATE INDEX idx_memories_importance ON agent_memories(importance DESC);
CREATE INDEX idx_memories_embedding ON agent_memories USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX idx_memories_content_gin ON agent_memories USING gin(content);
CREATE INDEX idx_memories_expires ON agent_memories(expires_at) WHERE expires_at IS NOT NULL;

-- Create memory_consolidations table
CREATE TABLE IF NOT EXISTS memory_consolidations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source_memories UUID[] NOT NULL,
  consolidated_memory_id UUID REFERENCES agent_memories(id),
  consolidation_type VARCHAR(20) CHECK (consolidation_type IN ('merge', 'summarize', 'abstract')),
  tokens_saved INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for memory consolidations
CREATE INDEX idx_consolidations_agent ON memory_consolidations(agent_id, created_at DESC);

-- =====================================================
-- STATE MANAGEMENT TABLES
-- =====================================================

-- Create agent_states table
CREATE TABLE IF NOT EXISTS agent_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version VARCHAR(10) NOT NULL,
  
  -- State partitions
  local_state JSONB NOT NULL DEFAULT '{}',
  shared_state JSONB DEFAULT '{}',
  session_state JSONB DEFAULT '{}',
  persistent_state JSONB NOT NULL DEFAULT '{}',
  
  -- Metadata
  state_hash VARCHAR(64) NOT NULL,
  modification_count INTEGER DEFAULT 0,
  
  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint for current state per agent
CREATE UNIQUE INDEX idx_unique_current_state ON agent_states(agent_id) WHERE is_current = true;

-- Create indexes for agent_states
CREATE INDEX idx_states_agent_current ON agent_states(agent_id) WHERE is_current = true;
CREATE INDEX idx_states_valid_range ON agent_states(valid_from, valid_until);
CREATE INDEX idx_states_agent_history ON agent_states(agent_id, valid_from DESC);

-- Create state_checkpoints table
CREATE TABLE IF NOT EXISTS state_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  state_id UUID NOT NULL REFERENCES agent_states(id),
  
  -- Checkpoint details
  checkpoint_type VARCHAR(20) CHECK (checkpoint_type IN ('manual', 'automatic', 'error_recovery', 'milestone')),
  trigger_reason TEXT,
  
  -- Storage
  state_data JSONB NOT NULL,
  compression_type VARCHAR(10),
  size_bytes INTEGER,
  
  -- Recovery metrics
  restoration_time_ms INTEGER,
  restoration_count INTEGER DEFAULT 0,
  
  -- Retention
  retention_policy VARCHAR(20) CHECK (retention_policy IN ('temporary', 'permanent', 'archive')),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for state_checkpoints
CREATE INDEX idx_checkpoints_agent ON state_checkpoints(agent_id, created_at DESC);
CREATE INDEX idx_checkpoints_retention ON state_checkpoints(retention_policy, expires_at);

-- Create state_transitions table
CREATE TABLE IF NOT EXISTS state_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  from_state_id UUID REFERENCES agent_states(id),
  to_state_id UUID NOT NULL REFERENCES agent_states(id),
  
  -- Transition details
  transition_type VARCHAR(20) CHECK (transition_type IN ('update', 'merge', 'reset', 'restore')),
  trigger VARCHAR(50),
  
  -- Changes
  changes JSONB NOT NULL,
  
  -- Rollback
  rollback_available BOOLEAN DEFAULT true,
  rollback_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for state_transitions
CREATE INDEX idx_transitions_agent ON state_transitions(agent_id, created_at DESC);
CREATE INDEX idx_transitions_states ON state_transitions(from_state_id, to_state_id);

-- =====================================================
-- CONTEXT MANAGEMENT TABLES
-- =====================================================

-- Create context_snapshots table
CREATE TABLE IF NOT EXISTS context_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES chat_messages_v2(id),
  agent_id UUID REFERENCES agents(id),
  
  -- Snapshot data
  snapshot_data JSONB NOT NULL,
  
  -- Metrics
  total_tokens INTEGER,
  compression_ratio FLOAT,
  segment_count INTEGER,
  
  -- Performance
  build_time_ms INTEGER,
  optimization_count INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for context_snapshots
CREATE INDEX idx_context_snapshots_message ON context_snapshots(message_id);
CREATE INDEX idx_context_snapshots_agent ON context_snapshots(agent_id, created_at DESC);

-- Create context_templates table
CREATE TABLE IF NOT EXISTS context_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  
  -- Template definition
  segments JSONB NOT NULL,
  variables JSONB,
  
  -- Metrics
  total_tokens INTEGER,
  use_count INTEGER DEFAULT 0,
  
  -- Applicability
  use_cases TEXT[],
  agent_types TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for context_templates
CREATE INDEX idx_context_templates_name ON context_templates(name);

-- =====================================================
-- SUPPORTING TABLES
-- =====================================================

-- Create conversation_sessions table
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  agent_id UUID REFERENCES agents(id),
  
  -- Session data
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metrics
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  tool_calls_count INTEGER DEFAULT 0,
  
  -- State
  session_state JSONB DEFAULT '{}',
  interruption_context JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  
  -- Constraints
  CONSTRAINT check_session_actors CHECK (
    user_id IS NOT NULL OR agent_id IS NOT NULL
  )
);

-- Create indexes for conversation_sessions
CREATE INDEX idx_sessions_conversation ON conversation_sessions(conversation_id);
CREATE INDEX idx_sessions_user ON conversation_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sessions_agent ON conversation_sessions(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_sessions_status ON conversation_sessions(status) WHERE status IN ('active', 'paused');

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_messages_v2_updated_at BEFORE UPDATE ON chat_messages_v2
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_agent_states_updated_at BEFORE UPDATE ON agent_states
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_context_templates_updated_at BEFORE UPDATE ON context_templates
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger to update last_active timestamp for sessions
CREATE OR REPLACE FUNCTION update_session_last_active()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversation_sessions 
    SET last_active = NOW(),
        message_count = message_count + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_session_activity AFTER INSERT ON chat_messages_v2
    FOR EACH ROW EXECUTE PROCEDURE update_session_last_active();

-- Trigger to update memory access count and timestamp
CREATE OR REPLACE FUNCTION update_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.access_count = OLD.access_count + 1;
    NEW.last_accessed = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_memory_access BEFORE UPDATE OF content, embeddings ON agent_memories
    FOR EACH ROW EXECUTE PROCEDURE update_memory_access();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE chat_messages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_consolidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies (basic examples - adjust based on your security requirements)

-- Chat messages policies
CREATE POLICY "Users can view their own messages" ON chat_messages_v2
    FOR SELECT USING (auth.uid() = sender_user_id);

CREATE POLICY "Agents can view messages in their conversations" ON chat_messages_v2
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = chat_messages_v2.sender_agent_id
            AND agents.user_id = auth.uid()
        )
    );

-- Agent memories policies
CREATE POLICY "Users can manage memories for their agents" ON agent_memories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_memories.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Agent states policies
CREATE POLICY "Users can manage states for their agents" ON agent_states
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM agents 
            WHERE agents.id = agent_states.agent_id 
            AND agents.user_id = auth.uid()
        )
    );

-- Session policies
CREATE POLICY "Users can view their own sessions" ON conversation_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- MIGRATION HELPERS
-- =====================================================

-- Function to migrate existing chat_messages to chat_messages_v2
CREATE OR REPLACE FUNCTION migrate_chat_messages()
RETURNS INTEGER AS $$
DECLARE
    migrated_count INTEGER := 0;
    v_conversation_id UUID;
    v_session_id UUID;
BEGIN
    -- Create a default conversation and session for migration
    v_conversation_id := uuid_generate_v4();
    v_session_id := uuid_generate_v4();
    
    -- Insert conversation session
    INSERT INTO conversation_sessions (id, conversation_id, started_at)
    VALUES (v_session_id, v_conversation_id, NOW());
    
    -- Migrate messages
    INSERT INTO chat_messages_v2 (
        conversation_id,
        session_id,
        channel_id,
        sender_user_id,
        sender_agent_id,
        role,
        content,
        created_at
    )
    SELECT 
        v_conversation_id,
        v_session_id,
        channel_id,
        sender_user_id,
        sender_agent_id,
        CASE 
            WHEN sender_user_id IS NOT NULL THEN 'user'
            WHEN sender_agent_id IS NOT NULL THEN 'assistant'
            ELSE 'system'
        END as role,
        jsonb_build_object(
            'type', 'text',
            'text', content
        ) as content,
        created_at
    FROM chat_messages
    WHERE NOT EXISTS (
        SELECT 1 FROM chat_messages_v2 
        WHERE chat_messages_v2.created_at = chat_messages.created_at
    );
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on function
COMMENT ON FUNCTION migrate_chat_messages() IS 'Migrates existing chat_messages to the new chat_messages_v2 structure';

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

-- Table comments
COMMENT ON TABLE chat_messages_v2 IS 'Advanced chat messages with structured content, metadata, and context support';
COMMENT ON TABLE agent_memories IS 'Multi-type memory storage for agents with vector embeddings';
COMMENT ON TABLE agent_states IS 'Versioned state management for agents with partitioned state types';
COMMENT ON TABLE conversation_sessions IS 'Session tracking for conversations with metrics and state';

-- Column comments
COMMENT ON COLUMN chat_messages_v2.content IS 'JSONB structure with type field: text, structured, multimodal, or tool_result';
COMMENT ON COLUMN agent_memories.embeddings IS 'Vector embedding for semantic similarity search (1536 dimensions for OpenAI)';
COMMENT ON COLUMN agent_states.state_hash IS 'SHA-256 hash of the complete state for integrity checking';
COMMENT ON COLUMN context_snapshots.compression_ratio IS 'Ratio of compressed to original token count';

-- =====================================================
-- INITIAL DATA AND DEFAULTS
-- =====================================================

-- Insert default context templates
INSERT INTO context_templates (name, description, segments, total_tokens, use_cases, agent_types)
VALUES 
    ('minimal_assistant', 
     'Minimal context for simple Q&A assistants', 
     '{"system": {"priority": 1, "content": "core_instructions"}, "history": {"priority": 2, "limit": 5}}',
     500,
     ARRAY['question_answering', 'simple_chat'],
     ARRAY['assistant', 'support']),
     
    ('research_agent',
     'Extended context for research and analysis agents',
     '{"system": {"priority": 1, "content": "core_instructions"}, "memory": {"priority": 2, "types": ["semantic", "episodic"]}, "history": {"priority": 3, "limit": 20}}',
     2000,
     ARRAY['research', 'analysis', 'long_form_generation'],
     ARRAY['researcher', 'analyst']),
     
    ('creative_agent',
     'Context optimized for creative tasks',
     '{"system": {"priority": 1, "content": "creative_instructions"}, "memory": {"priority": 2, "types": ["procedural", "semantic"]}, "history": {"priority": 3, "limit": 10}}',
     1500,
     ARRAY['creative_writing', 'content_generation'],
     ARRAY['writer', 'creator'])
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON chat_messages_v2 TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON agent_states TO authenticated;
GRANT SELECT, INSERT ON conversation_sessions TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================