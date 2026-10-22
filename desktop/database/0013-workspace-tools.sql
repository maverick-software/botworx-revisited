CREATE TABLE public.desktop_tool_calls(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 assistant_message_id uuid NOT NULL REFERENCES public.chat_messages_v2(id) ON DELETE CASCADE,
 name text NOT NULL,label text NOT NULL,
 status text NOT NULL CHECK(status IN('running','awaiting_approval','completed','denied','failed','interrupted','reverted')),
 arguments jsonb NOT NULL DEFAULT '{}',result jsonb,preview jsonb,error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX desktop_tools_conversation ON public.desktop_tool_calls(conversation_id,created_at);
ALTER TABLE public.desktop_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_tools_owner ON public.desktop_tool_calls FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_tool_calls TO authenticated;
GRANT ALL ON public.desktop_tool_calls TO service_role;
NOTIFY pgrst,'reload schema';
