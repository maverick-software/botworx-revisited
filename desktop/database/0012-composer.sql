CREATE TABLE public.desktop_goals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
 conversation_id uuid REFERENCES public.conversation_sessions(conversation_id) ON DELETE SET NULL,
 objective text NOT NULL CHECK(length(trim(objective)) BETWEEN 1 AND 8000),
 status text NOT NULL DEFAULT 'ready' CHECK(status IN('ready','running','paused','completed')),
 max_turns integer NOT NULL DEFAULT 3 CHECK(max_turns BETWEEN 1 AND 10),
 turns_used integer NOT NULL DEFAULT 0 CHECK(turns_used>=0),
 note text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.desktop_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_goals_owner ON public.desktop_goals FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_goals TO authenticated;
GRANT ALL ON public.desktop_goals TO service_role;

CREATE FUNCTION public.desktop_begin_chat_with_options(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; previous jsonb;
BEGIN
 result=desktop_begin_chat(p_user,p_request,p_agent,p_conversation,p_text);
 IF (result->>'existing')::boolean THEN
  SELECT metadata->'options' INTO previous FROM chat_messages_v2 WHERE id=(result->>'user_message_id')::uuid;
  IF previous IS DISTINCT FROM p_options THEN RAISE EXCEPTION 'Request identifier already used with different chat settings'; END IF;
  RETURN result;
 END IF;
 UPDATE chat_messages_v2 SET content=content||jsonb_build_object('files',p_files),metadata=metadata||jsonb_build_object('options',p_options,'goal_id',p_options->>'goalId') WHERE id=(result->>'user_message_id')::uuid;
 UPDATE conversation_sessions SET session_state=coalesce(session_state,'{}')||jsonb_build_object('desktop_composer',p_options) WHERE conversation_id=(result->>'conversation_id')::uuid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.desktop_begin_chat_with_options(uuid,uuid,uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_begin_chat_with_options(uuid,uuid,uuid,uuid,text,jsonb,jsonb) TO service_role;
