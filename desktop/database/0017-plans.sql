CREATE FUNCTION public.desktop_valid_plan_steps(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)='array' AND jsonb_array_length(value) BETWEEN 1 AND 20 THEN
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(value) item WHERE jsonb_typeof(item)<>'object'
   OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR (item->>'id') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   OR jsonb_typeof(item->'text') IS DISTINCT FROM 'string' OR length(trim(item->>'text')) NOT BETWEEN 1 AND 1000
   OR jsonb_typeof(item->'status') IS DISTINCT FROM 'string' OR item->>'status' NOT IN('pending','in_progress','completed')
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN('id','text','status')))
  AND (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(value) item)=jsonb_array_length(value)
  AND (SELECT count(*) FROM jsonb_array_elements(value) item WHERE item->>'status'='in_progress')<=1
 ELSE false END
$$;
CREATE TABLE public.desktop_plans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),overview text NOT NULL DEFAULT '' CHECK(length(overview)<=4000),
 steps jsonb NOT NULL CHECK(public.desktop_valid_plan_steps(steps)),revision bigint NOT NULL DEFAULT 1,
 content_revision bigint NOT NULL DEFAULT 1,approved_content_revision bigint,
 updated_by text NOT NULL CHECK(updated_by IN('user','agent')),source_request uuid REFERENCES public.desktop_requests(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.desktop_plan_revisions(
 plan_id uuid NOT NULL REFERENCES public.desktop_plans(id) ON DELETE CASCADE,revision bigint NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(plan_id,revision)
);
ALTER TABLE public.desktop_goals ADD COLUMN plan_id uuid REFERENCES public.desktop_plans(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,ADD COLUMN plan_snapshot jsonb;
CREATE INDEX desktop_goals_plan ON public.desktop_goals(plan_id);
ALTER TABLE public.desktop_plans ENABLE ROW LEVEL SECURITY;ALTER TABLE public.desktop_plan_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_plans_owner ON public.desktop_plans FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY desktop_plan_revisions_owner ON public.desktop_plan_revisions FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_plans,public.desktop_plan_revisions TO authenticated;
GRANT ALL ON public.desktop_plans,public.desktop_plan_revisions TO service_role;
CREATE FUNCTION public.desktop_record_plan_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.revision=OLD.revision THEN RETURN NEW;END IF;
 INSERT INTO desktop_plan_revisions(plan_id,revision,user_id,snapshot) VALUES(NEW.id,NEW.revision,NEW.user_id,to_jsonb(NEW));RETURN NEW;
END $$;
CREATE TRIGGER desktop_plan_revision AFTER INSERT OR UPDATE ON public.desktop_plans FOR EACH ROW EXECUTE FUNCTION public.desktop_record_plan_revision();

CREATE FUNCTION public.desktop_save_plan(p_user uuid,p_conversation uuid,p_title text,p_overview text,p_steps jsonb,p_revision bigint,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE chat conversation_sessions;old desktop_plans;result desktop_plans;
BEGIN
 SELECT * INTO chat FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR chat.agent_id IS NULL THEN RAISE EXCEPTION 'Conversation not found.';END IF;
 IF NOT desktop_valid_plan_steps(p_steps) OR p_title IS NULL OR p_overview IS NULL THEN RAISE EXCEPTION 'Enter a title and 1 to 20 valid plan steps, with at most one in progress.';END IF;
 IF p_request IS NULL THEN
  IF EXISTS(SELECT 1 FROM desktop_requests WHERE conversation_id=p_conversation AND status='running') THEN RAISE EXCEPTION 'Finish or cancel the response before editing its plan.';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM desktop_requests r JOIN chat_messages_v2 m ON m.id=r.user_message_id WHERE r.id=p_request AND r.user_id=p_user AND r.conversation_id=p_conversation AND r.status='running' AND m.metadata->'options'->>'mode'='plan') THEN RAISE EXCEPTION 'Plans can be proposed only by the current Plan mode response.';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_steps) s WHERE s->>'status'<>'pending') THEN RAISE EXCEPTION 'Newly proposed plan steps must be pending.';END IF;
 END IF;
 SELECT * INTO old FROM desktop_plans WHERE conversation_id=p_conversation AND user_id=p_user FOR UPDATE;
 IF FOUND THEN
  IF old.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'The plan changed. Reload it before saving.';END IF;
  IF EXISTS(SELECT 1 FROM desktop_goals WHERE plan_id=old.id AND status='running') THEN RAISE EXCEPTION 'Pause implementation before changing the plan.';END IF;
  UPDATE desktop_plans SET title=trim(p_title),overview=p_overview,steps=p_steps,revision=revision+1,content_revision=content_revision+1,
   approved_content_revision=NULL,updated_by=CASE WHEN p_request IS NULL THEN 'user' ELSE 'agent' END,source_request=p_request,updated_at=now()
   WHERE id=old.id RETURNING * INTO result;
 ELSE
  IF p_revision IS NOT NULL THEN RAISE EXCEPTION 'The plan is unavailable. Reload before saving.';END IF;
  INSERT INTO desktop_plans(user_id,conversation_id,agent_id,title,overview,steps,updated_by,source_request)
   VALUES(p_user,p_conversation,chat.agent_id,trim(p_title),p_overview,p_steps,CASE WHEN p_request IS NULL THEN 'user' ELSE 'agent' END,p_request) RETURNING * INTO result;
 END IF;RETURN to_jsonb(result);
