-- Allow users to update/archive conversation sessions for agents they own,
-- even if the session's user_id is null or different (e.g., system-created sessions)

CREATE POLICY conversation_sessions_update_agent_owner
  ON public.conversation_sessions
  FOR UPDATE
  TO authenticated
  USING (
    agent_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = conversation_sessions.agent_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    agent_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.agents a
      WHERE a.id = conversation_sessions.agent_id AND a.user_id = auth.uid()
    )
  );


