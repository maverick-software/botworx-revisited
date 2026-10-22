-- A queued handoff may outlive a completed sender, but a stopped child/report
-- cannot dispatch merely because its parent request is still running.
DO $$ DECLARE definition text;first_pos integer;last_pos integer;BEGIN
 definition=pg_get_functiondef('public.desktop_chat_delivery_snapshot(uuid,uuid,uuid,text,uuid,boolean)'::regprocedure);
 first_pos=strpos(definition,' IF NOT p_active AND source.status NOT IN');last_pos=strpos(definition,' source_profile=desktop_agent_profile');
 IF first_pos=0 OR last_pos<=first_pos THEN RAISE EXCEPTION 'Unrecognized completed-sender boundary'; END IF;
 definition=left(definition,first_pos-1)||$body$
 IF NOT p_active AND NOT (
  p_thread IS NULL AND source.status IN('running','completed') OR p_thread IS NOT NULL AND EXISTS(
   SELECT 1 FROM desktop_codex_turns t WHERE t.request_id=p_request AND t.user_id=p_user AND (
    t.thread_id=p_thread AND source.status IN('running','completed')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(t.state->'children','[]')) c WHERE c->>'threadId'=p_thread AND c->>'status' IN('running','completed'))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(t.state->'reports','[]')) r WHERE r->'state'->>'threadId'=p_thread AND r->>'status' IN('running','completed'))
   ))
 ) THEN RAISE EXCEPTION 'The sending task stopped or its native scope ended. Review this message before sending new work'; END IF;
$body$||substring(definition FROM last_pos);
 EXECUTE definition;
END $$;

-- Dependencies are captured once, when sending is prepared. Looking up later
-- incoming messages while validating an older receipt would create a cycle
-- when two still-running chats steer each other.
DO $$ DECLARE definition text;signature text;BEGIN
 definition=pg_get_functiondef('public.desktop_prepare_chat_delivery(uuid,uuid,uuid,text,text,uuid,text,text)'::regprocedure);
 definition=replace(definition,'scope=desktop_chat_delivery_snapshot(p_user,p_request,p_project,p_thread,p_target);',$body$
 PERFORM desktop_validate_chat_delivery_request(p_user,p_request);
 scope=desktop_chat_delivery_snapshot(p_user,p_request,p_project,p_thread,p_target);
 scope=scope||jsonb_build_object('delivery_dependencies',coalesce((SELECT jsonb_agg(id ORDER BY created_at,id) FROM desktop_chat_deliveries WHERE user_id=p_user AND target_request=p_request),'[]'));
$body$);
 EXECUTE definition;
 FOREACH signature IN ARRAY ARRAY[
  'public.desktop_authorize_chat_delivery(uuid,uuid,text)',
  'public.desktop_claim_chat_delivery(uuid,uuid)',
  'public.desktop_change_chat_delivery(uuid,uuid,text)'] LOOP
  definition=pg_get_functiondef(signature::regprocedure);
  IF strpos(definition,'scope IS DISTINCT FROM item.snapshot')=0 THEN RAISE EXCEPTION 'Unrecognized delivery snapshot comparison'; END IF;
  definition=replace(definition,'scope IS DISTINCT FROM item.snapshot','scope-''delivery_dependencies'' IS DISTINCT FROM item.snapshot-''delivery_dependencies''');
  EXECUTE definition;
 END LOOP;
 definition=pg_get_functiondef('public.desktop_validate_chat_delivery(uuid,uuid)'::regprocedure);
 definition=replace(definition,'DECLARE item desktop_chat_deliveries;scope jsonb;','DECLARE item desktop_chat_deliveries;scope jsonb;dependency text;');
 definition=replace(definition,' scope=desktop_chat_delivery_snapshot',$body$
 FOR dependency IN SELECT jsonb_array_elements_text(coalesce(item.snapshot->'delivery_dependencies','[]')) LOOP
  IF dependency=item.id::text THEN RAISE EXCEPTION 'A delivery cannot depend on itself'; END IF;
  PERFORM desktop_validate_chat_delivery(p_user,dependency::uuid);
 END LOOP;
 scope=desktop_chat_delivery_snapshot$body$);
 definition=replace(definition,'scope-''target_options'' IS DISTINCT FROM item.snapshot-''target_options''','scope-''target_options''-''delivery_dependencies'' IS DISTINCT FROM item.snapshot-''target_options''-''delivery_dependencies''');
 EXECUTE definition;
 definition=pg_get_functiondef('public.desktop_begin_delivered_chat(uuid,uuid,jsonb,jsonb,uuid,bigint)'::regprocedure);
 definition=replace(definition,'chain jsonb;','chain jsonb;dependency_id text;');
 definition=replace(definition,'IF item.status<>''dispatching'' OR item.delivery<>''queue'' THEN','IF item.status<>''dispatching'' OR item.delivery<>''queue'' OR item.target_request IS NOT NULL AND item.target_request<>item.id THEN');
 definition=replace(definition,'current_scope IS DISTINCT FROM item.snapshot','current_scope-''delivery_dependencies'' IS DISTINCT FROM item.snapshot-''delivery_dependencies''');
 definition=replace(definition,' UPDATE desktop_agent_instances SET policy_ceiling=', $body$
 FOR dependency_id IN SELECT jsonb_array_elements_text(coalesce(item.snapshot->'delivery_dependencies','[]')) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(chain) entry WHERE entry->>'delivery_id'=dependency_id) THEN
   chain=chain||jsonb_build_array((item.snapshot->'authority_chain'->-1)||jsonb_build_object('delivery_id',dependency_id));
  END IF;
 END LOOP;
 UPDATE desktop_agent_instances SET policy_ceiling=$body$);
 EXECUTE definition;
 -- Named specialists inherit receipts introduced by steering their parent.
 definition=pg_get_functiondef('public.desktop_reserve_agent_invocation(uuid,uuid,text,text,uuid,text,jsonb,jsonb,bigint,uuid)'::regprocedure);
 definition=replace(definition,'context=desktop_agent_request_scope(p_user,p_request,p_thread);','PERFORM desktop_validate_chat_delivery_request(p_user,p_request); context=desktop_agent_request_scope(p_user,p_request,p_thread);');
 definition=replace(definition,' INSERT INTO desktop_agent_instances(user_id,agent_id,agent_revision,conversation_id,project_id,parent_instance_id,depth,assignment,status,request_id,policy_ceiling,authority_chain)',$body$
 grant_chain=grant_chain||coalesce((SELECT jsonb_agg(jsonb_build_object('agent_id',caller.agent_id,'revision',caller.agent_revision,'instance_id',caller.id,'project_id',caller.project_id,'delivery_id',d.id))
  FROM desktop_chat_deliveries d WHERE d.user_id=p_user AND d.target_request=p_request AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(grant_chain) entry WHERE entry->>'delivery_id'=d.id::text)),'[]');
 INSERT INTO desktop_agent_instances(user_id,agent_id,agent_revision,conversation_id,project_id,parent_instance_id,depth,assignment,status,request_id,policy_ceiling,authority_chain)$body$);
 EXECUTE definition;
