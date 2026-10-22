-- Preserve the layered project/plan/options checks; remove only the original
-- single-agent conversation restriction in their audited function bodies.
DO $$ DECLARE signature text;definition text;needle text:='AND agent_id=p_agent FOR UPDATE;'; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'desktop_begin_chat(uuid,uuid,uuid,uuid,text)',
  'desktop_begin_project_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint)',
  'desktop_begin_plan_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint)'] LOOP
  definition=pg_get_functiondef(('public.'||signature)::regprocedure);
  IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized conversation function: %',signature; END IF;
  definition=replace(definition,needle,'FOR UPDATE;');
  IF signature='desktop_begin_chat(uuid,uuid,uuid,uuid,text)' THEN
   needle='INSERT INTO chat_messages_v2(id,conversation_id,session_id,sender_user_id,role,content,metadata)';
   IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized message insertion boundary'; END IF;
   definition=replace(definition,needle,$body$
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE conversation_id=c.conversation_id AND status='running') THEN
  RAISE EXCEPTION 'This conversation already has an active response. Steer it or wait before switching agents';
 END IF;
 INSERT INTO desktop_agent_participants(user_id,conversation_id,agent_id) VALUES(p_user,c.conversation_id,p_agent) ON CONFLICT DO NOTHING;
 UPDATE conversation_sessions SET session_state=coalesce(session_state,'{}')||jsonb_build_object('desktop_active_agent',p_agent) WHERE id=c.id;
 INSERT INTO chat_messages_v2(id,conversation_id,session_id,sender_user_id,role,content,metadata)$body$);
   needle='AND agent_id=p_agent FOR UPDATE;';
  END IF;
  EXECUTE definition;
 END LOOP;
END $$;

INSERT INTO public.desktop_agent_participants(user_id,conversation_id,agent_id)
 SELECT c.user_id,c.conversation_id,c.agent_id FROM public.conversation_sessions c JOIN public.agents a ON a.id=c.agent_id AND a.user_id=c.user_id
 ON CONFLICT DO NOTHING;

