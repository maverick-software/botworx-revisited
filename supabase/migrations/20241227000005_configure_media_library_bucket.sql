-- Configure media-library bucket for public access
-- File: supabase/migrations/20241227000005_configure_media_library_bucket.sql

-- Ensure the media-library bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-library',
  'media-library',
  true,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mp3', 'audio/wav', 'application/pdf', 'text/plain']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mp3', 'audio/wav', 'application/pdf', 'text/plain'];

-- Create RLS policies for the media-library bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload to media-library"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media-library');

-- Allow public read access to all files in media-library
CREATE POLICY "Public read access to media-library"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'media-library');

-- Allow users to update their own files
CREATE POLICY "Users can update their own files in media-library"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media-library' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files in media-library"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media-library' AND auth.uid()::text = (storage.foldername(name))[1]);
