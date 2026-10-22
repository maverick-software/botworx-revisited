CREATE TABLE public.desktop_terminal_runs (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 request_id uuid REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 tool_call_id uuid REFERENCES public.desktop_tool_calls(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (source IN ('user','agent')),
 command text NOT NULL CHECK (length(command) BETWEEN 1 AND 16000),
 cwd text NOT NULL CHECK (length(cwd) BETWEEN 1 AND 4096),
 reference_id uuid NOT NULL,
 relative_path text NOT NULL DEFAULT '',
 timeout_ms integer NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 300000),
 status text NOT NULL CHECK (status IN ('running','completed','failed','cancelled','timed_out','interrupted')),
 stdout text NOT NULL DEFAULT '' CHECK (length(stdout)<=100000),
 stderr text NOT NULL DEFAULT '' CHECK (length(stderr)<=50000),
 exit_code integer,
 truncated boolean NOT NULL DEFAULT false,
 started_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz
);
CREATE INDEX desktop_terminal_owner ON public.desktop_terminal_runs(user_id,started_at DESC);
CREATE INDEX desktop_terminal_conversation ON public.desktop_terminal_runs(conversation_id,started_at);
ALTER TABLE public.desktop_terminal_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_terminal_read ON public.desktop_terminal_runs FOR SELECT TO authenticated
 USING (user_id=auth.uid() AND public.user_has_role(auth.uid(),'admin'));
REVOKE ALL ON public.desktop_terminal_runs FROM anon,authenticated;
GRANT SELECT ON public.desktop_terminal_runs TO authenticated;
GRANT ALL ON public.desktop_terminal_runs TO service_role;

NOTIFY pgrst,'reload schema';
