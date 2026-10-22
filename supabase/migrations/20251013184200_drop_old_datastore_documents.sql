-- Drop deprecated datastore_documents table
-- Date: October 13, 2025
-- Reason: Replaced by media_library system (implemented August 2025)

-- System evolution:
-- OLD: datastore_documents - Agent-centric document storage
--      - Documents tied to specific agents
--      - Upload via "What I Know" modal
--      - Processed to Pinecone/GetZep per agent
--      - Table: agent_id, file_name, file_url, text_content, chunk_count
--
-- NEW: media_library - User-centric media management
--      - WordPress-style centralized library
--      - Upload once, assign to multiple agents
--      - Better categorization, tagging, versioning
--      - Table: user_id, file_name, storage_path, category, tags, assigned_agents_count
--      - Related: agent_media_assignments, media_processing_logs, media_categories

-- New system implemented in migrations:
-- - 20250830_140000_create_media_library_schema.sql
-- - 20250831_140001_create_media_mcp_tools.sql

DROP TABLE IF EXISTS public.datastore_documents CASCADE;

-- Related edge function to investigate:
-- - process-datastore-document: Should be deprecated in favor of media-library-api
-- - The old function inserts into datastore_documents (line 83-94)
-- - New system uses media-library-api and media-library-mcp edge functions

-- Migration note:
-- If you had documents in datastore_documents, they would need manual migration
-- to media_library table. However, since table is empty, no data migration needed.

