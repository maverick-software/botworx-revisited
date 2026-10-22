-- ============================================================================
-- Migration: Create Working Memory RPC Functions
-- Date: 2025-10-06
-- Purpose: Add vector search RPC functions for working memory and summaries
-- ============================================================================

-- ============================================================================
-- FUNCTION: Search working memory chunks
-- Purpose: Vector similarity search for recent conversation chunks
-- ============================================================================

CREATE OR REPLACE FUNCTION search_working_memory(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  chunk_text TEXT,
  importance_score FLOAT,
  chunk_type TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wmc.chunk_text,
    wmc.importance_score,
    wmc.chunk_type,
    wmc.created_at,
    1 - (wmc.embedding <=> p_query_embedding) AS similarity
  FROM working_memory_chunks wmc
  WHERE wmc.agent_id = p_agent_id
    AND wmc.user_id = p_user_id
    AND wmc.expires_at > NOW()
  ORDER BY wmc.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: Search conversation summaries
-- Purpose: Vector similarity search for past conversation summaries
-- ============================================================================

CREATE OR REPLACE FUNCTION search_conversation_summaries(
  p_agent_id UUID,
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  summary_text TEXT,
  key_facts JSONB,
  topics TEXT[],
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.summary_text,
    cs.key_facts,
    cs.topics,
    cs.created_at,
    1 - (cs.embedding <=> p_query_embedding) AS similarity
  FROM conversation_summaries cs
  WHERE cs.agent_id = p_agent_id
    AND cs.user_id = p_user_id
    AND (p_start_date IS NULL OR cs.created_at >= p_start_date)
    AND (p_end_date IS NULL OR cs.created_at <= p_end_date)
  ORDER BY cs.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- GRANTS: Ensure proper permissions
-- ============================================================================

-- Allow service role to execute (used by Edge Functions)
GRANT EXECUTE ON FUNCTION search_working_memory(UUID, UUID, VECTOR(1536), INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION search_conversation_summaries(UUID, UUID, VECTOR(1536), TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;

-- Allow authenticated users to execute (for direct access)
GRANT EXECUTE ON FUNCTION search_working_memory(UUID, UUID, VECTOR(1536), INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_conversation_summaries(UUID, UUID, VECTOR(1536), TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;

-- ============================================================================
-- COMMENTS: Documentation
-- ============================================================================

COMMENT ON FUNCTION search_working_memory(UUID, UUID, VECTOR(1536), INTEGER) IS 
  'Vector similarity search for working memory chunks. Returns most relevant chunks for a query embedding.';

COMMENT ON FUNCTION search_conversation_summaries(UUID, UUID, VECTOR(1536), TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) IS 
  'Vector similarity search for conversation summaries. Optionally filter by date range.';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Working memory RPC functions created successfully';
  RAISE NOTICE '🔍 search_working_memory() - Search recent conversation chunks';
  RAISE NOTICE '🔍 search_conversation_summaries() - Search past conversations';
  RAISE NOTICE '⚡ Ready for Phase 2.2: Integration with chat handler';
END $$;

