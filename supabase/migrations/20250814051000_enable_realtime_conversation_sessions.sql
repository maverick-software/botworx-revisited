-- Ensure conversation_sessions emits realtime changes
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_sessions';
EXCEPTION WHEN others THEN NULL; END $$;

-- Optional: safer updates for realtime
DO $$ BEGIN
  EXECUTE 'ALTER TABLE public.conversation_sessions REPLICA IDENTITY FULL';
EXCEPTION WHEN others THEN NULL; END $$;


