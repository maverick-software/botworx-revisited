-- Paid image operations are claimed with their tool activity in one transaction.
-- A restarted/duplicate caller can inspect a receipt but cannot dispatch it again.
CREATE TABLE public.desktop_image_generations (
 id uuid PRIMARY KEY REFERENCES public.desktop_tool_calls(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
 native_thread_id text NOT NULL DEFAULT '',
 provider_call_id text NOT NULL CHECK(length(provider_call_id) BETWEEN 1 AND 256),
 arguments_hash text NOT NULL CHECK(arguments_hash ~ '^[a-f0-9]{64}$'),
 connection jsonb NOT NULL CHECK(jsonb_typeof(connection)='object'),
 status text NOT NULL CHECK(status IN ('prepared','dispatched','completed','rejected','uncertain','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,request_id,native_thread_id,provider_call_id)
);
ALTER TABLE public.desktop_image_generations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_image_generations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.desktop_image_generations TO service_role;

CREATE FUNCTION public.desktop_claim_image_generation(p_user uuid,p_request uuid,p_agent uuid,p_thread text,p_call text,p_hash text,p_arguments jsonb,p_connection jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE prior desktop_image_generations; req desktop_requests; operation uuid:=gen_random_uuid(); activity desktop_tool_calls;
BEGIN
 IF p_call IS NULL OR length(p_call) NOT BETWEEN 1 AND 256 OR p_hash !~ '^[a-f0-9]{64}$'
 OR jsonb_typeof(p_arguments)<>'object' OR jsonb_typeof(p_connection)<>'object'
 OR length(coalesce(p_thread,''))>100 THEN RAISE EXCEPTION 'Invalid image operation identity.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('image:'||p_user::text||':'||p_request::text,0));
 SELECT * INTO req FROM desktop_requests WHERE id=p_request AND user_id=p_user;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM conversation_sessions WHERE conversation_id=req.conversation_id AND user_id=p_user)
 OR NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active) THEN RAISE EXCEPTION 'Image request ownership is unavailable.'; END IF;
 SELECT * INTO prior FROM desktop_image_generations WHERE user_id=p_user AND request_id=p_request AND native_thread_id=coalesce(p_thread,'') AND provider_call_id=p_call;
 IF FOUND THEN
  IF prior.arguments_hash<>p_hash THEN RAISE EXCEPTION 'This image call identifier already belongs to different arguments.'; END IF;
  SELECT * INTO activity FROM desktop_tool_calls WHERE id=prior.id AND user_id=p_user;
  RETURN jsonb_build_object('created',false,'operation',to_jsonb(prior),'activity',to_jsonb(activity));
 END IF;
 IF EXISTS(SELECT 1 FROM desktop_image_generations WHERE user_id=p_user AND request_id=p_request AND
 (status IN ('dispatched','uncertain') OR arguments_hash=p_hash AND status<>'rejected')) THEN
  RAISE EXCEPTION 'An image operation already exists or has an uncertain result. Inspect its saved activity; do not automatically repeat it.';
 END IF;
 INSERT INTO desktop_tool_calls(id,user_id,request_id,conversation_id,assistant_message_id,native_thread_id,name,label,status,arguments)
 VALUES(operation,p_user,p_request,req.conversation_id,req.assistant_message_id,nullif(p_thread,''),'generate_image','Create image','running',p_arguments||jsonb_build_object('provider_call_id',p_call)) RETURNING * INTO activity;
 INSERT INTO desktop_image_generations(id,user_id,request_id,conversation_id,agent_id,native_thread_id,provider_call_id,arguments_hash,connection,status)
 VALUES(operation,p_user,p_request,req.conversation_id,p_agent,coalesce(p_thread,''),p_call,p_hash,p_connection,'prepared') RETURNING * INTO prior;
 RETURN jsonb_build_object('created',true,'operation',to_jsonb(prior),'activity',to_jsonb(activity));
END $$;

CREATE FUNCTION public.desktop_transition_image_generation(p_user uuid,p_id uuid,p_expected text,p_status text,p_result jsonb DEFAULT NULL,p_error text DEFAULT NULL,p_approval jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $$
DECLARE operation desktop_image_generations; activity desktop_tool_calls;
BEGIN
 SELECT * INTO operation FROM desktop_image_generations WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR operation.status<>p_expected THEN RAISE EXCEPTION 'The image operation state changed. Inspect its saved receipt.'; END IF;
 IF NOT (p_expected='prepared' AND p_status IN ('prepared','dispatched','declined','rejected','uncertain') OR p_expected='dispatched' AND p_status IN ('completed','rejected','uncertain') OR p_expected='uncertain' AND p_status='completed') THEN RAISE EXCEPTION 'Invalid image operation transition.'; END IF;
 UPDATE desktop_image_generations SET status=p_status,updated_at=now() WHERE id=p_id;
 UPDATE desktop_tool_calls SET status=CASE p_status WHEN 'prepared' THEN 'awaiting_approval' WHEN 'dispatched' THEN 'running' WHEN 'completed' THEN 'completed' WHEN 'declined' THEN 'denied' WHEN 'uncertain' THEN 'interrupted' ELSE 'failed' END,
 result=p_result,error=p_error,approval=coalesce(p_approval,approval),updated_at=now() WHERE id=p_id AND user_id=p_user RETURNING * INTO activity;
 RETURN to_jsonb(activity);
END $$;
REVOKE ALL ON FUNCTION public.desktop_claim_image_generation(uuid,uuid,uuid,text,text,text,jsonb,jsonb),public.desktop_transition_image_generation(uuid,uuid,text,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_claim_image_generation(uuid,uuid,uuid,text,text,text,jsonb,jsonb),public.desktop_transition_image_generation(uuid,uuid,text,text,jsonb,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
