-- Durable cross-chat outbox. No function in this migration starts inference or
-- accepts an authorization from model-authored content. Only the desktop broker
-- may call these functions; renderer actions provide the authorization decision.
CREATE TABLE public.desktop_chat_delivery_grants(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 first_chat uuid NOT NULL,second_chat uuid NOT NULL,
 first_project uuid,second_project uuid,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(first_chat<second_chat),UNIQUE(user_id,first_chat,second_chat)
);
CREATE TABLE public.desktop_chat_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source_request uuid NOT NULL REFERENCES public.desktop_requests(id) ON DELETE CASCADE,
 source_chat uuid NOT NULL,target_chat uuid NOT NULL,source_thread text,
 call_id text NOT NULL CHECK(length(call_id) BETWEEN 1 AND 256),
 text text NOT NULL CHECK(length(trim(text)) BETWEEN 1 AND 8000),
 delivery text NOT NULL DEFAULT 'queue' CHECK(delivery IN('queue','steer')),
 status text NOT NULL DEFAULT 'awaiting_authorization' CHECK(status IN('awaiting_authorization','queued','dispatching','delivered','held','cancelled','denied')),
 snapshot jsonb NOT NULL,
 authorized_once boolean NOT NULL DEFAULT false,
 grant_id uuid REFERENCES public.desktop_chat_delivery_grants(id),grant_revision bigint,
 target_request uuid REFERENCES public.desktop_requests(id) ON DELETE SET NULL,
 dispatch_started_at timestamptz,
 receipt jsonb,error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(source_chat<>target_chat),
 UNIQUE NULLS NOT DISTINCT(user_id,source_request,source_thread,call_id)
);
CREATE INDEX desktop_chat_deliveries_pending ON public.desktop_chat_deliveries(user_id,target_chat,status,created_at,id);
ALTER TABLE public.desktop_chat_delivery_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_chat_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_chat_delivery_grants,public.desktop_chat_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.desktop_chat_delivery_grants,public.desktop_chat_deliveries TO service_role;

