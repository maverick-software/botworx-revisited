-- Migration: Remove Deprecated Graph Tables
-- Date: 2025-10-06
-- Description: Remove local graph caching tables that are redundant with GetZep Cloud storage
-- Reason: Knowledge graph data lives entirely in GetZep's cloud service. These local tables
--         were part of an abandoned plan to mirror graph data locally, which is unnecessary
--         and inefficient. The account_graphs table is kept as it tracks GetZep connections.

-- =============================================
-- BACKUP NOTICE
-- =============================================
-- Before running this migration, ensure you have:
-- 1. Verified that no active code is using these tables
-- 2. Backed up your database if needed
-- 3. Confirmed that all graph operations use GetZep API directly

-- =============================================
-- DROP TABLES
-- =============================================

-- Drop dependent tables first (those with foreign keys to other graph tables)
DROP TABLE IF EXISTS public.graph_links CASCADE;
DROP TABLE IF EXISTS public.graph_ingestion_queue CASCADE;
DROP TABLE IF EXISTS public.graph_edges CASCADE;
DROP TABLE IF EXISTS public.graph_nodes CASCADE;

-- =============================================
-- KEEP account_graphs TABLE
-- =============================================
-- We keep the account_graphs table as it stores:
-- - Which GetZep connection is active for each account
-- - Connection status and metadata
-- - This is the only table needed to track GetZep connectivity

-- Add comment to clarify its purpose
COMMENT ON TABLE public.account_graphs IS 
'Tracks GetZep knowledge graph connections for each account. The actual graph data (nodes, edges, facts) lives in GetZep Cloud and is accessed via their API. This table only stores connection metadata.';

-- =============================================
-- VERIFICATION
-- =============================================
-- After migration, verify:
-- 1. account_graphs table still exists: SELECT * FROM account_graphs LIMIT 1;
-- 2. Deprecated tables are gone: SELECT * FROM graph_nodes LIMIT 1; (should error)
-- 3. Application still functions correctly with GetZep API calls

