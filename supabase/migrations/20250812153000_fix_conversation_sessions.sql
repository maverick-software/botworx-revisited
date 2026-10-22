-- Ensure conversation_sessions exists and triggers are safe

-- Create table if missing
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  agent_id UUID REFERENCES public.agents(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_active TIMESTAMPTZ DEFAULT now(),
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  tool_calls_count INTEGER DEFAULT 0,
  session_state JSONB DEFAULT '{}',
  interruption_context JSONB,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','paused','completed','abandoned')),
  CONSTRAINT check_session_actors CHECK (user_id IS NOT NULL OR agent_id IS NOT NULL)
);

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_sessions_conversation ON public.conversation_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.conversation_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON public.conversation_sessions(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.conversation_sessions(status) WHERE status IN ('active','paused');

-- Enable RLS
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Basic policies
DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversation_sessions' AND policyname='Users can view their own sessions'
) THEN
  CREATE POLICY "Users can view their own sessions" ON public.conversation_sessions
  FOR SELECT USING (auth.uid() = user_id);
END IF;
END $$;

-- Make update_session_last_active robust when table is missing
CREATE OR REPLACE FUNCTION public.update_session_last_active()
RETURNS TRIGGER AS $$
BEGIN
  IF to_regclass('public.conversation_sessions') IS NOT NULL THEN
    UPDATE public.conversation_sessions 
      SET last_active = NOW(),
          message_count = message_count + 1
    WHERE id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


