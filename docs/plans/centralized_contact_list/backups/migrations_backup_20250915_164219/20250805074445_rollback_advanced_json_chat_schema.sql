-- Rollback Migration: Remove Advanced JSON Chat System Schema
-- Description: Safely removes the advanced schema while preserving data where possible
-- Author: Agentopia Development Team
-- Date: 2025-08-05
-- WARNING: This will result in data loss for advanced features. Backup before running.

-- =====================================================
-- DISABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE IF EXISTS chat_messages_v2 DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_memories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memory_consolidations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS state_checkpoints DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS state_transitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS context_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS context_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversation_sessions DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- DROP POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own messages" ON chat_messages_v2;
DROP POLICY IF EXISTS "Agents can view messages in their conversations" ON chat_messages_v2;
DROP POLICY IF EXISTS "Users can manage memories for their agents" ON agent_memories;
DROP POLICY IF EXISTS "Users can manage states for their agents" ON agent_states;
DROP POLICY IF EXISTS "Users can view their own sessions" ON conversation_sessions;

-- =====================================================
-- DROP TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS update_chat_messages_v2_updated_at ON chat_messages_v2;
DROP TRIGGER IF EXISTS update_agent_states_updated_at ON agent_states;
DROP TRIGGER IF EXISTS update_context_templates_updated_at ON context_templates;
DROP TRIGGER IF EXISTS update_session_activity ON chat_messages_v2;
DROP TRIGGER IF EXISTS track_memory_access ON agent_memories;

-- =====================================================
-- DROP FUNCTIONS
-- =====================================================

-- Note: Not dropping update_updated_at_column() as it's used by other tables
DROP FUNCTION IF EXISTS update_session_last_active();
DROP FUNCTION IF EXISTS update_memory_access();
DROP FUNCTION IF EXISTS migrate_chat_messages();

-- =====================================================
-- BACKUP CRITICAL DATA (Optional - uncomment if needed)
-- =====================================================

-- Create backup tables before dropping
-- CREATE TABLE IF NOT EXISTS chat_messages_v2_backup AS SELECT * FROM chat_messages_v2;
-- CREATE TABLE IF NOT EXISTS agent_memories_backup AS SELECT * FROM agent_memories;
-- CREATE TABLE IF NOT EXISTS agent_states_backup AS SELECT * FROM agent_states;

-- =====================================================
-- DROP INDEXES
-- =====================================================

-- Context indexes
DROP INDEX IF EXISTS idx_context_templates_name;
DROP INDEX IF EXISTS idx_context_snapshots_agent;
DROP INDEX IF EXISTS idx_context_snapshots_message;

-- State indexes
DROP INDEX IF EXISTS idx_transitions_states;
DROP INDEX IF EXISTS idx_transitions_agent;
DROP INDEX IF EXISTS idx_checkpoints_retention;
DROP INDEX IF EXISTS idx_checkpoints_agent;
DROP INDEX IF EXISTS idx_states_agent_history;
DROP INDEX IF EXISTS idx_states_valid_range;
DROP INDEX IF EXISTS idx_states_agent_current;

-- Memory indexes
DROP INDEX IF EXISTS idx_consolidations_agent;
DROP INDEX IF EXISTS idx_memories_expires;
DROP INDEX IF EXISTS idx_memories_content_gin;
DROP INDEX IF EXISTS idx_memories_embedding;
DROP INDEX IF EXISTS idx_memories_importance;
DROP INDEX IF EXISTS idx_memories_agent_type;

-- Message indexes
DROP INDEX IF EXISTS idx_message_versions_message;
DROP INDEX IF EXISTS idx_messages_metadata_gin;
DROP INDEX IF EXISTS idx_messages_content_gin;
DROP INDEX IF EXISTS idx_messages_sender_agent;
DROP INDEX IF EXISTS idx_messages_sender_user;
DROP INDEX IF EXISTS idx_messages_channel;
DROP INDEX IF EXISTS idx_messages_session;
DROP INDEX IF EXISTS idx_messages_conversation;

-- Session indexes
DROP INDEX IF EXISTS idx_sessions_status;
DROP INDEX IF EXISTS idx_sessions_agent;
DROP INDEX IF EXISTS idx_sessions_user;
DROP INDEX IF EXISTS idx_sessions_conversation;

-- =====================================================
-- DROP TABLES (in dependency order)
-- =====================================================

-- Drop dependent tables first
DROP TABLE IF EXISTS context_snapshots CASCADE;
DROP TABLE IF EXISTS context_templates CASCADE;
DROP TABLE IF EXISTS state_transitions CASCADE;
DROP TABLE IF EXISTS state_checkpoints CASCADE;
DROP TABLE IF EXISTS memory_consolidations CASCADE;
DROP TABLE IF EXISTS message_versions CASCADE;

-- Drop main tables
DROP TABLE IF EXISTS agent_memories CASCADE;
DROP TABLE IF EXISTS agent_states CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;
DROP TABLE IF EXISTS chat_messages_v2 CASCADE;

-- =====================================================
-- MIGRATE BACK TO ORIGINAL SCHEMA (Optional)
-- =====================================================

-- If you backed up data and want to restore to original schema:
-- This assumes the original chat_messages table still exists

-- Example migration back (uncomment and modify as needed):
/*
INSERT INTO chat_messages (channel_id, content, sender_user_id, sender_agent_id, created_at)
SELECT 
    channel_id,
    content->>'text' as content,
    sender_user_id,
    sender_agent_id,
    created_at
FROM chat_messages_v2_backup
WHERE content->>'type' = 'text'
ON CONFLICT DO NOTHING;
*/

-- =====================================================
-- REVOKE PERMISSIONS
-- =====================================================

-- Note: Tables already dropped, no need to revoke permissions

-- =====================================================
-- CLEANUP
-- =====================================================

-- Drop backup tables if they were created
-- DROP TABLE IF EXISTS chat_messages_v2_backup;
-- DROP TABLE IF EXISTS agent_memories_backup;
-- DROP TABLE IF EXISTS agent_states_backup;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify all new tables have been dropped
DO $$
DECLARE
    remaining_tables TEXT;
BEGIN
    SELECT string_agg(tablename, ', ')
    INTO remaining_tables
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
        'chat_messages_v2',
        'message_versions',
        'agent_memories',
        'memory_consolidations',
        'agent_states',
        'state_checkpoints',
        'state_transitions',
        'context_snapshots',
        'context_templates',
        'conversation_sessions'
    );
    
    IF remaining_tables IS NOT NULL THEN
        RAISE NOTICE 'Warning: The following tables were not dropped: %', remaining_tables;
    ELSE
        RAISE NOTICE 'All advanced JSON chat schema tables have been successfully removed.';
    END IF;
END $$;

-- =====================================================
-- END OF ROLLBACK
-- =====================================================