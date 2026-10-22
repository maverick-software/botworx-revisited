-- Media Library System Database Schema
-- Date: August 29, 2025
-- Purpose: Create comprehensive media library system with user-centric document management

BEGIN;

-- =============================================
-- STEP 1: Create media_library table (central document registry)
-- =============================================

CREATE TABLE IF NOT EXISTS media_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File identification and metadata
    file_name TEXT NOT NULL,
    display_name TEXT, -- User-friendly name (optional override)
    file_type TEXT NOT NULL, -- MIME type
    file_size BIGINT NOT NULL, -- Size in bytes
    file_extension TEXT NOT NULL, -- .pdf, .docx, etc.
    
    -- Storage information
    storage_bucket TEXT NOT NULL DEFAULT 'media-library',
    storage_path TEXT NOT NULL, -- Full path in bucket
    file_url TEXT, -- Public URL (if applicable)
    
    -- Document processing status
    processing_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (
        processing_status IN ('uploaded', 'processing', 'completed', 'failed', 'archived')
    ),
    text_content TEXT, -- Extracted text content
    chunk_count INTEGER DEFAULT 0, -- Number of text chunks created
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    -- Categorization and organization
    category TEXT DEFAULT 'general', -- user-defined categories
    tags TEXT[] DEFAULT '{}', -- Array of tags for organization
    description TEXT, -- User description
    
    -- Usage tracking
    assigned_agents_count INTEGER DEFAULT 0, -- Cache for performance
    last_assigned_at TIMESTAMPTZ,
    download_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    
    -- Metadata and versioning
    version INTEGER DEFAULT 1,
    is_archived BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata storage
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT media_library_file_name_length CHECK (char_length(file_name) BETWEEN 1 AND 255),
    CONSTRAINT media_library_file_size_positive CHECK (file_size > 0),
    CONSTRAINT media_library_version_positive CHECK (version > 0),
    CONSTRAINT unique_user_file_path UNIQUE (user_id, storage_path)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_media_library_user_id ON media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_media_library_processing_status ON media_library(processing_status);
CREATE INDEX IF NOT EXISTS idx_media_library_category ON media_library(category);
CREATE INDEX IF NOT EXISTS idx_media_library_tags ON media_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_library_created_at ON media_library(created_at);
CREATE INDEX IF NOT EXISTS idx_media_library_archived ON media_library(is_archived) WHERE is_archived = false;

-- =============================================
-- STEP 2: Create agent_media_assignments table
-- =============================================

