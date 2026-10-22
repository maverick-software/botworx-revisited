ALTER TABLE public.desktop_agent_profiles ADD COLUMN memory_revision bigint NOT NULL DEFAULT 0;
CREATE FUNCTION public.desktop_agent_memory_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE desktop_agent_profiles SET memory_revision=memory_revision+1 WHERE agent_id=coalesce(NEW.agent_id,OLD.agent_id) AND user_id=coalesce(NEW.user_id,OLD.user_id);
 RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER desktop_agent_memory_changed AFTER INSERT OR UPDATE OR DELETE ON public.desktop_agent_memories FOR EACH ROW EXECUTE FUNCTION public.desktop_agent_memory_changed();
REVOKE ALL ON FUNCTION public.desktop_agent_memory_changed() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.desktop_select_chat_agent(p_user uuid,p_conversation uuid,p_agent uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This conversation is unavailable'; END IF;
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM desktop_requests WHERE conversation_id=p_conversation AND user_id=p_user AND status='running')
  OR EXISTS(SELECT 1 FROM desktop_goals WHERE conversation_id=p_conversation AND user_id=p_user AND status='running') THEN RAISE EXCEPTION 'Finish or pause the active work before switching agents'; END IF;
 INSERT INTO desktop_agent_participants(user_id,conversation_id,agent_id) VALUES(p_user,p_conversation,p_agent) ON CONFLICT DO NOTHING;
 UPDATE conversation_sessions SET session_state=coalesce(session_state,'{}')||jsonb_build_object('desktop_active_agent',p_agent) WHERE conversation_id=p_conversation AND user_id=p_user;
END $$;

-- The native supervisor binds and validates the actual calling thread before
-- passing it here. Completed root requests can still own active child/report turns.
CREATE FUNCTION public.desktop_agent_request_scope(p_user uuid,p_request uuid,p_thread text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE instance desktop_agent_instances;membership uuid;profile jsonb;
BEGIN
 SELECT i.* INTO instance FROM desktop_requests r JOIN desktop_agent_instances i ON i.id=r.agent_instance_id AND i.user_id=r.user_id
  WHERE r.id=p_request AND r.user_id=p_user AND r.agent_id=i.agent_id AND (
   r.status='running' OR p_thread IS NOT NULL AND EXISTS(SELECT 1 FROM desktop_codex_turns t WHERE t.request_id=r.id AND t.user_id=p_user AND (
    t.state->>'threadId'=p_thread OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(t.state->'children','[]')) c WHERE c->>'threadId'=p_thread)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(t.state->'reports','[]')) report WHERE report->'state'->>'threadId'=p_thread)))
  ) FOR SHARE OF i,r;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agent assignment is no longer active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=instance.agent_id AND user_id=p_user AND active) THEN RAISE EXCEPTION 'This agent has been retired'; END IF;
 SELECT project_id INTO membership FROM desktop_project_chats WHERE conversation_id=instance.conversation_id AND user_id=p_user;
 IF membership IS DISTINCT FROM instance.project_id THEN RAISE EXCEPTION 'This assignment moved to another project'; END IF;
 profile=desktop_agent_profile(p_user,instance.agent_id);
 IF (profile->>'revision')::bigint<>instance.agent_revision THEN RAISE EXCEPTION 'This agent definition changed. Start a fresh response with its current policy'; END IF;
 RETURN jsonb_build_object('instance',to_jsonb(instance),'profile',profile);
END $$;

CREATE FUNCTION public.desktop_set_agent_project_isolation(p_user uuid,p_project uuid,p_revision bigint,p_isolated boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result desktop_projects;
BEGIN
 IF p_isolated IS NULL THEN RAISE EXCEPTION 'Choose an agent memory isolation setting'; END IF;
 UPDATE desktop_projects SET agent_memory_isolated=p_isolated,revision=revision+1 WHERE id=p_project AND user_id=p_user AND revision=p_revision RETURNING * INTO result;
 IF NOT FOUND THEN RAISE EXCEPTION 'This project changed or is unavailable. Reload its settings'; END IF;
 RETURN to_jsonb(result);
END $$;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['desktop_select_chat_agent(uuid,uuid,uuid)','desktop_agent_request_scope(uuid,uuid,text)','desktop_set_agent_project_isolation(uuid,uuid,bigint,boolean)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||signature||' TO service_role';
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
