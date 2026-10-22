CREATE TABLE public.desktop_terminal_sessions (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 source text NOT NULL CHECK(source IN ('user','agent')),
 cwd text NOT NULL CHECK(length(cwd) BETWEEN 1 AND 4096),
 reference_id uuid NOT NULL,
 relative_path text NOT NULL DEFAULT '',
 status text NOT NULL CHECK(status IN ('running','completed','failed','cancelled','interrupted')),
 output text NOT NULL DEFAULT '' CHECK(length(output)<=200000),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 exit_code integer,
 truncated boolean NOT NULL DEFAULT false,
 started_at timestamptz NOT NULL DEFAULT now(),
 ended_at timestamptz
);
CREATE INDEX desktop_terminal_sessions_owner ON public.desktop_terminal_sessions(user_id,started_at DESC);
ALTER TABLE public.desktop_terminal_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_terminal_sessions_read ON public.desktop_terminal_sessions FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id WHERE ur.user_id=auth.uid() AND r.name='admin'));
REVOKE ALL ON public.desktop_terminal_sessions FROM anon,authenticated;
GRANT SELECT ON public.desktop_terminal_sessions TO authenticated;
GRANT ALL ON public.desktop_terminal_sessions TO service_role;
CREATE UNIQUE INDEX desktop_terminal_mutation_call ON public.desktop_tool_calls(request_id,(arguments->>'provider_call_id'))
 WHERE name IN ('start_terminal','write_terminal','stop_terminal') AND arguments ? 'provider_call_id';
NOTIFY pgrst,'reload schema';