CREATE FUNCTION public.desktop_chat_delivery_snapshot(p_user uuid,p_request uuid,p_project uuid,p_thread text,p_target uuid,p_active boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE source desktop_requests;caller desktop_agent_instances;target conversation_sessions;
 source_profile jsonb;target_profile jsonb;source_options jsonb;target_options jsonb;source_project jsonb;target_project jsonb;
 target_agent uuid;chain jsonb;grant_value jsonb;grant_profile jsonb;membership uuid;
BEGIN
 PERFORM desktop_chat_inspection_access(p_user,p_request,p_project,p_thread,p_target,p_active);
 SELECT * INTO source FROM desktop_requests WHERE id=p_request AND user_id=p_user;
 SELECT * INTO caller FROM desktop_agent_instances WHERE id=source.agent_instance_id AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'This chat has no saved agent assignment'; END IF;
 IF p_active THEN PERFORM desktop_agent_request_scope(p_user,p_request,p_thread); END IF;
 -- A completed sender may leave work queued. A stopped root may not dispatch
 -- fresh work later. Independent native children are validated by their saved
 -- thread status rather than by reviving the root request.
 IF NOT p_active AND source.status NOT IN('running','completed') AND NOT EXISTS(
  SELECT 1 FROM desktop_codex_turns t,jsonb_array_elements(coalesce(t.state->'children','[]')) c
  WHERE t.request_id=p_request AND t.user_id=p_user AND c->>'threadId'=p_thread AND c->>'status' IN('running','completed')
 ) THEN RAISE EXCEPTION 'The sending task stopped. Review this message before sending new work'; END IF;
 source_profile=desktop_agent_profile(p_user,source.agent_id);
 IF (source_profile->>'revision')::bigint<>caller.agent_revision OR source_profile->'definition'->>'active'<>'true' THEN RAISE EXCEPTION 'The sending agent changed or was retired'; END IF;
 IF caller.policy_ceiling IS NOT NULL THEN source_profile=jsonb_set(source_profile,'{policy}',desktop_intersect_agent_policy(source_profile->'policy',caller.policy_ceiling)); END IF;
 FOR grant_value IN SELECT value FROM jsonb_array_elements(caller.authority_chain) LOOP
  grant_profile=desktop_agent_profile(p_user,(grant_value->>'agent_id')::uuid);
  IF (grant_profile->>'revision')::bigint IS DISTINCT FROM (grant_value->>'revision')::bigint OR grant_profile->'definition'->>'active'<>'true' THEN RAISE EXCEPTION 'A requesting agent changed or was retired'; END IF;
  SELECT pc.project_id INTO membership FROM desktop_agent_instances i LEFT JOIN desktop_project_chats pc ON pc.user_id=i.user_id AND pc.conversation_id=i.conversation_id WHERE i.id=(grant_value->>'instance_id')::uuid AND i.user_id=p_user;
  IF NOT FOUND OR membership IS DISTINCT FROM (grant_value->>'project_id')::uuid THEN RAISE EXCEPTION 'The requesting assignment changed project scope'; END IF;
  IF grant_value->>'goal_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_goals WHERE id=(grant_value->>'goal_id')::uuid AND user_id=p_user AND status='running') THEN RAISE EXCEPTION 'The requesting goal stopped'; END IF;
 END LOOP;
 SELECT * INTO target FROM conversation_sessions WHERE conversation_id=p_target AND user_id=p_user;
 target_agent=coalesce(nullif(target.session_state->>'desktop_active_agent','')::uuid,target.agent_id);
 target_profile=desktop_agent_profile(p_user,target_agent);
 IF target_profile->'definition'->>'active'<>'true' THEN RAISE EXCEPTION 'The receiving agent was retired'; END IF;
 IF source_profile->'policy'->>'delegation'<>'true' OR source_profile->'policy'->>'memory'<>'true' OR
  jsonb_typeof(source_profile->'policy'->'tools')='array' AND NOT(source_profile->'policy'->'tools' ?| ARRAY['send_message_to_chat','tools.send_message_to_chat']) OR
  jsonb_typeof(source_profile->'policy'->'delegateAgents')='array' AND NOT(source_profile->'policy'->'delegateAgents' ? target_agent::text)
 THEN RAISE EXCEPTION 'The sending agent policy does not allow messaging this chat'; END IF;
 IF caller.depth+1>least((source_profile->'policy'->>'maxDepth')::integer,(target_profile->'policy'->>'maxDepth')::integer) THEN RAISE EXCEPTION 'The coordination depth limit was reached'; END IF;
 SELECT metadata->'options' INTO source_options FROM chat_messages_v2 WHERE id=source.user_message_id;
 IF source_options->>'goalId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_goals WHERE id=(source_options->>'goalId')::uuid AND user_id=p_user AND status='running') THEN RAISE EXCEPTION 'The sending goal stopped'; END IF;
 SELECT metadata->'options' INTO target_options FROM chat_messages_v2 WHERE conversation_id=p_target AND role='user' AND metadata ? 'options' ORDER BY created_at DESC,desktop_sequence DESC,id DESC LIMIT 1;
 IF source_options IS NULL OR coalesce(source_options->>'permission','') NOT IN('ask','full') OR coalesce(source_options->>'mode','')<>'chat' THEN RAISE EXCEPTION 'This task mode cannot send work to another chat'; END IF;
 IF target_options IS NULL OR coalesce(target_options->>'provider','') NOT IN('openai-oauth','openrouter') OR coalesce(target_options->>'model','')='' THEN RAISE EXCEPTION 'Open the receiving chat and select its connection and model first'; END IF;
 SELECT jsonb_build_object('id',id,'revision',revision,'file_ids',file_ids) INTO source_project FROM desktop_projects WHERE id=p_project AND user_id=p_user;
 SELECT jsonb_build_object('id',p.id,'revision',p.revision,'file_ids',p.file_ids) INTO target_project FROM desktop_projects p JOIN desktop_project_chats c ON c.project_id=p.id AND c.user_id=p_user WHERE c.conversation_id=p_target AND p.user_id=p_user;
 chain=caller.authority_chain||jsonb_build_array(jsonb_build_object('agent_id',caller.agent_id,'revision',caller.agent_revision,'instance_id',caller.id,'project_id',caller.project_id,'goal_id',source_options->>'goalId'));
 RETURN jsonb_build_object(
  'source_chat',source.conversation_id,'source_message',source.user_message_id,'source_agent',source.agent_id,
  'source_name',source_profile->'definition'->>'name','source_revision',source_profile->'revision',
  'target_chat',p_target,'target_title',left(coalesce(target.title,'Untitled chat'),240),'target_agent',target_agent,
  'target_name',target_profile->'definition'->>'name','target_revision',target_profile->'revision',
  'source_project',source_project,'target_project',target_project,'source_options',source_options,'target_options',target_options,
  'source_policy',source_profile->'policy','target_policy',target_profile->'policy',
  'policy_ceiling',desktop_intersect_agent_policy(target_profile->'policy',source_profile->'policy'),
  'authority_chain',chain,'depth',caller.depth+1);
END $$;

CREATE FUNCTION public.desktop_prepare_chat_delivery(p_user uuid,p_request uuid,p_project uuid,p_thread text,p_call text,p_target uuid,p_text text,p_delivery text DEFAULT 'queue')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous desktop_chat_deliveries;created desktop_chat_deliveries;scope jsonb;pair desktop_chat_delivery_grants;first_id uuid;second_id uuid;first_scope uuid;second_scope uuid;
BEGIN
 IF p_call IS NULL OR length(p_call) NOT BETWEEN 1 AND 256 OR p_text IS NULL OR length(trim(p_text)) NOT BETWEEN 1 AND 8000 OR p_delivery IS NULL OR p_delivery NOT IN('queue','steer') THEN RAISE EXCEPTION 'Invalid cross-chat message'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('chat-delivery:'||p_user::text,0));
 SELECT * INTO previous FROM desktop_chat_deliveries WHERE user_id=p_user AND source_request=p_request AND source_thread IS NOT DISTINCT FROM p_thread AND call_id=p_call;
 IF FOUND THEN
  IF previous.target_chat<>p_target OR previous.text<>trim(p_text) OR previous.delivery<>p_delivery THEN RAISE EXCEPTION 'This delivery identifier was already used for another message'; END IF;
  RETURN to_jsonb(previous)||jsonb_build_object('existing',true);
 END IF;
 scope=desktop_chat_delivery_snapshot(p_user,p_request,p_project,p_thread,p_target);
 IF (SELECT count(*) FROM desktop_chat_deliveries WHERE user_id=p_user AND source_request=p_request)>=least(50,(scope->'source_policy'->>'maxTurns')::integer) THEN RAISE EXCEPTION 'This task reached its cross-chat message limit'; END IF;
 IF (SELECT count(*) FROM desktop_chat_deliveries WHERE user_id=p_user AND target_chat=p_target AND status IN('awaiting_authorization','queued','dispatching','held'))>=20 THEN RAISE EXCEPTION 'Review the receiving chat queue before sending more messages'; END IF;
 first_id=least((scope->>'source_chat')::uuid,p_target);second_id=greatest((scope->>'source_chat')::uuid,p_target);
 first_scope=CASE WHEN first_id=p_target THEN (scope->'target_project'->>'id')::uuid ELSE p_project END;
 second_scope=CASE WHEN second_id=p_target THEN (scope->'target_project'->>'id')::uuid ELSE p_project END;
 SELECT * INTO pair FROM desktop_chat_delivery_grants WHERE user_id=p_user AND first_chat=first_id AND second_chat=second_id AND enabled AND first_project IS NOT DISTINCT FROM first_scope AND second_project IS NOT DISTINCT FROM second_scope;
 INSERT INTO desktop_chat_deliveries(user_id,source_request,source_chat,target_chat,source_thread,call_id,text,delivery,snapshot,status,grant_id,grant_revision)
 VALUES(p_user,p_request,(scope->>'source_chat')::uuid,p_target,p_thread,p_call,trim(p_text),p_delivery,scope,CASE WHEN pair.id IS NULL THEN 'awaiting_authorization' ELSE 'queued' END,pair.id,pair.revision) RETURNING * INTO created;
 RETURN to_jsonb(created)||jsonb_build_object('existing',false);
