-- Prepare a receiving turn atomically, before any provider request. The broker
-- retains its conversation reservation while loading context and calling this.
DO $$ DECLARE definition text;needle text;BEGIN
 definition=pg_get_functiondef('public.desktop_chat_delivery_snapshot(uuid,uuid,uuid,text,uuid,boolean)'::regprocedure);
 needle='AND metadata ? ''options'' ORDER BY';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized receiving selection boundary'; END IF;
 definition=replace(definition,needle,'AND metadata ? ''options'' AND NOT(metadata ? ''chat_delivery'') ORDER BY');
 needle='chain=caller.authority_chain||';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized inherited file boundary'; END IF;
 definition=replace(definition,needle,$body$
 IF caller.policy_ceiling IS NOT NULL AND jsonb_typeof(source_project)='object' THEN
  source_project=jsonb_set(source_project,'{file_ids}',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(source_project->'file_ids') WHERE coalesce(source_options->'files','[]') ? (value#>>'{}')),'[]'));
 END IF;
 chain=caller.authority_chain||$body$);
 needle='FOR grant_value IN SELECT value FROM jsonb_array_elements(caller.authority_chain) LOOP';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized delivery dependency boundary'; END IF;
 definition=replace(definition,needle,needle||E'\n IF grant_value->>''delivery_id'' IS NOT NULL THEN PERFORM desktop_validate_chat_delivery(p_user,(grant_value->>''delivery_id'')::uuid); END IF;');
 EXECUTE definition;
END $$;

-- Preserve the named-assignment claim check and add the separate, owned outbox
-- claim as another valid parented startup. Both paths lock their receipt before
-- creating a request, so an earlier cancellation continues to prevent startup.
DO $$ DECLARE definition text;needle text;BEGIN
 definition=pg_get_functiondef('public.desktop_begin_agent_chat(uuid,uuid,uuid,uuid,text,jsonb,jsonb,uuid,bigint,uuid,bigint,bigint,uuid)'::regprocedure);
 needle='IF NOT FOUND THEN RAISE EXCEPTION ''This named-agent assignment was stopped or was not claimed''; END IF;';
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized parented request claim boundary'; END IF;
 definition=replace(definition,needle,$body$
 IF NOT FOUND THEN
  PERFORM 1 FROM desktop_chat_deliveries d WHERE d.id=p_request AND d.user_id=p_user AND d.status='dispatching' AND d.delivery='queue'
   AND d.target_chat=p_conversation AND d.snapshot->>'target_agent'=p_agent::text AND (d.snapshot->'authority_chain'->-1->>'instance_id')::uuid=p_parent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This named-agent assignment or chat delivery was stopped or was not claimed'; END IF;
 END IF;$body$);
 EXECUTE definition;
END $$;

CREATE FUNCTION public.desktop_begin_delivered_chat(p_user uuid,p_delivery uuid,p_options jsonb,p_files jsonb,p_plan uuid,p_plan_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;current_scope jsonb;existing desktop_requests;result jsonb;origin jsonb;project jsonb;source_files jsonb;target_files jsonb;field text;value text;expected_permission text;parent uuid;chain jsonb;
BEGIN
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_delivery AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This message is unavailable'; END IF;
 SELECT * INTO existing FROM desktop_requests WHERE id=item.id AND user_id=p_user AND conversation_id=item.target_chat;
 IF FOUND THEN
  SELECT metadata INTO origin FROM chat_messages_v2 WHERE id=existing.user_message_id;
  IF origin->'chat_delivery'->>'id' IS DISTINCT FROM item.id::text THEN RAISE EXCEPTION 'This request identifier belongs to another message'; END IF;
  RETURN to_jsonb(existing)||jsonb_build_object('existing',true,'agent',origin->'agent','project',origin->'project','chat_delivery',origin->'chat_delivery');
 END IF;
 IF item.status<>'dispatching' OR item.delivery<>'queue' THEN RAISE EXCEPTION 'Claim a queued chat message before preparing its turn'; END IF;
 PERFORM desktop_validate_chat_delivery(p_user,item.id);
 current_scope=desktop_chat_delivery_snapshot(p_user,item.source_request,(item.snapshot->'source_project'->>'id')::uuid,item.source_thread,item.target_chat,false);
 IF current_scope IS DISTINCT FROM item.snapshot THEN RAISE EXCEPTION 'The receiving selection changed. Review a fresh message'; END IF;
 IF p_options IS NULL OR jsonb_typeof(p_options)<>'object' OR p_files IS NULL OR jsonb_typeof(p_files)<>'array' OR jsonb_array_length(p_files)>20 THEN RAISE EXCEPTION 'Invalid receiving context'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_options) key WHERE key NOT IN('harness','skills','windows','provider','model','thinking','permission','mode','files','tools')) THEN RAISE EXCEPTION 'A coordination message cannot add execution options or a goal'; END IF;
 IF p_options->>'harness' IS DISTINCT FROM 'codex' OR EXISTS(SELECT 1 FROM unnest(ARRAY['provider','model','thinking','mode']) AS fields(name) WHERE p_options->fields.name IS DISTINCT FROM item.snapshot->'target_options'->fields.name) THEN RAISE EXCEPTION 'The receiver must retain its reviewed connection, model and mode'; END IF;
 expected_permission=CASE WHEN item.snapshot->'target_options'->>'permission'='chat' THEN 'chat' WHEN item.snapshot->'target_options'->>'permission'='files' THEN 'files' WHEN item.snapshot->'source_options'->>'permission'='full' AND item.snapshot->'target_options'->>'permission'='full' THEN 'full' ELSE 'ask' END;
 IF p_options->>'permission' IS DISTINCT FROM expected_permission THEN RAISE EXCEPTION 'The receiving permission must match the narrower reviewed scope'; END IF;
 source_files=coalesce(item.snapshot->'source_options'->'files','[]')||coalesce(item.snapshot->'source_project'->'file_ids','[]');
 target_files=coalesce(item.snapshot->'target_options'->'files','[]')||coalesce(item.snapshot->'target_project'->'file_ids','[]');
 IF jsonb_typeof(p_options->'files') IS DISTINCT FROM 'array' OR jsonb_array_length(p_options->'files')>20 OR expected_permission='chat' AND jsonb_array_length(p_options->'files')>0 THEN RAISE EXCEPTION 'Invalid receiving file scope'; END IF;
 FOR value IN SELECT jsonb_array_elements_text(p_options->'files') LOOP IF NOT source_files ? value OR NOT target_files ? value THEN RAISE EXCEPTION 'A message cannot add source or receiving workspace access'; END IF;END LOOP;
 FOREACH field IN ARRAY ARRAY['windows','skills','tools'] LOOP
  IF p_options ? field AND jsonb_typeof(p_options->field)<>'array' THEN RAISE EXCEPTION 'Invalid receiving context selection'; END IF;
  IF field='tools' AND NOT p_options ? field AND (item.snapshot->'source_options' ? field OR item.snapshot->'target_options' ? field) THEN RAISE EXCEPTION 'The receiving tool filter cannot become unrestricted'; END IF;
  FOR value IN SELECT jsonb_array_elements_text(coalesce(p_options->field,'[]')) LOOP
   IF (field<>'tools' OR item.snapshot->'source_options' ? field) AND NOT(coalesce(item.snapshot->'source_options'->field,'[]') ? value)
    OR (field<>'tools' OR item.snapshot->'target_options' ? field) AND NOT(coalesce(item.snapshot->'target_options'->field,'[]') ? value) THEN RAISE EXCEPTION 'The receiving selection exceeds the inherited scope'; END IF;
  END LOOP;
 END LOOP;
 IF expected_permission='chat' AND jsonb_array_length(coalesce(p_options->'windows','[]'))>0 THEN RAISE EXCEPTION 'Chat only cannot share windows'; END IF;
 parent=(item.snapshot->'authority_chain'->-1->>'instance_id')::uuid;
 IF parent IS NULL THEN RAISE EXCEPTION 'This message has no originating assignment'; END IF;
 result=desktop_begin_agent_chat(p_user,item.id,(item.snapshot->>'target_agent')::uuid,item.target_chat,item.text,p_options,p_files,
  (item.snapshot->'target_project'->>'id')::uuid,(item.snapshot->'target_project'->>'revision')::bigint,p_plan,p_plan_revision,(item.snapshot->>'target_revision')::bigint,parent);
 chain=jsonb_set(item.snapshot->'authority_chain',ARRAY[(jsonb_array_length(item.snapshot->'authority_chain')-1)::text,'delivery_id'],to_jsonb(item.id::text));
 UPDATE desktop_agent_instances SET policy_ceiling=item.snapshot->'policy_ceiling',authority_chain=chain,depth=(item.snapshot->>'depth')::integer WHERE id=(result->>'agent_instance_id')::uuid AND user_id=p_user;
 origin=jsonb_strip_nulls(jsonb_build_object('id',item.id,'sourceConversationId',item.source_chat,'sourceMessageId',item.snapshot->>'source_message','sourceAgentId',item.snapshot->>'source_agent','sourceAgentName',item.snapshot->>'source_name','sourceThreadId',item.source_thread,'citation','agentopia-chat://'||item.source_chat::text||'/message/'||(item.snapshot->>'source_message')));
 project=result->'project';
 IF jsonb_typeof(project)='object' THEN project=jsonb_set(project,'{file_ids}',coalesce((SELECT jsonb_agg(files.id) FROM jsonb_array_elements(coalesce(project->'file_ids','[]')) AS files(id) WHERE p_options->'files' ? (files.id#>>'{}')),'[]'));END IF;
 UPDATE chat_messages_v2 SET metadata=metadata||jsonb_build_object('chat_delivery',origin)||CASE WHEN jsonb_typeof(project)='object' THEN jsonb_build_object('project',project) ELSE '{}' END WHERE id IN((result->>'user_message_id')::uuid,(result->>'assistant_message_id')::uuid);
 UPDATE conversation_sessions SET session_state=coalesce(session_state,'{}')||jsonb_build_object('desktop_composer',item.snapshot->'target_options') WHERE conversation_id=item.target_chat AND user_id=p_user;
 UPDATE desktop_chat_deliveries SET target_request=item.id,updated_at=now() WHERE id=item.id AND user_id=p_user;
 RETURN result||jsonb_build_object('project',project,'chat_delivery',origin);
END $$;

CREATE FUNCTION public.desktop_validate_chat_delivery_request(p_user uuid,p_request uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE request desktop_requests;instance desktop_agent_instances;delivery uuid;
BEGIN
 SELECT * INTO request FROM desktop_requests WHERE id=p_request AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'This chat request is unavailable'; END IF;
 SELECT * INTO instance FROM desktop_agent_instances WHERE id=request.agent_instance_id AND user_id=p_user;
 FOR delivery IN
  SELECT DISTINCT d.id FROM desktop_chat_deliveries d WHERE d.user_id=p_user AND (d.target_request=p_request
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(instance.authority_chain,'[]')) grant_value WHERE grant_value->>'delivery_id'=d.id::text))
 LOOP PERFORM desktop_validate_chat_delivery(p_user,delivery);END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.desktop_begin_delivered_chat(uuid,uuid,jsonb,jsonb,uuid,bigint),public.desktop_validate_chat_delivery_request(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_begin_delivered_chat(uuid,uuid,jsonb,jsonb,uuid,bigint),public.desktop_validate_chat_delivery_request(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
