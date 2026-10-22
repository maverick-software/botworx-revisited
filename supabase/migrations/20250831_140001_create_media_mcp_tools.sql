-- Media Library MCP Tools Integration
-- Date: August 29, 2025
-- Purpose: Create MCP tools for document search, retrieval, and management

BEGIN;

-- =============================================
-- STEP 1: Create Media Library MCP integration in tool_catalog
-- =============================================

-- Insert Media Library as a tool in the catalog
INSERT INTO tool_catalog (
    id,
    tool_name,
    name,
    description,
    package_identifier,
    docker_image_url,
    provider,
    category,
    version,
    packaging_type,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000002', -- Fixed UUID for Media Library tools
    'media_library',
    'Media Library',
    'Document search, retrieval, and management tools for agent knowledge base',
    'internal/media-library',
    'internal/media-library:latest',
    'internal',
    'document_management',
    '1.0.0',
    'docker_image',
    'available'
)
ON CONFLICT (tool_name) 
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    package_identifier = EXCLUDED.package_identifier,
    docker_image_url = EXCLUDED.docker_image_url,
    provider = EXCLUDED.provider,
    category = EXCLUDED.category,
    version = EXCLUDED.version,
    status = EXCLUDED.status;

-- =============================================
-- STEP 2: Create integration_capabilities for Media Library tools
-- =============================================

-- Get the media library integration ID
DO $$
DECLARE
    media_lib_integration_id UUID;
    capability_configs JSONB[] := ARRAY[
        '{"capability_key": "search_documents", "display_label": "Search Documents", "description": "Search through assigned documents using semantic or keyword search", "required_scopes": ["document_search"], "is_default_enabled": true}',
        '{"capability_key": "get_document_content", "display_label": "Get Document Content", "description": "Retrieve the full content of a specific document", "required_scopes": ["document_retrieval"], "is_default_enabled": true}',
        '{"capability_key": "list_assigned_documents", "display_label": "List Documents", "description": "List all documents assigned to this agent", "required_scopes": ["document_management"], "is_default_enabled": true}',
        '{"capability_key": "get_document_summary", "display_label": "Document Summary", "description": "Get AI-generated summaries of documents", "required_scopes": ["document_analysis"], "is_default_enabled": true}',
        '{"capability_key": "find_related_documents", "display_label": "Find Related Documents", "description": "Find documents related to topics or other documents", "required_scopes": ["document_search", "document_analysis"], "is_default_enabled": true}'
    ];
    config JSONB;
BEGIN
    -- Find or create integration for Media Library
    SELECT id INTO media_lib_integration_id
    FROM integrations 
    WHERE name = 'media_library_mcp';
    
    IF media_lib_integration_id IS NULL THEN
        -- Get or create a category for document management tools
        DECLARE
            doc_category_id UUID;
        BEGIN
            SELECT id INTO doc_category_id 
            FROM integration_categories 
            WHERE name = 'Document Management' 
            LIMIT 1;
            
            IF doc_category_id IS NULL THEN
                -- Create the category if it doesn't exist
                INSERT INTO integration_categories (name, description, icon_name, display_order)
                VALUES ('Document Management', 'Document storage and retrieval tools', 'FileText', 100)
                RETURNING id INTO doc_category_id;
            END IF;
            
            -- Create the integration
            INSERT INTO integrations (
                id,
                category_id,
                name,
                description,
                icon_name,
                status,
                agent_classification,
                required_oauth_provider_id,
                is_active
            ) VALUES (
                gen_random_uuid(),
                doc_category_id,
                'media_library_mcp',
                'Document management and search capabilities for agent knowledge base',
                'FileText',
                'available',
                'tool',
                NULL, -- No OAuth required for internal tools
                true
            ) RETURNING id INTO media_lib_integration_id;
        END;
    END IF;
    
    -- Create capabilities for each tool
    FOREACH config IN ARRAY capability_configs
    LOOP
        INSERT INTO integration_capabilities (
            integration_id,
            capability_key,
            display_label,
            display_order
        ) VALUES (
            media_lib_integration_id,
            (config->>'capability_key')::text,
            (config->>'display_label')::text,
            array_position(capability_configs, config)
        )
        ON CONFLICT (integration_id, capability_key) 
        DO UPDATE SET
            display_label = EXCLUDED.display_label,
            display_order = EXCLUDED.display_order,
            updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE 'Media Library MCP integration and capabilities created successfully';