END $$;

-- Called only from an explicit renderer decision. 'pair' permits both directions
-- between these two chats in their current projects; it never broadens tools.
CREATE FUNCTION public.desktop_authorize_chat_delivery(p_user uuid,p_id uuid,p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;scope jsonb;pair desktop_chat_delivery_grants;first_id uuid;second_id uuid;first_project uuid;second_project uuid;
BEGIN
 IF p_decision IS NULL OR p_decision NOT IN('once','pair','deny') THEN RAISE EXCEPTION 'Choose whether to allow this message'; END IF;
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR item.status<>'awaiting_authorization' THEN RAISE EXCEPTION 'This message authorization is no longer active'; END IF;
 IF p_decision='deny' THEN UPDATE desktop_chat_deliveries SET status='denied',error='Declined by you.',updated_at=now() WHERE id=p_id RETURNING * INTO item;RETURN to_jsonb(item);END IF;
 scope=desktop_chat_delivery_snapshot(p_user,item.source_request,(item.snapshot->'source_project'->>'id')::uuid,item.source_thread,item.target_chat,false);
 IF scope IS DISTINCT FROM item.snapshot THEN RAISE EXCEPTION 'The chat, model or permissions changed. Review a fresh message'; END IF;
 IF p_decision='pair' THEN
  first_id=least(item.source_chat,item.target_chat);second_id=greatest(item.source_chat,item.target_chat);
  first_project=CASE WHEN first_id=item.target_chat THEN (scope->'target_project'->>'id')::uuid ELSE (scope->'source_project'->>'id')::uuid END;
  second_project=CASE WHEN second_id=item.target_chat THEN (scope->'target_project'->>'id')::uuid ELSE (scope->'source_project'->>'id')::uuid END;
  INSERT INTO desktop_chat_delivery_grants(user_id,first_chat,second_chat,first_project,second_project) VALUES(p_user,first_id,second_id,first_project,second_project)
  ON CONFLICT(user_id,first_chat,second_chat) DO UPDATE SET enabled=true,revision=desktop_chat_delivery_grants.revision+1,first_project=EXCLUDED.first_project,second_project=EXCLUDED.second_project,updated_at=now() RETURNING * INTO pair;
 END IF;
 UPDATE desktop_chat_deliveries SET authorized_once=p_decision='once',grant_id=pair.id,grant_revision=pair.revision,status='queued',updated_at=now() WHERE id=p_id RETURNING * INTO item;
 RETURN to_jsonb(item);
END $$;

CREATE FUNCTION public.desktop_claim_chat_delivery(p_user uuid,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;scope jsonb;
BEGIN
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This message is unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('chat-delivery-target:'||p_user::text||':'||item.target_chat::text,0));
 IF item.status<>'queued' THEN RETURN to_jsonb(item)||jsonb_build_object('claimed',false);END IF;
 IF NOT item.authorized_once AND NOT EXISTS(SELECT 1 FROM desktop_chat_delivery_grants WHERE id=item.grant_id AND user_id=p_user AND enabled AND revision=item.grant_revision) THEN RAISE EXCEPTION 'Chat coordination permission was revoked or changed'; END IF;
 scope=desktop_chat_delivery_snapshot(p_user,item.source_request,(item.snapshot->'source_project'->>'id')::uuid,item.source_thread,item.target_chat,false);
 IF scope IS DISTINCT FROM item.snapshot THEN RAISE EXCEPTION 'The chat, model or permissions changed. Review this queued message'; END IF;
 -- Serialize against an ordinary turn starting in the same conversation. The
 -- broker must use its existing conversation lock before it claims this row.
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE user_id=p_user AND conversation_id=item.target_chat AND status='running') AND item.delivery='queue' THEN RETURN to_jsonb(item)||jsonb_build_object('claimed',false); END IF;
 IF EXISTS(SELECT 1 FROM desktop_chat_deliveries WHERE user_id=p_user AND target_chat=item.target_chat AND status='dispatching' AND id<>item.id) THEN RETURN to_jsonb(item)||jsonb_build_object('claimed',false); END IF;
 IF item.delivery='queue' AND EXISTS(SELECT 1 FROM desktop_chat_deliveries WHERE user_id=p_user AND target_chat=item.target_chat AND status IN('queued','held') AND (created_at,id)<(item.created_at,item.id)) THEN RETURN to_jsonb(item)||jsonb_build_object('claimed',false); END IF;
 UPDATE desktop_chat_deliveries SET status='dispatching',dispatch_started_at=now(),updated_at=now() WHERE id=p_id RETURNING * INTO item;
 RETURN to_jsonb(item)||jsonb_build_object('claimed',true);