END $$;

CREATE FUNCTION public.desktop_claim_chat_delivery_steering(p_user uuid,p_id uuid,p_target_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;current_scope jsonb;target desktop_requests;context jsonb;actual jsonb;actual_project jsonb;field text;value text;source_files jsonb;actual_files jsonb;
BEGIN
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This incoming message is unavailable'; END IF;
 IF item.status<>'queued' THEN RETURN to_jsonb(item)||jsonb_build_object('claimed',false); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('chat-delivery-target:'||p_user::text||':'||item.target_chat::text,0));
 IF NOT item.authorized_once AND NOT EXISTS(SELECT 1 FROM desktop_chat_delivery_grants WHERE id=item.grant_id AND user_id=p_user AND enabled AND revision=item.grant_revision) THEN RAISE EXCEPTION 'Chat coordination permission was revoked or changed'; END IF;
 current_scope=desktop_chat_delivery_snapshot(p_user,item.source_request,(item.snapshot->'source_project'->>'id')::uuid,item.source_thread,item.target_chat,false);
 IF current_scope-'delivery_dependencies' IS DISTINCT FROM item.snapshot-'delivery_dependencies' THEN RAISE EXCEPTION 'The sending or receiving selection changed'; END IF;
 SELECT * INTO target FROM desktop_requests WHERE id=p_target_request AND user_id=p_user AND conversation_id=item.target_chat AND status='running' FOR SHARE;
 IF NOT FOUND OR target.agent_id::text IS DISTINCT FROM item.snapshot->>'target_agent' OR NOT EXISTS(SELECT 1 FROM desktop_codex_turns WHERE request_id=p_target_request AND user_id=p_user) THEN RAISE EXCEPTION 'The receiving native turn changed or stopped'; END IF;
 PERFORM desktop_validate_chat_delivery_request(p_user,p_target_request);
 context=desktop_agent_request_scope(p_user,p_target_request,NULL);
 IF desktop_intersect_agent_policy(context->'profile'->'policy',item.snapshot->'source_policy') IS DISTINCT FROM context->'profile'->'policy' THEN RAISE EXCEPTION 'The receiving turn has broader agent permissions'; END IF;
 SELECT metadata->'options',metadata->'project' INTO actual,actual_project FROM chat_messages_v2 WHERE id=target.user_message_id;
 IF actual->>'provider' IS DISTINCT FROM item.snapshot->'target_options'->>'provider' OR actual->>'model' IS DISTINCT FROM item.snapshot->'target_options'->>'model' OR actual->>'harness'='legacy' THEN RAISE EXCEPTION 'The receiving connection or harness changed'; END IF;
 IF actual->>'permission'='full' AND item.snapshot->'source_options'->>'permission'<>'full' THEN RAISE EXCEPTION 'The receiving turn has broader file and command permissions'; END IF;
 source_files=coalesce(item.snapshot->'source_options'->'files','[]')||coalesce(item.snapshot->'source_project'->'file_ids','[]');
 actual_files=CASE WHEN actual->>'permission'='chat' THEN '[]'::jsonb ELSE coalesce(actual->'files','[]')||coalesce(actual_project->'file_ids','[]') END;
 FOR value IN SELECT jsonb_array_elements_text(actual_files) LOOP IF NOT source_files ? value THEN RAISE EXCEPTION 'The receiving turn has broader workspace access'; END IF;END LOOP;
 FOREACH field IN ARRAY ARRAY['windows','skills','tools'] LOOP
  IF field='tools' AND item.snapshot->'source_options' ? field AND NOT actual ? field THEN RAISE EXCEPTION 'The receiving turn has a broader tool selection'; END IF;
  FOR value IN SELECT jsonb_array_elements_text(coalesce(actual->field,'[]')) LOOP
   IF (field<>'tools' OR item.snapshot->'source_options' ? field) AND NOT(coalesce(item.snapshot->'source_options'->field,'[]') ? value) THEN RAISE EXCEPTION 'The receiving turn has a broader context selection'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM desktop_chat_deliveries WHERE user_id=p_user AND target_chat=item.target_chat AND status='dispatching' AND id<>item.id) THEN RETURN to_jsonb(item)||jsonb_build_object('claimed',false); END IF;
 UPDATE desktop_chat_deliveries SET status='dispatching',target_request=p_target_request,dispatch_started_at=now(),updated_at=now() WHERE id=p_id RETURNING * INTO item;
 RETURN to_jsonb(item)||jsonb_build_object('claimed',true);