CREATE TABLE IF NOT EXISTS agent_media_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Assignment configuration
    assignment_type TEXT NOT NULL DEFAULT 'training_data' CHECK (
        assignment_type IN ('training_data', 'reference', 'sop', 'knowledge_base')
    ),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Processing preferences
    include_in_vector_search BOOLEAN DEFAULT true,
    include_in_knowledge_graph BOOLEAN DEFAULT true,
    priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5), -- 1=low, 5=high
    
    -- Usage tracking
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    
    -- Metadata
    notes TEXT, -- User notes about this assignment
    assignment_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_agent_media_assignment UNIQUE (agent_id, media_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_media_agent_id ON agent_media_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_media_media_id ON agent_media_assignments(media_id);
CREATE INDEX IF NOT EXISTS idx_agent_media_user_id ON agent_media_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_media_active ON agent_media_assignments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_agent_media_type ON agent_media_assignments(assignment_type);

-- =============================================
-- STEP 3: Create media_processing_logs table
-- =============================================

CREATE TABLE IF NOT EXISTS media_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
    
    -- Processing details
    processing_stage TEXT NOT NULL, -- 'upload', 'text_extraction', 'chunking', 'embedding', 'indexing'
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    
    -- Results and metrics
    processing_result JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    processing_time_ms INTEGER,
    
    -- Context
    processor_type TEXT NOT NULL, -- 'pinecone', 'getzep', 'local', etc.
    processor_config JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_media_processing_media_id ON media_processing_logs(media_id);
CREATE INDEX IF NOT EXISTS idx_media_processing_status ON media_processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_media_processing_stage ON media_processing_logs(processing_stage);
CREATE INDEX IF NOT EXISTS idx_media_processing_started_at ON media_processing_logs(started_at);

-- =============================================
-- STEP 4: Create media_categories table (user-defined categories)
-- =============================================

CREATE TABLE IF NOT EXISTS media_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Category details
    name TEXT NOT NULL,
    description TEXT,
    color_hex TEXT, -- For UI theming
    icon_name TEXT, -- Lucide icon name
    
    -- Organization
    parent_category_id UUID REFERENCES media_categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    
    -- Usage tracking
    media_count INTEGER DEFAULT 0, -- Cache for performance
    last_used_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT media_categories_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
    CONSTRAINT unique_user_category_name UNIQUE (user_id, name)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_media_categories_user_id ON media_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_media_categories_parent ON media_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_media_categories_sort_order ON media_categories(sort_order);

-- =============================================
-- STEP 5: Update datastore_documents table to reference media_library
-- =============================================

-- Add media_library_id column to existing datastore_documents table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'datastore_documents' AND column_name = 'media_library_id') THEN
        ALTER TABLE datastore_documents 
        ADD COLUMN media_library_id UUID REFERENCES media_library(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Add index for the new relationship
CREATE INDEX IF NOT EXISTS idx_datastore_documents_media_id ON datastore_documents(media_library_id);

-- =============================================
-- STEP 6: Create RLS policies for media library tables
-- =============================================

-- Enable RLS
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_media_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_processing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_categories ENABLE ROW LEVEL SECURITY;

-- Media Library policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_library' AND policyname = 'Users can manage their own media library') THEN
        CREATE POLICY "Users can manage their own media library"
        ON media_library FOR ALL
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END
$$;

-- Agent Media Assignments policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_media_assignments' AND policyname = 'Users can manage their own agent media assignments') THEN
        CREATE POLICY "Users can manage their own agent media assignments"
        ON agent_media_assignments FOR ALL
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END
$$;

-- Media Processing Logs policies (read-only for users)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_processing_logs' AND policyname = 'Users can view processing logs for their media') THEN
        CREATE POLICY "Users can view processing logs for their media"
        ON media_processing_logs FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM media_library ml 
                WHERE ml.id = media_processing_logs.media_id 
                AND ml.user_id = auth.uid()
            )
        );
    END IF;
END
$$;

-- Service role can manage all processing logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_processing_logs' AND policyname = 'Service role can manage all processing logs') THEN
        CREATE POLICY "Service role can manage all processing logs"
        ON media_processing_logs FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END
$$;

-- Media Categories policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_categories' AND policyname = 'Users can manage their own categories') THEN
        CREATE POLICY "Users can manage their own categories"
        ON media_categories FOR ALL
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;
END
$$;

-- =============================================
-- STEP 7: Create updated_at triggers
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_media_library_updated_at') THEN
        CREATE TRIGGER update_media_library_updated_at
            BEFORE UPDATE ON media_library
            FOR EACH ROW
            EXECUTE FUNCTION update_media_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_agent_media_assignments_updated_at') THEN
        CREATE TRIGGER update_agent_media_assignments_updated_at
            BEFORE UPDATE ON agent_media_assignments
            FOR EACH ROW
            EXECUTE FUNCTION update_media_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_media_categories_updated_at') THEN
        CREATE TRIGGER update_media_categories_updated_at
            BEFORE UPDATE ON media_categories
            FOR EACH ROW
            EXECUTE FUNCTION update_media_updated_at();
    END IF;
END
$$;

-- =============================================
-- STEP 8: Create helpful functions
-- =============================================

-- Function to get media library statistics for a user
CREATE OR REPLACE FUNCTION get_user_media_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_files', COUNT(*),
        'total_size_bytes', COALESCE(SUM(file_size), 0),
        'files_by_status', jsonb_object_agg(processing_status, status_count),
        'files_by_type', jsonb_object_agg(file_extension, type_count),
        'categories_count', (
            SELECT COUNT(*) FROM media_categories 
            WHERE user_id = p_user_id
        ),
        'assigned_files_count', (
            SELECT COUNT(DISTINCT media_id) FROM agent_media_assignments 
            WHERE user_id = p_user_id AND is_active = true
        )
    ) INTO stats
    FROM (
        SELECT 
            processing_status,
            file_extension,
            file_size,
            COUNT(*) OVER (PARTITION BY processing_status) as status_count,
            COUNT(*) OVER (PARTITION BY file_extension) as type_count
        FROM media_library 
        WHERE user_id = p_user_id AND is_archived = false
    ) grouped_data;
    
    RETURN COALESCE(stats, '{}'::jsonb);
