-- Migration: Update Temporary Chat Session Documentation
-- Description: Clarify conversation_id usage for context preservation
-- Date: 2025-01-10
-- Purpose: Update documentation to reflect new context-linking behavior

-- Update the conversation_id column comment to clarify new usage
COMMENT ON COLUMN temporary_chat_sessions.conversation_id IS 
  'Conversation ID from the source conversation (via temporary_chat_links.source_conversation_id). This allows temporary chat messages to appear in the original conversation context where the link was created, enabling the agent to see and reference the gathered information. Messages from temporary chats share the same conversation_id as the original conversation, making them automatically available in the agent''s context.';

-- Update table comment to reflect new architecture
COMMENT ON TABLE temporary_chat_sessions IS 
  'Individual chat sessions created through temporary chat links. Sessions now link back to the source conversation for context preservation, allowing agents to access information gathered through temporary chats. Each session represents one anonymous user''s interaction with the agent via a temporary link.';

-- Update session_id column comment for clarity
COMMENT ON COLUMN temporary_chat_sessions.conversation_session_id IS 
  'Links to conversation_sessions table for integration with the main chat system. This represents the specific session instance within the broader conversation context.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration: 20250110000002_update_temp_chat_session_docs';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Status: COMPLETED';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated documentation for:';
  RAISE NOTICE '  ✓ temporary_chat_sessions.conversation_id - Clarified context linking';
  RAISE NOTICE '  ✓ temporary_chat_sessions table - Updated architecture description';
  RAISE NOTICE '  ✓ temporary_chat_sessions.conversation_session_id - Added clarity';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact: Documentation now accurately reflects the context preservation';
  RAISE NOTICE 'architecture where temporary chats link back to source conversations.';
  RAISE NOTICE '=================================================================';
END $$;

