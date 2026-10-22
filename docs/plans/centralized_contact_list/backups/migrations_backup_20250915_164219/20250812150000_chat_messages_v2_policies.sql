-- Ensure RLS is enabled for v2 chat messages and add permissive policies
-- This aligns client UI with v2-only messaging while keeping service functions working

-- Enable RLS
ALTER TABLE IF EXISTS public.chat_messages_v2 ENABLE ROW LEVEL SECURITY;

-- Select: users can read their own messages or messages from their own agents,
-- or messages targeted at their agents via metadata.target_agent_id
DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages_v2' AND policyname = 'Users can read v2 messages involving them or their agents'
) THEN
CREATE POLICY "Users can read v2 messages involving them or their agents"
ON public.chat_messages_v2
FOR SELECT
USING (
  -- User's own messages
  sender_user_id = auth.uid()
  OR
  -- Messages sent by one of the user's agents
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = public.chat_messages_v2.sender_agent_id
      AND a.user_id = auth.uid()
  )
  OR
  -- Messages whose metadata targets one of the user's agents
  EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = ((public.chat_messages_v2.metadata->>'target_agent_id')::uuid)
      AND a.user_id = auth.uid()
  )
);
END IF;
END $$;

-- Insert: users can create messages only as themselves and only when targeting their own agent
DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages_v2' AND policyname = 'Users can insert v2 messages to their agents'
) THEN
CREATE POLICY "Users can insert v2 messages to their agents"
ON public.chat_messages_v2
FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND (metadata ? 'target_agent_id')
  AND EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = ((public.chat_messages_v2.metadata->>'target_agent_id')::uuid)
      AND a.user_id = auth.uid()
  )
);
END IF;
END $$;

-- Service role: full access for edge functions and background jobs
DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages_v2' AND policyname = 'Service role full access to v2 chat'
) THEN
CREATE POLICY "Service role full access to v2 chat"
ON public.chat_messages_v2
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
END IF;
END $$;


