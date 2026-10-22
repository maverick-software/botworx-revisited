-- Ensure RLS policies allow selecting minimal fields for conversation preview
DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.chat_messages_v2 ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN NULL; END $$;

-- Select messages where the user is the sender or owns the agent sender
CREATE POLICY chat_messages_v2_select_owned
  ON public.chat_messages_v2
  FOR SELECT
  TO authenticated
  USING (
    sender_user_id = auth.uid() OR
    (
      sender_agent_id IS NOT NULL AND EXISTS(
        SELECT 1 FROM public.agents a WHERE a.id = chat_messages_v2.sender_agent_id AND a.user_id = auth.uid()
      )
    )
  );