END $$;

CREATE FUNCTION public.desktop_finish_chat_delivery(p_user uuid,p_id uuid,p_status text,p_target_request uuid,p_receipt jsonb,p_error text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;
BEGIN
 IF p_status IS NULL OR p_status NOT IN('delivered','held','cancelled') OR p_receipt IS NOT NULL AND jsonb_typeof(p_receipt)<>'object' THEN RAISE EXCEPTION 'Invalid message delivery result'; END IF;
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR item.status<>'dispatching' THEN RAISE EXCEPTION 'This message is not being dispatched'; END IF;
 IF p_status='delivered' AND NOT EXISTS(SELECT 1 FROM desktop_requests WHERE id=p_target_request AND user_id=p_user AND conversation_id=item.target_chat) THEN RAISE EXCEPTION 'A delivered message needs its actual receiving request'; END IF;
 UPDATE desktop_chat_deliveries SET status=p_status,target_request=p_target_request,receipt=p_receipt,error=left(p_error,2000),updated_at=now() WHERE id=p_id RETURNING * INTO item;
 RETURN to_jsonb(item);
END $$;

CREATE FUNCTION public.desktop_recover_chat_deliveries(p_user uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE changed integer;
BEGIN
 UPDATE desktop_chat_deliveries SET status='held',error=CASE WHEN status='dispatching' THEN 'Agentopia closed while delivering. Inspect the receiving chat before sending again.' ELSE 'Agentopia restarted. Review and resume this message when ready.' END,updated_at=now()
 WHERE user_id=p_user AND status IN('awaiting_authorization','queued','dispatching');GET DIAGNOSTICS changed=ROW_COUNT;RETURN changed;
END $$;

CREATE FUNCTION public.desktop_revoke_chat_delivery_grant(p_user uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE desktop_chat_delivery_grants SET enabled=false,revision=revision+1,updated_at=now() WHERE id=p_id AND user_id=p_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'This chat coordination permission is unavailable'; END IF;
 UPDATE desktop_chat_deliveries SET status='held',error='Chat coordination permission was revoked.',updated_at=now() WHERE user_id=p_user AND grant_id=p_id AND status IN('awaiting_authorization','queued');
END $$;

CREATE FUNCTION public.desktop_change_chat_delivery(p_user uuid,p_id uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;scope jsonb;
BEGIN
 IF p_action IS NULL OR p_action NOT IN('cancel','resume','review') THEN RAISE EXCEPTION 'Choose a message action'; END IF;
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_id AND user_id=p_user FOR UPDATE;
 IF NOT FOUND OR item.status NOT IN('awaiting_authorization','queued','held') THEN RAISE EXCEPTION 'This message is already dispatching or finished. Inspect the receiving chat'; END IF;
 IF p_action='cancel' THEN UPDATE desktop_chat_deliveries SET status='cancelled',error='Cancelled by you.',updated_at=now() WHERE id=p_id RETURNING * INTO item;RETURN to_jsonb(item);END IF;
 IF item.status<>'held' THEN RAISE EXCEPTION 'This message is not held'; END IF;
 IF item.dispatch_started_at IS NOT NULL THEN RAISE EXCEPTION 'This message may already have been delivered. Inspect its receiving chat; do not replay an uncertain send'; END IF;
 scope=desktop_chat_delivery_snapshot(p_user,item.source_request,(item.snapshot->'source_project'->>'id')::uuid,item.source_thread,item.target_chat,false);
 IF scope IS DISTINCT FROM item.snapshot THEN RAISE EXCEPTION 'The chat, model or permissions changed. Compose and review a fresh message'; END IF;
 IF p_action='review' THEN
  UPDATE desktop_chat_deliveries SET status='awaiting_authorization',authorized_once=false,grant_id=NULL,grant_revision=NULL,error=NULL,updated_at=now() WHERE id=p_id RETURNING * INTO item;RETURN to_jsonb(item);
 END IF;
 IF NOT item.authorized_once AND NOT EXISTS(SELECT 1 FROM desktop_chat_delivery_grants WHERE id=item.grant_id AND user_id=p_user AND enabled AND revision=item.grant_revision) THEN RAISE EXCEPTION 'This message needs fresh chat coordination authorization'; END IF;
 UPDATE desktop_chat_deliveries SET status='queued',error=NULL,updated_at=now() WHERE id=p_id RETURNING * INTO item;RETURN to_jsonb(item);
END $$;

-- Called before tools/inference in an accepted receiving request. Its newly
-- saved narrower options do not replace the original reviewed target snapshot.
CREATE FUNCTION public.desktop_validate_chat_delivery(p_user uuid,p_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE item desktop_chat_deliveries;scope jsonb;
BEGIN
 SELECT * INTO item FROM desktop_chat_deliveries WHERE id=p_id AND user_id=p_user;
 IF NOT FOUND OR item.status NOT IN('dispatching','delivered') THEN RAISE EXCEPTION 'This chat message is no longer authorized for execution'; END IF;
 IF NOT item.authorized_once AND NOT EXISTS(SELECT 1 FROM desktop_chat_delivery_grants WHERE id=item.grant_id AND user_id=p_user AND enabled AND revision=item.grant_revision) THEN RAISE EXCEPTION 'Chat coordination permission was revoked or changed'; END IF;
 scope=desktop_chat_delivery_snapshot(p_user,item.source_request,(item.snapshot->'source_project'->>'id')::uuid,item.source_thread,item.target_chat,false);
 IF scope-'target_options' IS DISTINCT FROM item.snapshot-'target_options' THEN RAISE EXCEPTION 'The sending or receiving agent or project changed'; END IF;
END $$;

DO $$ DECLARE signature regprocedure;BEGIN
 FOR signature IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN(
  'desktop_chat_delivery_snapshot','desktop_prepare_chat_delivery','desktop_authorize_chat_delivery','desktop_claim_chat_delivery','desktop_finish_chat_delivery','desktop_recover_chat_deliveries','desktop_revoke_chat_delivery_grant','desktop_change_chat_delivery','desktop_validate_chat_delivery') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
