ALTER TABLE public.desktop_agent_instances ADD COLUMN policy_ceiling jsonb,ADD COLUMN authority_chain jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.desktop_agent_invocations
 ADD COLUMN origin_request_id uuid REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 ADD COLUMN caller_revision bigint,ADD COLUMN target_revision bigint,
 ADD COLUMN status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','starting','running','completed','failed','cancelled','interrupted')),
 ADD COLUMN error text,ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX desktop_agent_invocations_pending ON public.desktop_agent_invocations(user_id,status,created_at);

CREATE FUNCTION public.desktop_intersect_agent_policy(target jsonb,caller jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE tools jsonb:='[]';delegates jsonb:='[]';a text;b text;candidate text;
BEGIN
 IF target->'tools'='null'::jsonb THEN tools=caller->'tools'; ELSIF caller->'tools'='null'::jsonb THEN tools=target->'tools'; ELSE
  FOR a IN SELECT jsonb_array_elements_text(target->'tools') LOOP
   FOR b IN SELECT jsonb_array_elements_text(caller->'tools') LOOP
    candidate=CASE WHEN a=b THEN a WHEN strpos(a,'.')=0 AND right(b,length(a)+1)='.'||a THEN b WHEN strpos(b,'.')=0 AND right(a,length(b)+1)='.'||b THEN a ELSE NULL END;
    IF candidate IS NOT NULL AND NOT tools ? candidate THEN tools=tools||jsonb_build_array(candidate); END IF;
   END LOOP;
  END LOOP;
 END IF;
 IF target->'delegateAgents'='null'::jsonb THEN delegates=caller->'delegateAgents'; ELSIF caller->'delegateAgents'='null'::jsonb THEN delegates=target->'delegateAgents'; ELSE
  FOR a IN SELECT jsonb_array_elements_text(target->'delegateAgents') LOOP IF caller->'delegateAgents' ? a THEN delegates=delegates||jsonb_build_array(a); END IF;END LOOP;
 END IF;
 RETURN jsonb_build_object('tools',tools,'delegateAgents',delegates,'delegation',(target->>'delegation')::boolean AND (caller->>'delegation')::boolean,
  'memory',(target->>'memory')::boolean AND (caller->>'memory')::boolean,'memoryWrite',(target->>'memoryWrite')::boolean AND (caller->>'memoryWrite')::boolean,
  'maxDepth',least((target->>'maxDepth')::integer,(caller->>'maxDepth')::integer),'maxTurns',least((target->>'maxTurns')::integer,(caller->>'maxTurns')::integer));
END $$;

CREATE FUNCTION public.desktop_reserve_agent_invocation(p_user uuid,p_request uuid,p_thread text,p_call text,p_target uuid,p_assignment text,p_options jsonb,p_ceiling jsonb,p_target_revision bigint,p_child_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE context jsonb;caller desktop_agent_instances;target jsonb;previous desktop_agent_invocations;created desktop_agent_invocations;child desktop_agent_instances;chat_id uuid;payload jsonb;grant_chain jsonb;source_options jsonb;source_project jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('agent-invoke:'||p_user::text,0));
 context=desktop_agent_request_scope(p_user,p_request,p_thread);
 SELECT * INTO caller FROM desktop_agent_instances WHERE id=(context->'instance'->>'id')::uuid AND user_id=p_user FOR UPDATE;
 IF p_call IS NULL OR length(p_call) NOT BETWEEN 1 AND 300 OR p_assignment IS NULL OR length(trim(p_assignment)) NOT BETWEEN 1 AND 8000 OR jsonb_typeof(p_options)<>'object' OR jsonb_typeof(p_ceiling)<>'object' THEN RAISE EXCEPTION 'Invalid named-agent assignment'; END IF;
 payload=jsonb_build_object('assignment',p_assignment,'options',p_options,'ceiling',p_ceiling,'origin_request_id',p_request);
 SELECT * INTO previous FROM desktop_agent_invocations WHERE caller_instance_id=caller.id AND call_id=p_call AND user_id=p_user;
 IF FOUND THEN
  IF previous.target_agent_id<>p_target OR previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'This invocation identifier was already used for another assignment'; END IF;
  RETURN to_jsonb(previous)||jsonb_build_object('existing',true);
 END IF;
 target=desktop_agent_profile(p_user,p_target);
 IF target->'definition'->>'active'<>'true' OR (target->>'revision')::bigint IS DISTINCT FROM p_target_revision THEN RAISE EXCEPTION 'The target agent changed or is unavailable'; END IF;
 IF p_ceiling IS DISTINCT FROM desktop_intersect_agent_policy(target->'policy',context->'profile'->'policy') THEN RAISE EXCEPTION 'This delegated policy exceeds or differs from its current authority ceiling'; END IF;
 SELECT metadata->'options',metadata->'project' INTO source_options,source_project FROM chat_messages_v2 WHERE id=(SELECT user_message_id FROM desktop_requests WHERE id=p_request AND user_id=p_user);
 IF source_options->>'mode'<>'chat' OR p_options->>'mode'<>'chat' OR p_options->>'goalId' IS NOT NULL THEN RAISE EXCEPTION 'This task mode cannot start delegated work'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['permission','provider','model','thinking','tools','windows','skills','harness']) AS field(name) WHERE p_options->field.name IS DISTINCT FROM source_options->field.name)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p_options->'files','[]')) file WHERE NOT((coalesce(source_options->'files','[]')||coalesce(source_project->'file_ids','[]')) ? file)) THEN
  RAISE EXCEPTION 'A delegation cannot broaden its originating model, tools, windows or workspace permissions';
 END IF;
 IF context->'profile'->'policy'->>'delegation'<>'true' OR caller.depth+1>least((target->'policy'->>'maxDepth')::integer,(context->'profile'->'policy'->>'maxDepth')::integer) THEN RAISE EXCEPTION 'Delegation depth or policy does not permit this assignment'; END IF;
 IF jsonb_typeof(context->'profile'->'policy'->'delegateAgents')='array' AND NOT(context->'profile'->'policy'->'delegateAgents' ? p_target::text) THEN RAISE EXCEPTION 'This specialist is outside the delegation list'; END IF;
 IF EXISTS(WITH RECURSIVE chain AS(SELECT id,agent_id,parent_instance_id,assignment FROM desktop_agent_instances WHERE id=caller.id AND user_id=p_user UNION ALL SELECT i.id,i.agent_id,i.parent_instance_id,i.assignment FROM desktop_agent_instances i JOIN chain c ON i.id=c.parent_instance_id WHERE i.user_id=p_user) SELECT 1 FROM chain WHERE agent_id=p_target AND assignment=left(p_assignment,8000)) THEN RAISE EXCEPTION 'This delegation repeats an ancestor assignment'; END IF;
 IF (SELECT count(*) FROM desktop_agent_invocations WHERE user_id=p_user AND origin_request_id=p_request)>=least(16,(context->'profile'->'policy'->>'maxTurns')::integer) THEN RAISE EXCEPTION 'This originating turn reached its delegated-turn budget'; END IF;
 IF (SELECT count(*) FROM desktop_agent_invocations WHERE user_id=p_user AND status IN('queued','starting'))>=32 THEN RAISE EXCEPTION 'The named-agent queue is full. Finish or cancel queued work first'; END IF;
 INSERT INTO conversation_sessions(user_id,agent_id,title) VALUES(p_user,p_target,left((target->'definition'->>'name')||' · '||p_assignment,120)) RETURNING conversation_id INTO chat_id;
 IF caller.project_id IS NOT NULL THEN INSERT INTO desktop_project_chats(user_id,conversation_id,project_id) VALUES(p_user,chat_id,caller.project_id); END IF;
 INSERT INTO desktop_agent_participants(user_id,conversation_id,agent_id) VALUES(p_user,chat_id,p_target);
 grant_chain=caller.authority_chain||jsonb_build_array(jsonb_build_object('agent_id',caller.agent_id,'revision',caller.agent_revision,'instance_id',caller.id,'project_id',caller.project_id));
 INSERT INTO desktop_agent_instances(user_id,agent_id,agent_revision,conversation_id,project_id,parent_instance_id,depth,assignment,status,request_id,policy_ceiling,authority_chain)
  VALUES(p_user,p_target,p_target_revision,chat_id,caller.project_id,caller.id,caller.depth+1,p_assignment,'queued',p_child_request,p_ceiling,grant_chain) RETURNING * INTO child;
 INSERT INTO desktop_agent_invocations(user_id,caller_instance_id,call_id,target_agent_id,payload,request_id,child_instance_id,origin_request_id,caller_revision,target_revision)
  VALUES(p_user,caller.id,p_call,p_target,payload,p_child_request,child.id,p_request,caller.agent_revision,p_target_revision) RETURNING * INTO created;
 RETURN to_jsonb(created)||jsonb_build_object('existing',false);