END $$;

CREATE FUNCTION public.desktop_implement_plan(p_user uuid,p_plan uuid,p_revision bigint,p_turns integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE selected desktop_plans;result desktop_goals;chat_id uuid;
BEGIN
 SELECT conversation_id INTO chat_id FROM desktop_plans WHERE id=p_plan AND user_id=p_user;
 PERFORM 1 FROM conversation_sessions WHERE conversation_id=chat_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.';END IF;
 SELECT * INTO selected FROM desktop_plans WHERE id=p_plan AND user_id=p_user FOR UPDATE;
 IF selected.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'The plan changed. Review its latest version before implementing.';END IF;
 IF p_turns IS NULL OR p_turns NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Choose a turn limit between 1 and 10.';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(selected.steps) s WHERE s->>'status'<>'completed') THEN RAISE EXCEPTION 'Every plan step is already marked complete.';END IF;
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE user_id=p_user AND status='running') OR EXISTS(SELECT 1 FROM desktop_goals WHERE user_id=p_user AND status='running') THEN RAISE EXCEPTION 'Finish or pause the current work before implementing a plan.';END IF;
 UPDATE desktop_plans SET approved_content_revision=content_revision,revision=revision+1,updated_by='user',source_request=NULL,updated_at=now() WHERE id=p_plan RETURNING * INTO selected;
 INSERT INTO desktop_goals(user_id,agent_id,conversation_id,project_id,objective,max_turns,plan_id,plan_snapshot)
  SELECT p_user,selected.agent_id,selected.conversation_id,(SELECT project_id FROM desktop_project_chats WHERE conversation_id=selected.conversation_id AND user_id=p_user),
   'Implement the approved plan: '||selected.title,p_turns,selected.id,to_jsonb(selected) RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;

CREATE FUNCTION public.desktop_advance_plan(p_user uuid,p_plan uuid,p_revision bigint,p_updates jsonb,p_request uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE selected desktop_plans;updated jsonb;chat_id uuid;
BEGIN
 SELECT conversation_id INTO chat_id FROM desktop_plans WHERE id=p_plan AND user_id=p_user;
 PERFORM 1 FROM conversation_sessions WHERE conversation_id=chat_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found.';END IF;
 SELECT * INTO selected FROM desktop_plans WHERE id=p_plan AND user_id=p_user FOR UPDATE;
 IF selected.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'The plan changed. Read the latest plan before updating progress.';END IF;
 IF p_request IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM desktop_requests r JOIN chat_messages_v2 m ON m.id=r.user_message_id JOIN desktop_goals g ON g.id=(m.metadata->>'goal_id')::uuid
   WHERE r.id=p_request AND r.user_id=p_user AND r.conversation_id=chat_id AND r.status='running' AND m.metadata->'options'->>'mode'='chat'
   AND g.status='running' AND g.user_id=p_user AND g.plan_id=p_plan AND (g.plan_snapshot->>'content_revision')::bigint=selected.content_revision AND selected.approved_content_revision=selected.content_revision)
   THEN RAISE EXCEPTION 'Start or resume the approved plan implementation before reporting progress.';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM desktop_requests WHERE conversation_id=chat_id AND status='running') OR EXISTS(SELECT 1 FROM desktop_goals WHERE plan_id=p_plan AND status='running') THEN RAISE EXCEPTION 'Finish or pause the current work before editing progress.';END IF;
 END IF;
 IF jsonb_typeof(p_updates) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Supply a list of step progress updates.';END IF;
 IF jsonb_array_length(p_updates) NOT BETWEEN 1 AND 20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_updates) u WHERE jsonb_typeof(u)<>'object' OR u->>'status' NOT IN('pending','in_progress','completed') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(selected.steps) s WHERE s->>'id'=u->>'step_id') OR EXISTS(SELECT 1 FROM jsonb_object_keys(u) k WHERE k NOT IN('step_id','status')))
  OR (SELECT count(DISTINCT u->>'step_id') FROM jsonb_array_elements(p_updates) u)<>jsonb_array_length(p_updates) THEN RAISE EXCEPTION 'Update each known step at most once with a valid status.';END IF;
 SELECT jsonb_agg(s||coalesce((SELECT jsonb_build_object('status',u->>'status') FROM jsonb_array_elements(p_updates) u WHERE u->>'step_id'=s->>'id'),'{}'::jsonb) ORDER BY n)
 INTO updated FROM jsonb_array_elements(selected.steps) WITH ORDINALITY AS current(s,n);
 IF NOT desktop_valid_plan_steps(updated) THEN RAISE EXCEPTION 'Keep at most one step in progress.';END IF;
 UPDATE desktop_plans SET steps=updated,revision=revision+1,updated_by=CASE WHEN p_request IS NULL THEN 'user' ELSE 'agent' END,source_request=p_request,updated_at=now() WHERE id=p_plan RETURNING * INTO selected;
 RETURN to_jsonb(selected);
