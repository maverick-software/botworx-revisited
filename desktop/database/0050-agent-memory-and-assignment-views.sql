CREATE FUNCTION public.desktop_agent_memory_visible(p_user uuid,p_project uuid,p_memory uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM desktop_agent_memories m WHERE m.id=p_memory AND m.user_id=p_user
  AND desktop_agent_project_visible(p_user,p_project,m.project_id)
  AND (m.source_conversation_id IS NULL OR EXISTS(SELECT 1 FROM conversation_sessions c
   LEFT JOIN desktop_project_chats pc ON pc.conversation_id=c.conversation_id AND pc.user_id=p_user
   WHERE c.conversation_id=m.source_conversation_id AND c.user_id=p_user AND pc.project_id IS NOT DISTINCT FROM m.project_id
    AND coalesce(c.session_state->>'desktop_archived','false')<>'true')))
$$;
CREATE FUNCTION public.desktop_agent_instance_visible(p_user uuid,p_project uuid,p_instance uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM desktop_agent_instances i JOIN conversation_sessions c ON c.conversation_id=i.conversation_id AND c.user_id=p_user
  LEFT JOIN desktop_project_chats pc ON pc.conversation_id=c.conversation_id AND pc.user_id=p_user
  WHERE i.id=p_instance AND i.user_id=p_user AND desktop_agent_project_visible(p_user,p_project,i.project_id)
   AND pc.project_id IS NOT DISTINCT FROM i.project_id AND coalesce(c.session_state->>'desktop_archived','false')<>'true')
$$;

CREATE FUNCTION public.desktop_agent_instance_snapshot(p_user uuid,p_project uuid,p_instance uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE instance desktop_agent_instances;request desktop_requests;native desktop_codex_turns;pending boolean;working boolean;interrupted boolean;failed boolean;phase text;name text;project_name text;
BEGIN
 IF NOT desktop_agent_instance_visible(p_user,p_project,p_instance) THEN RAISE EXCEPTION 'This assignment is unavailable in the current project scope'; END IF;
 SELECT * INTO instance FROM desktop_agent_instances WHERE id=p_instance AND user_id=p_user;
 SELECT * INTO request FROM desktop_requests WHERE id=instance.request_id AND user_id=p_user;
 SELECT * INTO native FROM desktop_codex_turns WHERE request_id=instance.request_id AND user_id=p_user;
 pending=EXISTS(SELECT 1 FROM desktop_tool_calls WHERE request_id=instance.request_id AND user_id=p_user AND status='awaiting_approval')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(native.state->'approvals','[]')) a WHERE a->>'status'='pending');
 working=EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(native.state->'children','[]')) c WHERE c->>'status'='running' OR c->>'delivery'='running' OR c->>'delivery'='waiting' AND c->>'status' NOT IN('interrupted','running'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(native.state->'reports','[]')) report WHERE report->>'status'='running');
 interrupted=EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(native.state->'children','[]')) c WHERE c->>'status'='interrupted');
 failed=EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(native.state->'children','[]')) c WHERE c->>'status'='failed');
 phase=CASE WHEN pending THEN 'awaiting_approval' WHEN request.status='running' OR working THEN 'running' WHEN interrupted AND request.status='completed' THEN 'interrupted' WHEN failed AND request.status='completed' THEN 'failed' ELSE coalesce(request.status,instance.status) END;
 SELECT definition->>'name' INTO name FROM desktop_agent_definition_revisions WHERE agent_id=instance.agent_id AND revision=instance.agent_revision AND user_id=p_user;
 SELECT p.name INTO project_name FROM desktop_projects p WHERE p.id=instance.project_id AND p.user_id=p_user;
 RETURN to_jsonb(instance)||jsonb_build_object('status',phase,'primary_status',request.status,'agent_name',name,'project_name',project_name,'error',request.error,
  'updated_at',greatest(instance.updated_at,request.updated_at,native.updated_at),'active_children',(SELECT count(*) FROM jsonb_array_elements(coalesce(native.state->'children','[]')) c WHERE c->>'status'='running'));
END $$;

CREATE FUNCTION public.desktop_list_agent_instances(p_user uuid,p_agent uuid,p_project uuid,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user) THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Choose 1 to 100 assignments'; END IF;
 IF p_project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user) THEN RAISE EXCEPTION 'This project is unavailable'; END IF;
 SELECT coalesce(jsonb_agg(snapshot ORDER BY stamp DESC,id),'[]') INTO result FROM (
  SELECT i.id,desktop_agent_instance_snapshot(p_user,p_project,i.id) AS snapshot,greatest(i.updated_at,r.updated_at,t.updated_at) AS stamp
   FROM desktop_agent_instances i LEFT JOIN desktop_requests r ON r.id=i.request_id AND r.user_id=p_user LEFT JOIN desktop_codex_turns t ON t.request_id=i.request_id AND t.user_id=p_user
   WHERE i.user_id=p_user AND i.agent_id=p_agent AND desktop_agent_instance_visible(p_user,p_project,i.id)
   ORDER BY stamp DESC,i.id LIMIT p_limit
 ) hits;
 RETURN result;
