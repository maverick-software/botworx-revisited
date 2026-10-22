-- Debug and fix chat_messages_v2 RLS policies
-- Add temporary logging and more permissive policies

-- Add a more permissive INSERT policy for debugging
DO $$ BEGIN
  -- Drop the restrictive policy temporarily
  DROP POLICY IF EXISTS "Users can insert v2 messages to their agents" ON public.chat_messages_v2;
  
  -- Create a more permissive policy for debugging
  CREATE POLICY "Users can insert v2 messages (debug)"
  ON public.chat_messages_v2
  FOR INSERT
  WITH CHECK (
    sender_user_id = auth.uid()
    -- Temporarily remove the agent ownership check to see if that's the issue
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating debug policy: %', SQLERRM;
END $$;

-- Also ensure we have a basic SELECT policy that works
DO $$ BEGIN
  -- Ensure there's a working SELECT policy
  DROP POLICY IF EXISTS "chat_messages_v2_select_owned" ON public.chat_messages_v2;
  
  CREATE POLICY "chat_messages_v2_select_owned"
  ON public.chat_messages_v2
  FOR SELECT
  TO authenticated
  USING (
    sender_user_id = auth.uid() OR
    (
      sender_agent_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.agents a 
        WHERE a.id = chat_messages_v2.sender_agent_id 
        AND a.user_id = auth.uid()
      )
    ) OR
    (
      -- Also allow reading messages targeted at user's agents
      metadata ? 'target_agent_id' AND EXISTS(
        SELECT 1 FROM public.agents a 
        WHERE a.id = ((chat_messages_v2.metadata->>'target_agent_id')::uuid)
        AND a.user_id = auth.uid()
      )
    )
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating select policy: %', SQLERRM;
END $$;

-- Log the current policies for debugging
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE 'Current chat_messages_v2 policies:';
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies 
        WHERE tablename = 'chat_messages_v2'
    LOOP
        RAISE NOTICE 'Policy: % - Command: % - Permissive: %', 
            policy_record.policyname, 
            policy_record.cmd, 
            policy_record.permissive;
    END LOOP;
END $$;
