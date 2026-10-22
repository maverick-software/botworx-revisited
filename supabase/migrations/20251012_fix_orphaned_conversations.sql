-- ============================================================================
-- Migration: Fix Orphaned Conversations and Add Constraints
-- Date: 2025-10-12
-- Purpose: Delete orphaned chat messages and ensure conversation_sessions
--          rows MUST exist before messages can be created
-- ============================================================================

-- Step 1: Delete all orphaned messages (messages without conversation_sessions)
-- This will clean up the 43+ orphaned conversations
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_messages_v2
  WHERE NOT EXISTS (
    SELECT 1 FROM conversation_sessions cs
    WHERE cs.conversation_id = chat_messages_v2.conversation_id
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE '🗑️ Deleted % orphaned messages', deleted_count;
END $$;

-- Step 2: Add unique constraint on conversation_sessions.conversation_id FIRST
-- This ensures one conversation = one session and allows foreign key creation
ALTER TABLE conversation_sessions
  ADD CONSTRAINT conversation_sessions_conversation_id_unique 
  UNIQUE (conversation_id);

-- Step 3: Add foreign key constraint to ensure conversation_sessions MUST exist
-- This prevents future orphaned messages
ALTER TABLE chat_messages_v2
  ADD CONSTRAINT chat_messages_v2_conversation_id_fkey 
  FOREIGN KEY (conversation_id) 
  REFERENCES conversation_sessions(conversation_id)
  ON DELETE CASCADE;

-- Step 4: Create index for the foreign key (performance)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_fk 
  ON chat_messages_v2(conversation_id);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Orphaned conversations cleaned up successfully';
  RAISE NOTICE '✅ Added foreign key constraint: chat_messages_v2 -> conversation_sessions';
  RAISE NOTICE '✅ Added unique constraint on conversation_sessions.conversation_id';
  RAISE NOTICE '🎯 Future messages MUST have a valid conversation_session row';
END $$;