END $$;

-- =============================================
-- STEP 3: Create helper functions for MCP tool operations
-- =============================================

-- Function to search documents for an agent
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
    relevance_score FLOAT
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
        -- For semantic search, we'll use text similarity (can be enhanced with vector search later)
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
            -- Simple text similarity score (can be replaced with vector similarity)
            CASE 
                WHEN ml.text_content IS NOT NULL THEN
                    similarity(LOWER(p_query), LOWER(ml.text_content))
                ELSE 0.0
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
                ml.text_content ILIKE '%' || p_query || '%' OR
                ml.file_name ILIKE '%' || p_query || '%' OR
                ml.description ILIKE '%' || p_query || '%' OR
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
            1.0::FLOAT as relevance_score -- Fixed score for non-semantic search
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
                        ml.description LIKE '%' || p_query || '%'
                    ELSE -- keyword search
                        ml.text_content ILIKE '%' || p_query || '%' OR
                        ml.file_name ILIKE '%' || p_query || '%' OR
                        ml.description ILIKE '%' || p_query || '%' OR
                        EXISTS (SELECT 1 FROM unnest(ml.tags) tag WHERE tag ILIKE '%' || p_query || '%')
                END
            )
        ORDER BY ml.created_at DESC
        LIMIT p_limit;
    END IF;
END;
$$;

