-- Fix data type mismatch in search_media_documents_for_agent function
-- and enhance search to support category-based searches

-- Drop and recreate the function with correct data types
DROP FUNCTION IF EXISTS search_media_documents_for_agent(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION search_media_documents_for_agent(
    p_agent_id UUID,
    p_user_id UUID,
    p_query TEXT,
    p_search_type TEXT DEFAULT 'semantic',
    p_category TEXT DEFAULT NULL,
    p_assignment_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    document_id UUID,
    file_name TEXT,
    display_name TEXT,
    description TEXT,
    category TEXT,
    assignment_type TEXT,
    file_size BIGINT,
    processing_status TEXT,
    created_at TIMESTAMPTZ,
    relevance_score DOUBLE PRECISION  -- Changed from FLOAT to DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate agent ownership
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Return documents based on search type
    IF p_search_type = 'semantic' THEN
        -- For semantic search, we'll use text similarity
        RETURN QUERY
        SELECT 
            ml.id,
            ml.file_name,
            COALESCE(ml.display_name, ml.file_name),
            ml.description,
            ml.category,
            ama.assignment_type,
            ml.file_size,
            ml.processing_status,
            ml.created_at,
            -- Cast similarity result to double precision
            CASE 
                WHEN ml.text_content IS NOT NULL THEN
                    similarity(LOWER(p_query), LOWER(ml.text_content))::DOUBLE PRECISION
                ELSE 0.0::DOUBLE PRECISION
            END as relevance_score
        FROM media_library ml
        INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
        WHERE ama.agent_id = p_agent_id 
            AND ama.user_id = p_user_id
            AND ama.is_active = true
            AND ml.is_archived = false
            AND (p_category IS NULL OR ml.category = p_category)
            AND (p_assignment_type IS NULL OR ama.assignment_type = p_assignment_type)
            AND (
                -- Enhanced search: include category matching for queries like "SOP"
                ml.text_content ILIKE '%' || p_query || '%' OR
                ml.file_name ILIKE '%' || p_query || '%' OR
                ml.description ILIKE '%' || p_query || '%' OR
                ml.category ILIKE '%' || p_query || '%' OR  -- Add category search
                EXISTS (SELECT 1 FROM unnest(ml.tags) tag WHERE tag ILIKE '%' || p_query || '%')
            )
        ORDER BY relevance_score DESC, ml.created_at DESC
        LIMIT p_limit;
    ELSE
        -- Keyword or exact search
        RETURN QUERY
        SELECT 
            ml.id,
            ml.file_name,
            COALESCE(ml.display_name, ml.file_name),
            ml.description,
            ml.category,
            ama.assignment_type,
            ml.file_size,
            ml.processing_status,
            ml.created_at,
            1.0::DOUBLE PRECISION as relevance_score -- Cast to double precision
        FROM media_library ml
        INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
        WHERE ama.agent_id = p_agent_id 
            AND ama.user_id = p_user_id
            AND ama.is_active = true
            AND ml.is_archived = false
            AND (p_category IS NULL OR ml.category = p_category)
            AND (p_assignment_type IS NULL OR ama.assignment_type = p_assignment_type)
            AND (
                CASE 
                    WHEN p_search_type = 'exact' THEN
                        ml.text_content LIKE '%' || p_query || '%' OR
                        ml.file_name LIKE '%' || p_query || '%' OR
                        ml.description LIKE '%' || p_query || '%' OR
                        ml.category LIKE '%' || p_query || '%'  -- Add category search
                    ELSE -- keyword search
                        ml.text_content ILIKE '%' || p_query || '%' OR
                        ml.file_name ILIKE '%' || p_query || '%' OR
                        ml.description ILIKE '%' || p_query || '%' OR
                        ml.category ILIKE '%' || p_query || '%' OR  -- Add category search
                        EXISTS (SELECT 1 FROM unnest(ml.tags) tag WHERE tag ILIKE '%' || p_query || '%')
                END
            )
        ORDER BY ml.created_at DESC
        LIMIT p_limit;
    END IF;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION search_media_documents_for_agent(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- Log success
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed search_media_documents_for_agent function:';
    RAISE NOTICE '  - Fixed data type mismatch (real -> double precision)';
    RAISE NOTICE '  - Enhanced search to include category matching';
    RAISE NOTICE '  - Searching for "SOP" will now find documents in SOP category';
END $$;
