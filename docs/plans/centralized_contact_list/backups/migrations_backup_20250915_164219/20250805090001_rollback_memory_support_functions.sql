-- Rollback Memory Support Functions
-- Removes SQL functions created for memory management system

-- Drop functions
DROP FUNCTION IF EXISTS increment_memory_access(UUID);
DROP FUNCTION IF EXISTS get_memory_stats(UUID);
DROP FUNCTION IF EXISTS find_similar_memories(UUID, VECTOR(1536), FLOAT, INTEGER);
DROP FUNCTION IF EXISTS cleanup_expired_memories();
DROP FUNCTION IF EXISTS consolidate_memories(UUID, FLOAT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS update_memory_importance();
DROP FUNCTION IF EXISTS get_memory_recommendations(UUID, TEXT, INTEGER);

-- Drop indexes
DROP INDEX IF EXISTS idx_agent_memories_embedding_cosine;
DROP INDEX IF EXISTS idx_agent_memories_expires_at;
DROP INDEX IF EXISTS idx_agent_memories_last_accessed;
DROP INDEX IF EXISTS idx_agent_memories_importance;