END $$;

CREATE FUNCTION public.desktop_claim_agent_invocation(p_user uuid,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result desktop_agent_invocations;
BEGIN
 SELECT * INTO result FROM desktop_agent_invocations WHERE user_id=p_user AND request_id=p_request FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This named-agent assignment is unavailable'; END IF;
 IF result.status<>'queued' OR EXISTS(SELECT 1 FROM desktop_requests WHERE id=p_request) THEN RETURN to_jsonb(result)||jsonb_build_object('claimed',false); END IF;
 UPDATE desktop_agent_invocations SET status='starting',updated_at=now() WHERE user_id=p_user AND request_id=p_request RETURNING * INTO result;
 RETURN to_jsonb(result)||jsonb_build_object('claimed',true);
END $$;

CREATE FUNCTION public.desktop_track_named_agent_invocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE desktop_agent_invocations SET status=NEW.status,error=NEW.error,updated_at=now() WHERE request_id=NEW.id AND user_id=NEW.user_id;
 RETURN NEW;
END $$;
CREATE TRIGGER desktop_track_named_agent_invocation AFTER UPDATE OF status ON public.desktop_requests FOR EACH ROW EXECUTE FUNCTION public.desktop_track_named_agent_invocation();
REVOKE ALL ON FUNCTION public.desktop_track_named_agent_invocation() FROM PUBLIC,anon,authenticated;

-- Repeated identities are valid separate instances. Repeating the same ancestor
-- assignment is a loop; depth and per-origin budgets also remain enforced.
DO $$ DECLARE definition text; BEGIN
 definition=pg_get_functiondef('public.desktop_begin_agent_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint,bigint,uuid)'::regprocedure);
 definition=replace(definition,'PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));','PERFORM pg_advisory_xact_lock(hashtextextended(''agent-invoke:''||p_user::text,0)); PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));');
 definition=replace(definition,'SELECT id,agent_id,parent_instance_id FROM desktop_agent_instances','SELECT id,agent_id,parent_instance_id,assignment FROM desktop_agent_instances');
 definition=replace(definition,'SELECT i.id,i.agent_id,i.parent_instance_id FROM desktop_agent_instances','SELECT i.id,i.agent_id,i.parent_instance_id,i.assignment FROM desktop_agent_instances');
 definition=replace(definition,'SELECT 1 FROM chain WHERE agent_id=p_agent)','SELECT 1 FROM chain WHERE agent_id=p_agent AND assignment=left(p_text,8000))');
 EXECUTE definition;
END $$;

-- Authority ceilings survive queueing and cannot be relaxed by a target agent.
DO $$ DECLARE definition text; BEGIN
 definition=pg_get_functiondef('public.desktop_agent_request_scope(uuid,uuid,text)'::regprocedure);
 definition=replace(definition,'DECLARE instance desktop_agent_instances;membership uuid;profile jsonb;','DECLARE instance desktop_agent_instances;membership uuid;profile jsonb;grant_value jsonb;grant_profile jsonb;');
 definition=replace(definition,'RETURN jsonb_build_object(''instance'',to_jsonb(instance),''profile'',profile);',$body$
 FOR grant_value IN SELECT value FROM jsonb_array_elements(instance.authority_chain) LOOP
  grant_profile=desktop_agent_profile(p_user,(grant_value->>'agent_id')::uuid);
  IF (grant_profile->>'revision')::bigint IS DISTINCT FROM (grant_value->>'revision')::bigint OR grant_profile->'definition'->>'active'<>'true' THEN RAISE EXCEPTION 'A requesting agent changed or was retired. Review this delegated assignment'; END IF;
  IF NOT EXISTS(SELECT 1 FROM desktop_agent_instances parent LEFT JOIN desktop_project_chats pc ON pc.conversation_id=parent.conversation_id AND pc.user_id=p_user
   WHERE parent.id=(grant_value->>'instance_id')::uuid AND parent.user_id=p_user AND pc.project_id IS NOT DISTINCT FROM parent.project_id) THEN RAISE EXCEPTION 'The originating assignment changed project scope'; END IF;
 END LOOP;
 IF instance.policy_ceiling IS NOT NULL THEN profile=jsonb_set(profile,'{policy}',desktop_intersect_agent_policy(profile->'policy',instance.policy_ceiling)); END IF;
 RETURN jsonb_build_object('instance',to_jsonb(instance),'profile',profile);$body$);
 EXECUTE definition;
END $$;

REVOKE ALL ON FUNCTION public.desktop_intersect_agent_policy(jsonb,jsonb),public.desktop_reserve_agent_invocation(uuid,uuid,text,text,uuid,text,jsonb,jsonb,bigint,uuid),public.desktop_claim_agent_invocation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_intersect_agent_policy(jsonb,jsonb),public.desktop_reserve_agent_invocation(uuid,uuid,text,text,uuid,text,jsonb,jsonb,bigint,uuid),public.desktop_claim_agent_invocation(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
