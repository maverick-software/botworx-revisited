-- Migration: Create datastore-documents storage bucket and policies
-- Date: 2025-01-25
-- Purpose: Setup storage bucket for agent document uploads and datastore table

-- Skip this migration if agents table doesn't exist (for shadow database compatibility)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents') THEN
        RAISE NOTICE 'Skipping datastore documents storage creation - agents table does not exist yet';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Creating datastore documents storage - agents table exists';
    
    EXECUTE $MIGRATION$
    -- 1. Create datastore_documents table to track uploaded and processed documents
CREATE TABLE IF NOT EXISTS datastore_documents (
    id TEXT PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    text_content TEXT,
    chunk_count INTEGER DEFAULT 0,
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies for datastore_documents table
ALTER TABLE datastore_documents ENABLE ROW LEVEL SECURITY;

-- Users can only access documents for agents they own
CREATE POLICY "Users can view their own datastore documents" ON datastore_documents
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert documents for their own agents" ON datastore_documents
    FOR INSERT WITH CHECK (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own datastore documents" ON datastore_documents
    FOR UPDATE USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own datastore documents" ON datastore_documents
    FOR DELETE USING (
        agent_id IN (
            SELECT id FROM agents WHERE user_id = auth.uid()
        )
    );

-- Service role can access all documents
CREATE POLICY "Service role can manage all datastore documents" ON datastore_documents
    FOR ALL USING (auth.role() = 'service_role');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_datastore_documents_agent_id ON datastore_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_datastore_documents_status ON datastore_documents(status);
CREATE INDEX IF NOT EXISTS idx_datastore_documents_created_at ON datastore_documents(created_at);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_datastore_documents_updated_at()
RETURNS TRIGGER AS $FUNC$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$FUNC$ language 'plpgsql';

CREATE TRIGGER update_datastore_documents_updated_at
    BEFORE UPDATE ON datastore_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_datastore_documents_updated_at();

-- 2. Create the 'datastore-documents' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'datastore-documents',
    'datastore-documents',
    false, -- Private bucket - documents are not publicly accessible
    10485760, -- 10MB limit
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Drop existing policies for this bucket to ensure clean slate
DROP POLICY IF EXISTS "Allow users to upload documents for their agents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read their own agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own agent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role to manage all datastore documents" ON storage.objects;

-- 4. Create RLS policies for datastore-documents bucket

-- Policy: Allow authenticated users to upload documents for their agents
-- Path structure: user_name/agent_name/file_name.pdf
CREATE POLICY "Allow users to upload documents for their agents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'datastore-documents');

-- Policy: Allow users to read documents for their agents
CREATE POLICY "Allow users to read their own agent documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'datastore-documents');

-- Policy: Allow users to update documents for their agents
CREATE POLICY "Allow users to update their own agent documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'datastore-documents')
WITH CHECK (bucket_id = 'datastore-documents');

-- Policy: Allow users to delete documents for their agents
CREATE POLICY "Allow users to delete their own agent documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'datastore-documents');

-- Policy: Allow service role to manage all datastore documents
CREATE POLICY "Allow service role to manage all datastore documents"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'datastore-documents')
WITH CHECK (bucket_id = 'datastore-documents');
    $MIGRATION$;
END $$;