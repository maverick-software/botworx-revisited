-- Migration: Drop old chat_messages v1 table
-- The system now exclusively uses chat_messages_v2 for all chat functionality
-- This migration removes the deprecated v1 table

BEGIN;

-- Drop all views that depend on chat_messages (if any)
DROP VIEW IF EXISTS chat_messages_with_agents CASCADE;

-- Drop triggers on the old table
DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;

-- Drop indexes on the old table  
DROP INDEX IF EXISTS idx_chat_messages_channel_id;
DROP INDEX IF EXISTS idx_chat_messages_sender_user_id;
DROP INDEX IF EXISTS idx_chat_messages_sender_agent_id;
DROP INDEX IF EXISTS idx_chat_messages_created_at;

-- Drop RLS policies on the old table
DROP POLICY IF EXISTS "Users can view messages in their channels" ON chat_messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages from their agents" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Agents can insert their own messages" ON chat_messages;
DROP POLICY IF EXISTS chat_messages_select_owned ON chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_own ON chat_messages;

-- Drop the old chat_messages table
DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- Add comment to document the migration
COMMENT ON TABLE chat_messages_v2 IS 'Primary chat messages table (V2). The old chat_messages v1 table has been deprecated and removed as of 2025-01-05.';

COMMIT;