END $$;

DO $$ DECLARE definition text; BEGIN
 definition=pg_get_functiondef('public.desktop_search_agent_memory(uuid,uuid,uuid,text,integer)'::regprocedure);
 IF strpos(definition,'AND desktop_agent_project_visible(p_user,p_project,m.project_id)')=0 THEN RAISE EXCEPTION 'Unrecognized agent memory search definition'; END IF;
 definition=replace(definition,'AND desktop_agent_project_visible(p_user,p_project,m.project_id)','AND desktop_agent_memory_visible(p_user,p_project,m.id)');
 EXECUTE definition;
END $$;

CREATE FUNCTION public.desktop_validate_agent_snapshot(p_user uuid,p_agent uuid,p_project uuid,p_memories uuid[],p_instances uuid[]) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF cardinality(p_memories)>30 OR cardinality(p_instances)>100 THEN RAISE EXCEPTION 'Too many agent memory sources'; END IF;
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user) THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_memories) AS selected(id) WHERE NOT EXISTS(SELECT 1 FROM desktop_agent_memories m WHERE m.id=selected.id AND m.user_id=p_user AND m.agent_id=p_agent AND desktop_agent_memory_visible(p_user,p_project,m.id)))
  OR EXISTS(SELECT 1 FROM unnest(p_instances) AS selected(id) WHERE NOT EXISTS(SELECT 1 FROM desktop_agent_instances i WHERE i.id=selected.id AND i.user_id=p_user AND i.agent_id=p_agent AND desktop_agent_instance_visible(p_user,p_project,i.id))) THEN
  RAISE EXCEPTION 'An agent memory source changed or was isolated. Start a fresh response with current context';
 END IF;
 RETURN true;
END $$;

CREATE FUNCTION public.desktop_agent_source_context_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source uuid;
BEGIN
 IF TG_TABLE_NAME='desktop_projects' THEN
  IF NEW.agent_memory_isolated IS DISTINCT FROM OLD.agent_memory_isolated THEN UPDATE desktop_agent_profiles SET memory_revision=memory_revision+1 WHERE user_id=NEW.user_id; END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='conversation_sessions' THEN
  IF coalesce(NEW.session_state->>'desktop_archived','false') IS NOT DISTINCT FROM coalesce(OLD.session_state->>'desktop_archived','false') THEN RETURN NEW; END IF;
  source=NEW.conversation_id;
 ELSE
  source=coalesce(NEW.conversation_id,OLD.conversation_id);
 END IF;
 UPDATE desktop_agent_profiles p SET memory_revision=memory_revision+1 WHERE EXISTS(SELECT 1 FROM desktop_agent_memories m WHERE m.agent_id=p.agent_id AND m.user_id=p.user_id AND m.source_conversation_id=source)
  OR EXISTS(SELECT 1 FROM desktop_agent_instances i WHERE i.agent_id=p.agent_id AND i.user_id=p.user_id AND i.conversation_id=source);
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER desktop_agent_project_isolation_changed AFTER UPDATE OF agent_memory_isolated ON public.desktop_projects FOR EACH ROW EXECUTE FUNCTION public.desktop_agent_source_context_changed();
CREATE TRIGGER desktop_agent_source_archive_changed AFTER UPDATE OF session_state ON public.conversation_sessions FOR EACH ROW EXECUTE FUNCTION public.desktop_agent_source_context_changed();
CREATE TRIGGER desktop_agent_source_project_changed AFTER INSERT OR UPDATE OR DELETE ON public.desktop_project_chats FOR EACH ROW EXECUTE FUNCTION public.desktop_agent_source_context_changed();
REVOKE ALL ON FUNCTION public.desktop_agent_source_context_changed() FROM PUBLIC,anon,authenticated;

-- A new plan follows its actual creating agent. An existing plan/goal keeps its
-- stored owner until the human explicitly chooses a different assignment.
DO $$ DECLARE definition text;needle text:='VALUES(p_user,p_conversation,chat.agent_id,trim(p_title)'; BEGIN
 definition=pg_get_functiondef('public.desktop_save_plan(uuid,uuid,text,text,jsonb,bigint,uuid)'::regprocedure);
 IF strpos(definition,needle)=0 THEN RAISE EXCEPTION 'Unrecognized plan author boundary'; END IF;
 definition=replace(definition,needle,'VALUES(p_user,p_conversation,coalesce((SELECT agent_id FROM desktop_requests WHERE id=p_request AND user_id=p_user AND conversation_id=p_conversation),(chat.session_state->>''desktop_active_agent'')::uuid,chat.agent_id),trim(p_title)');
 EXECUTE definition;
END $$;

DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['desktop_agent_memory_visible(uuid,uuid,uuid)','desktop_agent_instance_visible(uuid,uuid,uuid)','desktop_agent_instance_snapshot(uuid,uuid,uuid)','desktop_list_agent_instances(uuid,uuid,uuid,integer)','desktop_validate_agent_snapshot(uuid,uuid,uuid,uuid[],uuid[])'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||signature||' TO service_role';
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