-- Function to get document content for MCP tool
CREATE OR REPLACE FUNCTION get_media_document_content_for_agent(
    p_agent_id UUID,
    p_user_id UUID,
    p_document_id UUID,
    p_include_metadata BOOLEAN DEFAULT true
)
RETURNS TABLE (
    document_id UUID,
    file_name TEXT,
    display_name TEXT,
    file_type TEXT,
    file_size BIGINT,
    category TEXT,
    assignment_type TEXT,
    text_content TEXT,
    tags TEXT[],
    description TEXT,
    processing_status TEXT,
    chunk_count INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
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
    
    -- Validate document assignment to agent
    IF NOT EXISTS (
        SELECT 1 FROM agent_media_assignments ama
        INNER JOIN media_library ml ON ama.media_id = ml.id
        WHERE ama.agent_id = p_agent_id 
            AND ama.user_id = p_user_id
            AND ml.id = p_document_id
            AND ama.is_active = true
            AND ml.is_archived = false
    ) THEN
        RAISE EXCEPTION 'Document not found or not assigned to this agent';
    END IF;
    
    -- Return document content
    RETURN QUERY
    SELECT 
        ml.id,
        ml.file_name,
        COALESCE(ml.display_name, ml.file_name),
        ml.file_type,
        ml.file_size,
        ml.category,
        ama.assignment_type,
        ml.text_content,
        ml.tags,
        ml.description,
        ml.processing_status,
        ml.chunk_count,
        CASE WHEN p_include_metadata THEN ml.metadata ELSE '{}'::jsonb END,
        ml.created_at,
        ml.updated_at
    FROM media_library ml
    INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
    WHERE ml.id = p_document_id
        AND ama.agent_id = p_agent_id
        AND ama.user_id = p_user_id
        AND ama.is_active = true
        AND ml.is_archived = false;
    
    -- Update access tracking
    UPDATE agent_media_assignments 
    SET 
        last_accessed_at = NOW(),
        access_count = access_count + 1
    WHERE agent_id = p_agent_id 
        AND media_id = p_document_id
        AND user_id = p_user_id;
        
    UPDATE media_library 
    SET last_accessed_at = NOW()
    WHERE id = p_document_id;
END;
$$;

-- Function to list agent's assigned documents for MCP tool
CREATE OR REPLACE FUNCTION list_agent_assigned_documents(
    p_agent_id UUID,
    p_user_id UUID,
    p_category TEXT DEFAULT NULL,
    p_assignment_type TEXT DEFAULT NULL,
    p_include_inactive BOOLEAN DEFAULT false,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    document_id UUID,
    file_name TEXT,
    display_name TEXT,
    file_type TEXT,
    file_size BIGINT,
    category TEXT,
    assignment_type TEXT,
    processing_status TEXT,
    tags TEXT[],
    description TEXT,
    chunk_count INTEGER,
    assigned_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER,
    is_active BOOLEAN
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
    
    -- Return assigned documents
    RETURN QUERY
    SELECT 
        ml.id,
        ml.file_name,
        COALESCE(ml.display_name, ml.file_name),
        ml.file_type,
        ml.file_size,
        ml.category,
        ama.assignment_type,
        ml.processing_status,
        ml.tags,
        ml.description,
        ml.chunk_count,
        ama.assigned_at,
        ama.last_accessed_at,
        ama.access_count,
        ama.is_active
    FROM media_library ml
    INNER JOIN agent_media_assignments ama ON ml.id = ama.media_id
    WHERE ama.agent_id = p_agent_id 
        AND ama.user_id = p_user_id
        AND ml.is_archived = false
        AND (p_include_inactive OR ama.is_active = true)
        AND (p_category IS NULL OR ml.category = p_category)
        AND (p_assignment_type IS NULL OR ama.assignment_type = p_assignment_type)
    ORDER BY ama.assigned_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Function to create default media categories for a user
CREATE OR REPLACE FUNCTION create_default_media_categories(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    default_categories JSONB[] := ARRAY[
        '{"name": "SOPs", "description": "Standard Operating Procedures", "icon_name": "BookOpen", "color_hex": "#3B82F6"}',
        '{"name": "Training", "description": "Training materials and documentation", "icon_name": "GraduationCap", "color_hex": "#10B981"}',
        '{"name": "Reference", "description": "Reference documents and guides", "icon_name": "BookMarked", "color_hex": "#8B5CF6"}',
        '{"name": "Policies", "description": "Company policies and procedures", "icon_name": "Shield", "color_hex": "#F59E0B"}',
        '{"name": "Templates", "description": "Document templates and forms", "icon_name": "FileText", "color_hex": "#EF4444"}'
    ];
    category JSONB;
BEGIN
    FOREACH category IN ARRAY default_categories
    LOOP
        INSERT INTO media_categories (
            user_id,
            name,
            description,
            icon_name,
            color_hex,
            sort_order
        ) VALUES (
            p_user_id,
            (category->>'name')::text,
            (category->>'description')::text,
            (category->>'icon_name')::text,
            (category->>'color_hex')::text,
            array_position(default_categories, category)
        )
        ON CONFLICT (user_id, name) DO NOTHING;
    END LOOP;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION search_media_documents_for_agent(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_media_document_content_for_agent(UUID, UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_agent_assigned_documents(UUID, UUID, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_default_media_categories(UUID) TO authenticated, service_role;

-- =============================================
-- STEP 4: Create indexes for MCP tool performance
-- =============================================

-- Text search indexes for keyword/exact search
CREATE INDEX IF NOT EXISTS idx_media_library_text_content_gin ON media_library USING gin(to_tsvector('english', text_content));
CREATE INDEX IF NOT EXISTS idx_media_library_file_name_gin ON media_library USING gin(to_tsvector('english', file_name));

-- Combined indexes for common MCP queries
CREATE INDEX IF NOT EXISTS idx_agent_media_assignments_agent_active ON agent_media_assignments(agent_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_media_library_category_status ON media_library(category, processing_status) WHERE is_archived = false;

-- =============================================
-- STEP 5: Verification and logging
-- =============================================

-- Log successful completion
DO $$
BEGIN
    RAISE NOTICE 'Media Library MCP tools integration completed successfully';
    RAISE NOTICE 'Created tool catalog entry, integration capabilities, and helper functions';
    RAISE NOTICE 'Available MCP tools: search_documents, get_document_content, list_assigned_documents, get_document_summary, find_related_documents';
END $$;

COMMIT;