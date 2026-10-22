ALTER TABLE public.desktop_file_operations ADD COLUMN change_revision bigint;
CREATE TABLE public.desktop_file_events (
 revision bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL REFERENCES public.desktop_file_operations(id) ON DELETE CASCADE,
 phase text NOT NULL CHECK(phase IN('apply','restore')),
 change jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(operation_id,phase)
);
CREATE INDEX desktop_file_event_owner ON public.desktop_file_events(user_id,revision);
ALTER TABLE public.desktop_file_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_file_events_owner ON public.desktop_file_events FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_file_events TO authenticated;
GRANT ALL ON public.desktop_file_events TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.desktop_file_events_revision_seq TO service_role;

CREATE FUNCTION public.desktop_finish_file_operation(p_user uuid,p_id uuid,p_status text,p_preview jsonb,p_result jsonb,p_change jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE operation public.desktop_file_operations; event_revision bigint; operation_phase text;
BEGIN
 IF p_status NOT IN('completed','restored') THEN RAISE EXCEPTION 'Invalid file operation completion'; END IF;
 operation_phase:=CASE WHEN p_status='restored' THEN 'restore' ELSE 'apply' END;
 SELECT * INTO STRICT operation FROM public.desktop_file_operations WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF operation.phase<>operation_phase OR operation.status NOT IN('applying','restoring','interrupted',p_status) THEN RAISE EXCEPTION 'File operation is not in the expected phase'; END IF;
 INSERT INTO public.desktop_file_events(user_id,operation_id,phase,change) VALUES(p_user,p_id,operation_phase,p_change)
 ON CONFLICT(operation_id,phase) DO NOTHING RETURNING revision INTO event_revision;
 IF event_revision IS NULL THEN SELECT revision INTO STRICT event_revision FROM public.desktop_file_events WHERE operation_id=p_id AND phase=operation_phase AND user_id=p_user; END IF;
 UPDATE public.desktop_file_operations SET status=p_status,preview=p_preview,result=p_result,error=NULL,change_revision=event_revision,updated_at=now() WHERE id=p_id AND user_id=p_user;
 IF operation.tool_id IS NOT NULL THEN
  UPDATE public.desktop_tool_calls SET status=CASE WHEN p_status='restored' THEN 'reverted' ELSE 'completed' END,result=p_result,error=NULL,updated_at=now()
  WHERE id=operation.tool_id AND user_id=p_user AND status IN('running','interrupted',CASE WHEN p_status='restored' THEN 'completed' ELSE 'running' END);
 END IF;
 RETURN event_revision;
END $$;
REVOKE ALL ON FUNCTION public.desktop_finish_file_operation(uuid,uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_finish_file_operation(uuid,uuid,text,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