END;
$$;

-- Function to assign media to agent
CREATE OR REPLACE FUNCTION assign_media_to_agent(
    p_agent_id UUID,
    p_media_id UUID,
    p_user_id UUID,
    p_assignment_type TEXT DEFAULT 'training_data',
    p_include_vector BOOLEAN DEFAULT true,
    p_include_graph BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    assignment_id UUID;
BEGIN
    -- Validate agent ownership
    IF NOT EXISTS (
        SELECT 1 FROM agents 
        WHERE id = p_agent_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Agent not found or access denied';
    END IF;
    
    -- Validate media ownership
    IF NOT EXISTS (
        SELECT 1 FROM media_library 
        WHERE id = p_media_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Media file not found or access denied';
    END IF;
    
    -- Create or update assignment
    INSERT INTO agent_media_assignments (
        agent_id,
        media_id,
        user_id,
        assignment_type,
        include_in_vector_search,
        include_in_knowledge_graph
    ) VALUES (
        p_agent_id,
        p_media_id,
        p_user_id,
        p_assignment_type,
        p_include_vector,
        p_include_graph
    )
    ON CONFLICT (agent_id, media_id) 
    DO UPDATE SET
        assignment_type = EXCLUDED.assignment_type,
        include_in_vector_search = EXCLUDED.include_in_vector_search,
        include_in_knowledge_graph = EXCLUDED.include_in_knowledge_graph,
        is_active = true,
        updated_at = NOW()
    RETURNING id INTO assignment_id;
    
    -- Update assignment count cache
    UPDATE media_library 
    SET 
        assigned_agents_count = (
            SELECT COUNT(*) FROM agent_media_assignments 
            WHERE media_id = p_media_id AND is_active = true
        ),
        last_assigned_at = NOW()
    WHERE id = p_media_id;
    
    RETURN assignment_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_media_stats(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION assign_media_to_agent(UUID, UUID, UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated, service_role;

-- =============================================
-- STEP 9: Create storage bucket for media library
-- =============================================

-- Create the 'media-library' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media-library',
    'media-library',
    false, -- Private bucket - documents require authentication
    52428800, -- 50MB limit (larger than datastore-documents)
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/markdown',
        'text/csv',
        'application/json',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'audio/mpeg',
        'audio/wav',
        'video/mp4',
        'video/webm'
    ]
)
ON CONFLICT (id) 
DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- STEP 10: Create RLS policies for media-library bucket
-- =============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can upload to their media library" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all media files" ON storage.objects;

-- Policy: Allow authenticated users to upload to their media library
-- Path structure: user_id/category/file_name.ext
CREATE POLICY "Users can upload to their media library"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'media-library' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to read their own media files
CREATE POLICY "Users can read their own media files"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'media-library' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to update their own media files
CREATE POLICY "Users can update their own media files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'media-library' AND
    (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'media-library' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own media files
CREATE POLICY "Users can delete their own media files"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'media-library' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow service role to manage all media files
CREATE POLICY "Service role can manage all media files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'media-library')
WITH CHECK (bucket_id = 'media-library');

-- =============================================
-- STEP 11: Add table comments for documentation
-- =============================================

COMMENT ON TABLE media_library IS 'Central registry for user media files with processing status and metadata';
COMMENT ON TABLE agent_media_assignments IS 'Many-to-many relationship between agents and media files with assignment configuration';
COMMENT ON TABLE media_processing_logs IS 'Audit trail for media processing operations across different processors';
COMMENT ON TABLE media_categories IS 'User-defined categories for organizing media files';

COMMENT ON COLUMN media_library.storage_path IS 'Full path in Supabase storage bucket (user_id/category/filename.ext)';
COMMENT ON COLUMN media_library.processing_status IS 'Current processing state: uploaded, processing, completed, failed, archived';
COMMENT ON COLUMN media_library.chunk_count IS 'Number of text chunks created for vector embedding';
COMMENT ON COLUMN agent_media_assignments.assignment_type IS 'How this media is used: training_data, reference, sop, knowledge_base';
COMMENT ON COLUMN agent_media_assignments.priority_level IS 'Processing priority (1=low, 5=high) for agent context';

-- =============================================
-- STEP 12: Insert default categories
-- =============================================

-- Note: We'll insert default categories via a separate function that can be called per-user
-- to avoid issues with RLS policies during migration

COMMIT;
