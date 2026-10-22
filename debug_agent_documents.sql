-- Debug script to check agent datastore connections and document processing
-- Run this in Supabase SQL Editor to diagnose the document knowledge issue

-- 1. Check agent information
SELECT 
  id,
  name,
  user_id,
  created_at
FROM agents 
WHERE name = 'Angela' 
LIMIT 5;

-- 2. Check agent datastore connections
SELECT 
  ad.agent_id,
  ad.datastore_id,
  a.name as agent_name,
  d.name as datastore_name,
  d.type as datastore_type,
  d.config,
  d.similarity_threshold,
  d.max_results
FROM agent_datastores ad
JOIN agents a ON ad.agent_id = a.id
JOIN datastores d ON ad.datastore_id = d.id
WHERE a.name = 'Angela';

-- 3. Check if there are any datastores at all
SELECT 
  id,
  name,
  type,
  user_id,
  similarity_threshold,
  max_results,
  created_at
FROM datastores 
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if documents have been processed
SELECT 
  id,
  agent_id,
  file_name,
  file_type,
  processing_status,
  created_at,
  error_message
FROM datastore_documents 
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check storage bucket contents (if accessible via SQL)
-- Note: This might not work depending on RLS policies
-- SELECT * FROM storage.objects WHERE bucket_id = 'datastore-documents' LIMIT 10;