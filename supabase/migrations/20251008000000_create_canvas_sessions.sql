-- Create canvas_sessions table for draft auto-save functionality
CREATE TABLE IF NOT EXISTS public.canvas_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  artifact_id UUID NOT NULL,
  conversation_session_id UUID NULL,
  content TEXT NOT NULL,
  metadata JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT canvas_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT canvas_sessions_user_id_artifact_id_conversation_session_id_key UNIQUE (user_id, artifact_id, conversation_session_id),
  CONSTRAINT canvas_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE,
  CONSTRAINT canvas_sessions_artifact_id_fkey FOREIGN KEY (artifact_id) REFERENCES artifacts (id) ON DELETE CASCADE,
  CONSTRAINT canvas_sessions_conversation_session_id_fkey FOREIGN KEY (conversation_session_id) REFERENCES conversation_sessions (id) ON DELETE CASCADE,
  CONSTRAINT canvas_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_canvas_sessions_user_id ON public.canvas_sessions USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_canvas_sessions_artifact_id ON public.canvas_sessions USING btree (artifact_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_canvas_sessions_conversation_session_id ON public.canvas_sessions USING btree (conversation_session_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_canvas_sessions_last_accessed ON public.canvas_sessions USING btree (last_accessed_at DESC) TABLESPACE pg_default;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_canvas_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_accessed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS canvas_sessions_updated_at_trigger ON public.canvas_sessions;
CREATE TRIGGER canvas_sessions_updated_at_trigger
  BEFORE UPDATE ON public.canvas_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_sessions_updated_at();

-- Enable RLS
ALTER TABLE public.canvas_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own canvas sessions
CREATE POLICY "Users can view their own canvas sessions"
  ON public.canvas_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own canvas sessions
CREATE POLICY "Users can create their own canvas sessions"
  ON public.canvas_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own canvas sessions
CREATE POLICY "Users can update their own canvas sessions"
  ON public.canvas_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own canvas sessions
CREATE POLICY "Users can delete their own canvas sessions"
  ON public.canvas_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comment on table
COMMENT ON TABLE public.canvas_sessions IS 'Stores work-in-progress canvas editing sessions with auto-save functionality';
