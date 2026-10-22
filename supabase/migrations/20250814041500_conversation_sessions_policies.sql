-- Enable RLS and add policies for conversation_sessions
DO $$ BEGIN
  -- Enable RLS (safe if already enabled)
  EXECUTE 'ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN others THEN NULL; END $$;

-- Allow users to select their own sessions or sessions for their agents
CREATE POLICY conversation_sessions_select_user
  ON public.conversation_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      agent_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.agents a
        WHERE a.id = conversation_sessions.agent_id AND a.user_id = auth.uid()
      )
    )
  );

-- Allow users to insert sessions for themselves
CREATE POLICY conversation_sessions_insert_user
  ON public.conversation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow users to update their own sessions
CREATE POLICY conversation_sessions_update_user
  ON public.conversation_sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Note: service_role bypasses RLS by default via postgres role privileges