END $$;

CREATE FUNCTION public.desktop_chat_delivery_dependents(p_user uuid,p_grant uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM desktop_chat_delivery_grants WHERE id=p_grant AND user_id=p_user) THEN RAISE EXCEPTION 'This chat coordination permission is unavailable'; END IF;
 WITH affected AS (
  SELECT r.id AS request_id FROM desktop_requests r LEFT JOIN desktop_agent_instances i ON i.id=r.agent_instance_id AND i.user_id=p_user LEFT JOIN desktop_codex_turns n ON n.request_id=r.id AND n.user_id=p_user
  WHERE r.user_id=p_user AND EXISTS(SELECT 1 FROM desktop_chat_deliveries d WHERE d.user_id=p_user AND d.grant_id=p_grant AND (
   d.target_request=r.id OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(i.authority_chain,'[]')||coalesce(n.context->'agentAuthorityChain','[]')) entry WHERE entry->>'delivery_id'=d.id::text)))
  UNION SELECT i.request_id FROM desktop_agent_instances i WHERE i.user_id=p_user AND i.request_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM desktop_chat_deliveries d WHERE d.user_id=p_user AND d.grant_id=p_grant AND EXISTS(SELECT 1 FROM jsonb_array_elements(i.authority_chain) entry WHERE entry->>'delivery_id'=d.id::text))
 ) SELECT coalesce(jsonb_agg(request_id ORDER BY request_id),'[]') INTO result FROM affected;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.desktop_claim_chat_delivery_steering(uuid,uuid,uuid),public.desktop_chat_delivery_dependents(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_claim_chat_delivery_steering(uuid,uuid,uuid),public.desktop_chat_delivery_dependents(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
