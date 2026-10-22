-- Memory Support Functions
-- SQL functions to support the memory management system

-- Function to increment memory access count
CREATE OR REPLACE FUNCTION increment_memory_access(memory_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE agent_memories 
    SET 
        access_count = access_count + 1,
        last_accessed = now()
    WHERE id = memory_id;
END;
$$;

-- Function to get memory statistics for an agent
CREATE OR REPLACE FUNCTION get_memory_stats(agent_uuid UUID)
RETURNS TABLE(
    memory_type TEXT,
    count BIGINT,
    avg_importance NUMERIC,
    avg_access_count NUMERIC,
    oldest_created TIMESTAMPTZ,
    newest_created TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        am.memory_type::TEXT,
        COUNT(*) as count,
        AVG(am.importance_score) as avg_importance,
        AVG(am.access_count) as avg_access_count,
        MIN(am.created_at) as oldest_created,
        MAX(am.created_at) as newest_created
    FROM agent_memories am
    WHERE am.agent_id = agent_uuid
    GROUP BY am.memory_type;
END;
$$;

-- Function to find similar memories using vector search
CREATE OR REPLACE FUNCTION find_similar_memories(
    agent_uuid UUID,
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    memory_type TEXT,
    content JSONB,
    similarity FLOAT,
    importance FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        am.id,
        am.memory_type::TEXT,
        am.content,
        (1 - (am.embeddings <-> query_embedding)) as similarity,
        am.importance_score::FLOAT,
        am.created_at
    FROM agent_memories am
    WHERE am.agent_id = agent_uuid
        AND am.embeddings IS NOT NULL
        AND (1 - (am.embeddings <-> query_embedding)) >= similarity_threshold
    ORDER BY am.embeddings <-> query_embedding
    LIMIT max_results;
END;
$$;

-- Function to clean up expired memories
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS TABLE(
    deleted_count INTEGER,
    agent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_results RECORD;
BEGIN
    -- Delete expired memories and return counts per agent
    FOR cleanup_results IN 
        SELECT am.agent_id, COUNT(*) as count
        FROM agent_memories am
        WHERE am.expires_at IS NOT NULL 
            AND am.expires_at < now()
        GROUP BY am.agent_id
    LOOP
        DELETE FROM agent_memories am
        WHERE am.agent_id = cleanup_results.agent_id
            AND am.expires_at IS NOT NULL 
            AND am.expires_at < now();
            
        deleted_count := cleanup_results.count;
        agent_id := cleanup_results.agent_id;
        
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Function to consolidate low-importance memories
CREATE OR REPLACE FUNCTION consolidate_memories(
    agent_uuid UUID,
    importance_threshold FLOAT DEFAULT 0.3,
    access_threshold INTEGER DEFAULT 2,
    max_age_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    consolidation_id UUID,
    original_count INTEGER,
    memory_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    memory_record RECORD;
    new_consolidation_id UUID;
    consolidation_content JSONB;
    original_ids UUID[];
    original_memory_count INTEGER;
BEGIN
    -- Group memories by type for consolidation
    FOR memory_record IN
        SELECT 
            am.memory_type,
            COUNT(*) as count,
            ARRAY_AGG(am.id) as ids,
            ARRAY_AGG(am.content) as contents,
            AVG(am.importance_score) as avg_importance,
            SUM(am.access_count) as total_access
        FROM agent_memories am
        WHERE am.agent_id = agent_uuid
            AND am.importance < importance_threshold
            AND am.access_count < access_threshold
            AND am.created_at < (now() - INTERVAL '1 day' * max_age_days)
            AND am.memory_type IN ('episodic', 'semantic')
        GROUP BY am.memory_type
        HAVING COUNT(*) >= 3
    LOOP
        -- Generate new consolidation ID
        new_consolidation_id := gen_random_uuid();
        original_ids := memory_record.ids;
        original_memory_count := memory_record.count;
        
        -- Create consolidated content
        consolidation_content := jsonb_build_object(
            'type', 'consolidated',
            'original_count', original_memory_count,
            'consolidation_method', 'low_importance_batch',
            'original_memories', original_ids,
            'summary', format('Consolidated %s memories from %s', 
                            original_memory_count, 
                            memory_record.memory_type),
            'created_at', now()
        );
        
        -- Insert consolidated memory
        INSERT INTO agent_memories (
            id, agent_id, memory_type, content, importance, 
            decay_rate, access_count, related_memories, created_at, last_accessed
        ) VALUES (
            new_consolidation_id,
            agent_uuid,
            CASE 
                WHEN memory_record.memory_type = 'episodic' THEN 'semantic'
                ELSE memory_record.memory_type
            END,
            consolidation_content,
            GREATEST(memory_record.avg_importance * 1.2, 0.5), -- Boost consolidated importance_score
            0.05, -- Slower decay for consolidated memories
            memory_record.total_access,
            original_ids,
            now(),
            now()
        );
        
        -- Delete original memories
        DELETE FROM agent_memories 
        WHERE id = ANY(original_ids);
        
        -- Return consolidation info
        consolidation_id := new_consolidation_id;
        original_count := original_memory_count;
        memory_type := memory_record.memory_type;
        
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Function to update memory importance based on access patterns
CREATE OR REPLACE FUNCTION update_memory_importance()
RETURNS TABLE(
    updated_count INTEGER,
    agent_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    agent_record RECORD;
    updated_memories INTEGER;
BEGIN
    -- Process each agent
    FOR agent_record IN 
        SELECT DISTINCT am.agent_id
        FROM agent_memories am
    LOOP
        -- Update importance based on access patterns
        WITH access_stats AS (
            SELECT 
                id,
                access_count,
                EXTRACT(DAYS FROM (now() - last_accessed)) as days_since_access,
                EXTRACT(DAYS FROM (now() - created_at)) as age_days,
                ROW_NUMBER() OVER (ORDER BY access_count DESC) as access_rank,
                COUNT(*) OVER () as total_memories
            FROM agent_memories
            WHERE agent_id = agent_record.agent_id
        ),
        importance_updates AS (
            SELECT 
                id,
                GREATEST(
                    0.1, -- Minimum importance
                    LEAST(
                        1.0, -- Maximum importance
                        -- Base importance from access frequency
                        (access_count::FLOAT / GREATEST(age_days, 1)) * 0.5 +
                        -- Recency bonus
                        CASE 
                            WHEN days_since_access <= 1 THEN 0.3
                            WHEN days_since_access <= 7 THEN 0.2
                            WHEN days_since_access <= 30 THEN 0.1
                            ELSE 0.0
                        END +
                        -- Relative access rank bonus
                        (1.0 - (access_rank::FLOAT / total_memories)) * 0.2
                    )
                ) as new_importance
            FROM access_stats
        )
        UPDATE agent_memories am
        SET importance_score = iu.new_importance
        FROM importance_updates iu
        WHERE am.id = iu.id
            AND ABS(am.importance_score - iu.new_importance) > 0.05; -- Only update if significant change
        
        GET DIAGNOSTICS updated_memories = ROW_COUNT;
        
        updated_count := updated_memories;
        agent_id := agent_record.agent_id;
        
        IF updated_memories > 0 THEN
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- Function to get memory retrieval recommendations
CREATE OR REPLACE FUNCTION get_memory_recommendations(
    agent_uuid UUID,
    current_context TEXT,
    max_recommendations INTEGER DEFAULT 5
)
RETURNS TABLE(
    memory_id UUID,
    memory_type TEXT,
    relevance_score FLOAT,
    content_preview TEXT,
    last_accessed TIMESTAMPTZ,
    access_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH context_analysis AS (
        SELECT 
            am.*,
            -- Simple text similarity (in production, use vector similarity)
            CASE 
                WHEN am.content::TEXT ILIKE '%' || current_context || '%' THEN 0.8
                WHEN similarity(am.content::TEXT, current_context) > 0.3 THEN 0.6
                ELSE 0.2
            END as text_similarity,
            -- Importance factor
            am.importance * 0.4 as importance_factor,
            -- Recency factor
            CASE 
                WHEN am.last_accessed > (now() - INTERVAL '1 day') THEN 0.3
                WHEN am.last_accessed > (now() - INTERVAL '7 days') THEN 0.2
                WHEN am.last_accessed > (now() - INTERVAL '30 days') THEN 0.1
                ELSE 0.05
            END as recency_factor,
            -- Access frequency factor
            LEAST(am.access_count::FLOAT / 10.0, 0.2) as frequency_factor
        FROM agent_memories am
        WHERE am.agent_id = agent_uuid
            AND am.expires_at IS NULL OR am.expires_at > now()
    )
    SELECT 
        ca.id as memory_id,
        ca.memory_type::TEXT,
        (ca.text_similarity + ca.importance_factor + ca.recency_factor + ca.frequency_factor) as relevance_score,
        LEFT(ca.content::TEXT, 100) as content_preview,
        ca.last_accessed,
        ca.access_count
    FROM context_analysis ca
    ORDER BY relevance_score DESC
    LIMIT max_recommendations;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding_cosine 
ON agent_memories USING ivfflat (embeddings vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_agent_memories_expires_at 
ON agent_memories (expires_at) 
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_memories_last_accessed 
ON agent_memories (agent_id, last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_agent_memories_importance 
ON agent_memories (agent_id, importance DESC);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION increment_memory_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_memories(UUID, VECTOR(1536), FLOAT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_recommendations(UUID, TEXT, INTEGER) TO authenticated;

-- Service role functions for maintenance
GRANT EXECUTE ON FUNCTION cleanup_expired_memories() TO service_role;
GRANT EXECUTE ON FUNCTION consolidate_memories(UUID, FLOAT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION update_memory_importance() TO service_role;