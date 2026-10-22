-- ============================================================================
-- Migration: Create Conversation Summary System
-- Date: 2025-10-06
-- Purpose: Implement intelligent conversation summarization with pg_vector
--          for working memory and semantic search capabilities
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLE: conversation_summaries
-- Purpose: Searchable conversation archives with vector embeddings
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_summaries (
  -- Primary key and relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Summary content
  summary_text TEXT NOT NULL,
  key_facts JSONB DEFAULT '[]'::JSONB,  -- Array of important facts
  entities JSONB DEFAULT '{}'::JSONB,    -- Extracted entities (people, places, things)
  topics TEXT[] DEFAULT ARRAY[]::TEXT[], -- Conversation topics
  
  -- Metadata
  message_count INTEGER DEFAULT 0,
  conversation_start TIMESTAMPTZ,
  conversation_end TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Vector embedding for similarity search (OpenAI text-embedding-3-small dimension)
  embedding VECTOR(1536),
  
  -- Lifecycle tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conversation 
  ON conversation_summaries(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_agent 
  ON conversation_summaries(agent_id);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user 
  ON conversation_summaries(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_updated 
  ON conversation_summaries(last_updated DESC);

-- Vector similarity search index using HNSW (Hierarchical Navigable Small World)
-- This enables fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_embedding 
  ON conversation_summaries 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Enable Row Level Security
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own conversation summaries
CREATE POLICY "Users can view their own conversation summaries"
  ON conversation_summaries FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage conversation summaries
CREATE POLICY "Service role can manage conversation summaries"
  ON conversation_summaries FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- TABLE: working_memory_chunks
-- Purpose: Short-lived chunks of conversation for real-time context
-- ============================================================================

CREATE TABLE IF NOT EXISTS working_memory_chunks (
  -- Primary key and relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Chunk content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,  -- Order within conversation
  message_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Source messages
  
  -- Metadata
  importance_score FLOAT DEFAULT 0.5,  -- 0-1 relevance score
  chunk_type TEXT DEFAULT 'dialogue',  -- dialogue, action, fact, question, answer
  
  -- Vector embedding for similarity search
  embedding VECTOR(1536),
  
  -- Lifecycle (auto-cleanup after 7 days)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_working_memory_conversation 
  ON working_memory_chunks(conversation_id);

CREATE INDEX IF NOT EXISTS idx_working_memory_agent 
  ON working_memory_chunks(agent_id);

CREATE INDEX IF NOT EXISTS idx_working_memory_expires 
  ON working_memory_chunks(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_working_memory_embedding 
  ON working_memory_chunks 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Enable Row Level Security
ALTER TABLE working_memory_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own working memory
CREATE POLICY "Users can view their own working memory"
  ON working_memory_chunks FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage working memory
CREATE POLICY "Service role can manage working memory"
  ON working_memory_chunks FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- TABLE: conversation_summary_boards
-- Purpose: The "whiteboard" that the background agent maintains for each conversation
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_summary_boards (
  -- Primary key and relationships
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The "board" content
  current_summary TEXT NOT NULL DEFAULT '',
  context_notes TEXT DEFAULT '',
  important_facts JSONB DEFAULT '[]'::JSONB,
  pending_questions JSONB DEFAULT '[]'::JSONB,
  action_items JSONB DEFAULT '[]'::JSONB,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  update_frequency INTEGER DEFAULT 5,  -- Update every N messages
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_summary_boards_conversation 
  ON conversation_summary_boards(conversation_id);

CREATE INDEX IF NOT EXISTS idx_summary_boards_agent 
  ON conversation_summary_boards(agent_id);

CREATE INDEX IF NOT EXISTS idx_summary_boards_user 
  ON conversation_summary_boards(user_id);

-- Enable Row Level Security
ALTER TABLE conversation_summary_boards ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own summary boards
CREATE POLICY "Users can view their own summary boards"
  ON conversation_summary_boards FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage summary boards
CREATE POLICY "Service role can manage summary boards"
  ON conversation_summary_boards FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- FUNCTION: Cleanup expired working memory chunks
-- Purpose: Automatically remove expired working memory chunks
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_working_memory()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM working_memory_chunks
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % expired working memory chunks', deleted_count;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- FUNCTION: Update summary board timestamp
-- Purpose: Automatically update the updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_summary_board_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for summary board updates
DROP TRIGGER IF EXISTS trigger_update_summary_board_timestamp ON conversation_summary_boards;
CREATE TRIGGER trigger_update_summary_board_timestamp
  BEFORE UPDATE ON conversation_summary_boards
  FOR EACH ROW
  EXECUTE FUNCTION update_summary_board_timestamp();

-- ============================================================================
-- FUNCTION: Update conversation summary timestamp
-- Purpose: Automatically update the updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_summary_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for conversation summary updates
DROP TRIGGER IF EXISTS trigger_update_conversation_summary_timestamp ON conversation_summaries;
CREATE TRIGGER trigger_update_conversation_summary_timestamp
  BEFORE UPDATE ON conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_summary_timestamp();

-- ============================================================================
-- COMMENTS: Documentation for tables and important columns
-- ============================================================================

COMMENT ON TABLE conversation_summaries IS 
  'Stores searchable conversation summaries with vector embeddings for semantic search. Used for medium-term memory retrieval.';

COMMENT ON COLUMN conversation_summaries.embedding IS 
  'Vector embedding (1536 dimensions) for semantic similarity search using OpenAI text-embedding-3-small model';

COMMENT ON TABLE working_memory_chunks IS 
  'Short-lived conversation chunks with vector embeddings for real-time context retrieval. Auto-expires after 7 days.';

COMMENT ON TABLE conversation_summary_boards IS 
  'The "whiteboard" maintained by the background summarization agent. Contains rolling summary and extracted information.';

COMMENT ON FUNCTION cleanup_expired_working_memory() IS 
  'Removes expired working memory chunks. Should be called periodically via pg_cron or Edge Function.';

-- ============================================================================
-- GRANTS: Ensure proper permissions
-- ============================================================================

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant table permissions
GRANT SELECT ON conversation_summaries TO authenticated;
GRANT SELECT ON working_memory_chunks TO authenticated;
GRANT SELECT ON conversation_summary_boards TO authenticated;

GRANT ALL ON conversation_summaries TO service_role;
GRANT ALL ON working_memory_chunks TO service_role;
GRANT ALL ON conversation_summary_boards TO service_role;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_working_memory() TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Conversation Summary System migration completed successfully';
  RAISE NOTICE '📊 Created tables: conversation_summaries, working_memory_chunks, conversation_summary_boards';
  RAISE NOTICE '🔍 Enabled pg_vector extension with HNSW indexes';
  RAISE NOTICE '🔒 Configured Row Level Security policies';
  RAISE NOTICE '⚡ Ready for Phase 1.2: Background Summarization Service';
END $$;

