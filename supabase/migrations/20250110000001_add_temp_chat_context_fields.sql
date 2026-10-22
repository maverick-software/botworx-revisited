-- Migration: Add Contextual Fields to Temporary Chat Links
-- Description: Enables intent-driven temporary chats linked to source conversations
-- Date: 2025-01-10
-- Purpose: Transform temporary chats into contextual information-gathering extensions

-- Add new columns to temporary_chat_links table
ALTER TABLE temporary_chat_links
  -- Link to the original conversation where this link was created
  -- Note: No foreign key constraint as conversation_id is not unique in conversation_sessions
  ADD COLUMN source_conversation_id UUID,
  
  -- Custom intent/purpose for this temporary chat
  ADD COLUMN chat_intent TEXT CHECK (LENGTH(chat_intent) <= 2000),
  
  -- Custom system prompt additions (agent behavior modification)
  ADD COLUMN system_prompt_override TEXT CHECK (LENGTH(system_prompt_override) <= 4000),
  
  -- Automatic first message from agent
  ADD COLUMN initial_agent_message TEXT CHECK (LENGTH(initial_agent_message) <= 2000),
  
  -- Whether to auto-send the first message
  ADD COLUMN send_initial_message BOOLEAN NOT NULL DEFAULT TRUE;

-- Create index for source conversation lookups
CREATE INDEX idx_temp_links_source_conversation 
  ON temporary_chat_links(source_conversation_id) 
  WHERE source_conversation_id IS NOT NULL;

-- Add table comments for documentation
COMMENT ON COLUMN temporary_chat_links.source_conversation_id IS 
  'Original conversation ID where this temporary chat link was created - messages will be linked back to this conversation for context preservation. When set, temporary chat sessions will use this conversation_id instead of creating a new one, allowing the agent in the original conversation to see and reference all messages from the temporary chat.';

COMMENT ON COLUMN temporary_chat_links.chat_intent IS 
  'The purpose/intent of this temporary chat (e.g., "Gather feedback on project X", "Ask about availability for meeting"). This guides agent behavior and provides context. The agent receives this as part of the system instructions to focus the conversation on gathering specific information.';

COMMENT ON COLUMN temporary_chat_links.system_prompt_override IS 
  'Additional system prompt instructions to guide agent behavior specifically for this temporary chat session. Appended to the agent''s base instructions. Use this to adjust tone, focus, or approach (e.g., "Be very encouraging and positive. Focus on solutions rather than problems."). Maximum 4000 characters.';

COMMENT ON COLUMN temporary_chat_links.initial_agent_message IS 
  'First message the agent automatically sends when a user opens the temporary chat link. This should introduce the purpose and ask the first question (e.g., "Hi! Can you share your plans for today?"). Maximum 2000 characters. If null and send_initial_message is true, will use welcome_message as fallback.';

COMMENT ON COLUMN temporary_chat_links.send_initial_message IS 
  'Whether to automatically send the initial_agent_message when a new session is created. Default: true for proactive engagement. Set to false if you want users to initiate the conversation themselves.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Migration: 20250110000001_add_temp_chat_context_fields';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Status: COMPLETED';
  RAISE NOTICE '';
  RAISE NOTICE 'Added columns to temporary_chat_links:';
  RAISE NOTICE '  ✓ source_conversation_id - Links temp chats to original conversation';
  RAISE NOTICE '  ✓ chat_intent - Defines purpose of the temporary chat';
  RAISE NOTICE '  ✓ system_prompt_override - Custom agent behavior';
  RAISE NOTICE '  ✓ initial_agent_message - Auto-sent greeting message';
  RAISE NOTICE '  ✓ send_initial_message - Controls auto-greeting behavior';
  RAISE NOTICE '';
  RAISE NOTICE 'Created indexes:';
  RAISE NOTICE '  ✓ idx_temp_links_source_conversation';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact: Enables contextual temporary chats that preserve conversation';
  RAISE NOTICE 'context and allow agents to gather information that feeds back into';
  RAISE NOTICE 'the original conversation automatically.';
  RAISE NOTICE '=================================================================';
END $$;