CREATE FUNCTION public.desktop_begin_agent_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text,p_options jsonb,p_files jsonb,p_project uuid,p_revision bigint,p_plan uuid,p_plan_revision bigint,p_agent_revision bigint,p_parent uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE profile jsonb;result jsonb;instance desktop_agent_instances;parent desktop_agent_instances;attribution jsonb;prior jsonb;parent_profile jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE id=p_request) THEN
  result=desktop_begin_memory_chat(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files,p_project,p_revision,p_plan,p_plan_revision);
  SELECT metadata->'agent' INTO prior FROM chat_messages_v2 WHERE id=(result->>'user_message_id')::uuid;
  IF (prior->>'revision')::bigint IS DISTINCT FROM p_agent_revision THEN RAISE EXCEPTION 'Request identifier already used for another agent revision'; END IF;
  RETURN result||jsonb_build_object('agent',prior,'agent_instance_id',prior->>'instanceId');
 END IF;
 profile=desktop_agent_profile(p_user,p_agent);
 IF (profile->>'revision')::bigint IS DISTINCT FROM p_agent_revision THEN RAISE EXCEPTION 'Agent definition changed. Review it before sending'; END IF;
 IF p_parent IS NOT NULL THEN
  SELECT * INTO parent FROM desktop_agent_instances WHERE id=p_parent AND user_id=p_user FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The requesting instance is unavailable'; END IF;
  parent_profile=desktop_agent_profile(p_user,parent.agent_id);
  IF (parent_profile->>'revision')::bigint<>parent.agent_revision OR parent_profile->'definition'->>'active'<>'true' THEN RAISE EXCEPTION 'The requesting agent changed or was retired'; END IF;
  IF parent_profile->'policy'->>'delegation'<>'true' OR parent.depth+1>least((profile->'policy'->>'maxDepth')::integer,(parent_profile->'policy'->>'maxDepth')::integer) THEN RAISE EXCEPTION 'Delegation depth or policy does not permit this assignment'; END IF;
  IF jsonb_typeof(parent_profile->'policy'->'delegateAgents')='array' AND NOT (parent_profile->'policy'->'delegateAgents' ? p_agent::text) THEN RAISE EXCEPTION 'This specialist is outside the delegation list'; END IF;
  IF EXISTS(WITH RECURSIVE chain AS(SELECT id,agent_id,parent_instance_id FROM desktop_agent_instances WHERE id=p_parent AND user_id=p_user UNION ALL SELECT i.id,i.agent_id,i.parent_instance_id FROM desktop_agent_instances i JOIN chain c ON i.id=c.parent_instance_id WHERE i.user_id=p_user) SELECT 1 FROM chain WHERE agent_id=p_agent) THEN RAISE EXCEPTION 'This delegation would create an agent cycle'; END IF;
 END IF;
 result=desktop_begin_memory_chat(p_user,p_request,p_agent,p_conversation,p_text,p_options,p_files,p_project,p_revision,p_plan,p_plan_revision);
 SELECT * INTO instance FROM desktop_agent_instances WHERE user_id=p_user AND agent_id=p_agent AND conversation_id=(result->>'conversation_id')::uuid
  AND project_id IS NOT DISTINCT FROM p_project AND parent_instance_id IS NOT DISTINCT FROM p_parent ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO desktop_agent_instances(user_id,agent_id,agent_revision,conversation_id,project_id,parent_instance_id,depth,assignment,status,request_id)
   VALUES(p_user,p_agent,p_agent_revision,(result->>'conversation_id')::uuid,p_project,p_parent,coalesce(parent.depth+1,0),left(p_text,8000),'running',p_request) RETURNING * INTO instance;
 ELSE
  UPDATE desktop_agent_instances SET agent_revision=p_agent_revision,status='running',request_id=p_request,updated_at=now() WHERE id=instance.id AND user_id=p_user RETURNING * INTO instance;
 END IF;
 attribution=jsonb_build_object('id',p_agent,'name',profile->'definition'->>'name','handle',profile->>'handle','role',profile->>'role','revision',p_agent_revision,'instanceId',instance.id);
 UPDATE desktop_requests SET agent_instance_id=instance.id WHERE id=p_request AND user_id=p_user;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('agent',attribution) WHERE id IN((result->>'user_message_id')::uuid,(result->>'assistant_message_id')::uuid);
 RETURN result||jsonb_build_object('agent',attribution,'agent_instance_id',instance.id);
END $$;
REVOKE ALL ON FUNCTION public.desktop_begin_agent_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_begin_agent_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint,bigint,uuid) TO service_role;

CREATE FUNCTION public.desktop_track_agent_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.agent_instance_id IS NOT NULL THEN
  UPDATE desktop_agent_instances SET status=NEW.status,updated_at=now(),checkpoint=CASE WHEN NEW.status='running' THEN checkpoint ELSE left(coalesce((SELECT content->>'text' FROM chat_messages_v2 WHERE id=NEW.assistant_message_id),NEW.error,''),8000) END
   WHERE id=NEW.agent_instance_id AND user_id=NEW.user_id AND request_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_track_agent_request AFTER UPDATE OF status ON public.desktop_requests FOR EACH ROW EXECUTE FUNCTION public.desktop_track_agent_request();
REVOKE ALL ON FUNCTION public.desktop_track_agent_request() FROM PUBLIC,anon,authenticated;

-- Ordinary removal is retirement. Prevent direct deletion from erasing a chat
-- with multiple agent participants while allowing account-wide deletion cleanup.
CREATE FUNCTION public.desktop_protect_shared_agent_history() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=OLD.user_id) AND EXISTS(
  SELECT 1 FROM desktop_agent_participants own JOIN desktop_agent_participants other ON other.conversation_id=own.conversation_id AND other.agent_id<>own.agent_id
  WHERE own.agent_id=OLD.id AND own.user_id=OLD.user_id) THEN RAISE EXCEPTION 'Retire this agent to preserve shared conversation history'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER desktop_protect_shared_agent_history BEFORE DELETE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.desktop_protect_shared_agent_history();
REVOKE ALL ON FUNCTION public.desktop_protect_shared_agent_history() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
