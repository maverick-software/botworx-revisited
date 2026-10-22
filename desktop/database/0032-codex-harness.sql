-- Codex retains its native runtime state; PostgreSQL remains the application store.
CREATE TABLE public.desktop_codex_threads (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 scope text NOT NULL, provider text NOT NULL CHECK(provider IN ('openai-oauth','openrouter')),
 thread_id text NOT NULL, runtime_version text NOT NULL,
 imported_history boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conversation_id,scope), UNIQUE(user_id,thread_id)
);
CREATE TABLE public.desktop_codex_turns (
 request_id uuid PRIMARY KEY REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 thread_id text, turn_id text, runtime_version text NOT NULL,
 state jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.desktop_codex_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_codex_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_codex_threads_owner ON public.desktop_codex_threads FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY desktop_codex_turns_owner ON public.desktop_codex_turns FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.desktop_codex_threads,public.desktop_codex_turns FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.desktop_codex_threads,public.desktop_codex_turns TO authenticated;
GRANT ALL ON public.desktop_codex_threads,public.desktop_codex_turns TO service_role;
NOTIFY pgrst,'reload schema';
