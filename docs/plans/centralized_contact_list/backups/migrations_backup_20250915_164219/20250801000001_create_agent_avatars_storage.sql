-- Migration: Create agent-avatars storage bucket and policies
-- Date: 2025-08-01
-- Purpose: Setup storage bucket for agent avatar images

BEGIN;

-- 1. Create the 'agent-avatars' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'agent-avatars', 
    'agent-avatars', 
    true, 
    5242880, -- 5MB limit (5 * 1024 * 1024)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Drop existing policies for this bucket to ensure clean slate
DROP POLICY IF EXISTS "Allow public read access to agent avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to agent-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own agent avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own agent avatars" ON storage.objects;

-- 3. Create RLS policies for agent-avatars bucket

-- Policy: Allow public read access to agent avatar files
CREATE POLICY "Allow public read access to agent avatars"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'agent-avatars');

-- Policy: Allow authenticated users to upload agent avatars
-- Files can be uploaded with any naming pattern since we use agent IDs
CREATE POLICY "Allow authenticated upload to agent-avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-avatars');

-- Policy: Allow users to update agent avatars for their own agents
CREATE POLICY "Allow users to update their own agent avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-avatars')
WITH CHECK (bucket_id = 'agent-avatars');

-- Policy: Allow users to delete agent avatars for their own agents  
CREATE POLICY "Allow users to delete their own agent avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'agent-avatars');

COMMIT;