END $$;

CREATE FUNCTION public.desktop_begin_plan_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb,p_project uuid,p_revision bigint,p_plan uuid,p_plan_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE selected desktop_plans;result jsonb;previous jsonb;linked desktop_goals;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE id=p_request) THEN
  result=desktop_begin_project_chat(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files,p_project,p_revision);
  SELECT metadata->'plan' INTO previous FROM chat_messages_v2 WHERE id=(result->>'user_message_id')::uuid;
  RETURN result||jsonb_build_object('plan',previous);
 END IF;
 IF p_conversation IS NOT NULL THEN
  PERFORM 1 FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user AND agent_id=p_agent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found.';END IF;
  SELECT * INTO selected FROM desktop_plans WHERE conversation_id=p_conversation AND user_id=p_user FOR SHARE;
 END IF;
 IF selected.id IS DISTINCT FROM p_plan OR selected.revision IS DISTINCT FROM p_plan_revision THEN RAISE EXCEPTION 'The plan changed while preparing the response. Review it and send again.';END IF;
 IF p_options->>'goalId' IS NOT NULL THEN
  SELECT * INTO linked FROM desktop_goals WHERE id=(p_options->>'goalId')::uuid AND user_id=p_user FOR SHARE;
  IF linked.plan_id IS NOT NULL AND (linked.plan_id IS DISTINCT FROM selected.id OR (linked.plan_snapshot->>'content_revision')::bigint IS DISTINCT FROM selected.content_revision OR selected.approved_content_revision IS DISTINCT FROM selected.content_revision OR linked.status<>'running' OR p_options->>'mode'<>'chat') THEN RAISE EXCEPTION 'The approved plan changed or implementation stopped. Review the plan before continuing.';END IF;
 END IF;
 result=desktop_begin_project_chat(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files,p_project,p_revision);
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('plan',CASE WHEN selected.id IS NULL THEN NULL ELSE to_jsonb(selected) END) WHERE id=(result->>'user_message_id')::uuid;
 RETURN result||jsonb_build_object('plan',CASE WHEN selected.id IS NULL THEN NULL ELSE to_jsonb(selected) END);
END $$;
REVOKE ALL ON FUNCTION public.desktop_valid_plan_steps(jsonb),public.desktop_record_plan_revision(),public.desktop_save_plan(uuid,uuid,text,text,jsonb,bigint,uuid),public.desktop_implement_plan(uuid,uuid,bigint,integer),public.desktop_advance_plan(uuid,uuid,bigint,jsonb,uuid),public.desktop_begin_plan_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_valid_plan_steps(jsonb),public.desktop_save_plan(uuid,uuid,text,text,jsonb,bigint,uuid),public.desktop_implement_plan(uuid,uuid,bigint,integer),public.desktop_advance_plan(uuid,uuid,bigint,jsonb,uuid),public.desktop_begin_plan_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
