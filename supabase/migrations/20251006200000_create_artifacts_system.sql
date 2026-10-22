-- Migration: Create Artifacts System
-- Description: Creates artifacts and artifact_versions tables for AI-generated content storage
-- Date: October 6, 2025
-- Status: Phase 1 - Database & Backend

-- =====================================================
-- TABLE: artifacts
-- =====================================================
-- Stores AI-generated content (code, documents, etc.)
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ownership
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Context (links to conversation/chat session)
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    conversation_session_id UUID,  -- References conversation_sessions(id) - nullable for flexibility
    message_id UUID,  -- References chat_messages_v2(id) or chat_messages(id) - nullable for flexibility
    
    -- Artifact Info
    title TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (
        file_type IN (
            'txt', 'md', 'json', 'html', 
            'javascript', 'typescript', 'python', 'java', 
            'css', 'csv', 'sql', 'yaml', 'xml',
            'bash', 'shell', 'dockerfile'
        )
    ),
    
    -- Content Storage
    content TEXT NOT NULL,  -- Store text content directly
    storage_path TEXT,      -- Optional: path in Supabase Storage bucket for backup
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_artifact_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
    is_latest_version BOOLEAN DEFAULT true,
    
    -- Metadata
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,  -- Flexible storage for file_size, line_count, etc.
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    
    -- Analytics
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT artifacts_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
    CONSTRAINT artifacts_version_positive CHECK (version > 0),
    CONSTRAINT artifacts_view_count_positive CHECK (view_count >= 0),
    CONSTRAINT artifacts_download_count_positive CHECK (download_count >= 0)
);

-- Indexes for artifacts table
CREATE INDEX IF NOT EXISTS idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_agent_id ON artifacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_conversation_session_id ON artifacts(conversation_session_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_workspace_id ON artifacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_message_id ON artifacts(message_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_file_type ON artifacts(file_type);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_updated_at ON artifacts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_status ON artifacts(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_latest ON artifacts(is_latest_version) WHERE is_latest_version = true;
CREATE INDEX IF NOT EXISTS idx_artifacts_tags ON artifacts USING gin(tags);

-- Comment on artifacts table
COMMENT ON TABLE artifacts IS 'Stores AI-generated content (code, documents, etc.) with versioning support';
COMMENT ON COLUMN artifacts.content IS 'Text content stored directly in database';
COMMENT ON COLUMN artifacts.storage_path IS 'Optional backup path in Supabase Storage bucket';
COMMENT ON COLUMN artifacts.metadata IS 'Flexible JSONB field for file_size, line_count, language, etc.';

-- =====================================================
-- TABLE: artifact_versions
-- =====================================================
-- Stores historical versions of artifacts
CREATE TABLE IF NOT EXISTS artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    
    -- Version Info
    version_number INTEGER NOT NULL,
    
    -- Content Snapshot
    content TEXT NOT NULL,
    storage_path TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES auth.users(id),
    changes_note TEXT,  -- Optional user note about changes
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_artifact_version UNIQUE (artifact_id, version_number),
    CONSTRAINT artifact_versions_version_positive CHECK (version_number > 0)
);

-- Indexes for artifact_versions table
CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact_id ON artifact_versions(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_created_at ON artifact_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_created_by ON artifact_versions(created_by);

-- Comment on artifact_versions table
COMMENT ON TABLE artifact_versions IS 'Version history for artifacts - snapshots of previous content';
COMMENT ON COLUMN artifact_versions.changes_note IS 'Optional note describing what changed in this version';

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_versions ENABLE ROW LEVEL SECURITY;

-- artifacts policies
CREATE POLICY "Users can view their own artifacts"
    ON artifacts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view artifacts in their workspaces"
    ON artifacts FOR SELECT
    USING (
        workspace_id IN (
            SELECT workspace_id 
            FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create their own artifacts"
    ON artifacts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own artifacts"
    ON artifacts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own artifacts"
    ON artifacts FOR DELETE
    USING (auth.uid() = user_id);

-- artifact_versions policies
CREATE POLICY "Users can view versions of their artifacts"
    ON artifact_versions FOR SELECT
    USING (
        artifact_id IN (
            SELECT id FROM artifacts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view versions in workspace artifacts"
    ON artifact_versions FOR SELECT
    USING (
        artifact_id IN (
            SELECT id FROM artifacts 
            WHERE workspace_id IN (
                SELECT workspace_id 
                FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create versions for their artifacts"
    ON artifact_versions FOR INSERT
    WITH CHECK (
        artifact_id IN (
            SELECT id FROM artifacts WHERE user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on artifacts
CREATE TRIGGER artifacts_updated_at_trigger
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_artifacts_updated_at();

-- Function: Create artifact version on update
CREATE OR REPLACE FUNCTION create_artifact_version_on_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if content changed
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        -- Insert previous version into artifact_versions
        INSERT INTO artifact_versions (
            artifact_id,
            version_number,
            content,
            storage_path,
            created_by,
            metadata
        ) VALUES (
            OLD.id,
            OLD.version,
            OLD.content,
            OLD.storage_path,
            COALESCE(auth.uid(), OLD.user_id),  -- Use user_id if auth.uid() is NULL
            OLD.metadata
        );
        
        -- Increment version number
        NEW.version = OLD.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-version artifacts on content update
CREATE TRIGGER artifact_version_trigger
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    WHEN (OLD.content IS DISTINCT FROM NEW.content)
    EXECUTE FUNCTION create_artifact_version_on_update();

-- Function: Mark previous versions as not latest
CREATE OR REPLACE FUNCTION mark_previous_versions_not_latest()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new version of an existing artifact (has parent)
    IF NEW.parent_artifact_id IS NOT NULL THEN
        -- Mark all previous versions as not latest
        UPDATE artifacts
        SET is_latest_version = false
        WHERE id = NEW.parent_artifact_id
           OR parent_artifact_id = NEW.parent_artifact_id;
        
        -- Ensure the new one is marked as latest
        NEW.is_latest_version = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-manage is_latest_version flag
CREATE TRIGGER artifacts_latest_version_trigger
    BEFORE INSERT ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION mark_previous_versions_not_latest();

-- =====================================================
-- STORAGE BUCKET (Optional - for backup)
-- =====================================================

-- Create artifacts bucket (if doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'artifacts'
    ) THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('artifacts', 'artifacts', false);
    END IF;
END $$;

-- Storage policies for artifacts bucket
CREATE POLICY "Users can upload their own artifacts"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'artifacts' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can read their own artifacts"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'artifacts' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can update their own artifacts"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'artifacts' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can delete their own artifacts"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'artifacts' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE, DELETE ON artifacts TO authenticated;
GRANT SELECT, INSERT ON artifact_versions TO authenticated;

-- Grant usage on sequences (if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- COMPLETION LOG
-- =====================================================

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Artifacts system migration completed successfully';
    RAISE NOTICE 'Created tables: artifacts, artifact_versions';
    RAISE NOTICE 'Created indexes, RLS policies, triggers, and functions';
    RAISE NOTICE 'Created storage bucket: artifacts';
END $$;

