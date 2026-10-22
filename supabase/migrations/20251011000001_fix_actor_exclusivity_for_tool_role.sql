-- Fix check_actor_exclusivity constraint to allow 'tool' role messages
-- Tool messages should have the same constraint as system messages (both sender fields NULL)

-- Drop the old constraint
ALTER TABLE chat_messages_v2 DROP CONSTRAINT IF EXISTS check_actor_exclusivity;

-- Add the updated constraint that includes 'tool' role
ALTER TABLE chat_messages_v2 ADD CONSTRAINT check_actor_exclusivity CHECK (
  -- User messages: sender_user_id required, sender_agent_id null
  (sender_user_id IS NOT NULL AND sender_agent_id IS NULL) OR
  -- Assistant messages: sender_agent_id required, sender_user_id null
  (sender_user_id IS NULL AND sender_agent_id IS NOT NULL) OR
  -- System and Tool messages: both null
  (role IN ('system', 'tool') AND sender_user_id IS NULL AND sender_agent_id IS NULL)
);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT check_actor_exclusivity ON chat_messages_v2 IS 
'Ensures message actor exclusivity: user messages have sender_user_id only, assistant messages have sender_agent_id only, system and tool messages have neither';

