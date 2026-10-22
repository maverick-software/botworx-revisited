-- Desktop transactions. This migration is applied only to Agentopia's dedicated runtime.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS reasoning_config jsonb NOT NULL DEFAULT '{"enabled":false}'::jsonb;
DROP TRIGGER IF EXISTS trigger_grant_reasoning_access_to_new_agent ON public.agents;
INSERT INTO public.roles(name,description) VALUES ('admin','Administrator'),('user','Standard user') ON CONFLICT(name) DO NOTHING;
CREATE OR REPLACE FUNCTION public.assign_local_user_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO user_roles(user_id,role_id) SELECT NEW.id,id FROM roles WHERE name='user' ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assign_local_user_role_after_signup ON auth.users;
CREATE TRIGGER assign_local_user_role_after_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_local_user_role();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
ALTER FUNCTION public.auto_create_contact_management_credential() SET search_path=public,extensions;
ALTER FUNCTION public.create_contact_management_credential_for_user(uuid) SET search_path=public,extensions;

CREATE TABLE public.desktop_requests (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id),
 agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES public.conversation_sessions(conversation_id) ON DELETE CASCADE,
 user_message_id uuid NOT NULL, assistant_message_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','cancelled','failed','interrupted')),
 error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX desktop_one_running_per_conversation ON public.desktop_requests(conversation_id) WHERE status='running';
ALTER TABLE public.desktop_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_requests_owner ON public.desktop_requests FOR SELECT TO authenticated USING(user_id=auth.uid());
GRANT SELECT ON public.desktop_requests TO authenticated;
GRANT ALL ON public.desktop_requests TO service_role;

-- Replace legacy overlapping policies for the four private core resources.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'
 AND tablename IN ('agents','agent_llm_preferences','conversation_sessions','chat_messages_v2') LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
END $$;
CREATE POLICY desktop_agents_owner ON public.agents FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY desktop_preferences_owner ON public.agent_llm_preferences FOR ALL TO authenticated
 USING(EXISTS(SELECT 1 FROM public.agents a WHERE a.id=agent_id AND a.user_id=auth.uid()))
 WITH CHECK(EXISTS(SELECT 1 FROM public.agents a WHERE a.id=agent_id AND a.user_id=auth.uid()));
CREATE POLICY desktop_sessions_owner ON public.conversation_sessions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY desktop_messages_owner ON public.chat_messages_v2 FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.conversation_sessions c WHERE c.conversation_id=chat_messages_v2.conversation_id AND c.user_id=auth.uid()));

CREATE FUNCTION public.desktop_save_agent(p_user uuid,p_id uuid,p_name text,p_description text,p_instructions text,p_provider text,p_model text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE result uuid;
BEGIN
 IF length(trim(p_name)) NOT BETWEEN 1 AND 100 OR p_provider NOT IN ('openrouter','openai-oauth') OR length(p_model) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid agent settings'; END IF;
 IF p_id IS NULL THEN
 INSERT INTO agents(user_id,name,description,system_instructions,assistant_instructions,active,reasoning_config)
 VALUES(p_user,trim(p_name),p_description,p_instructions,p_instructions,true,'{"enabled":false}') RETURNING id INTO result;
 ELSE
 UPDATE agents SET name=trim(p_name),description=p_description,system_instructions=p_instructions,assistant_instructions=p_instructions,reasoning_config='{"enabled":false}'
 WHERE id=p_id AND user_id=p_user RETURNING id INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Agent not found'; END IF;
 END IF;
 -- The existing trigger creates exactly one default preference row.
 UPDATE agent_llm_preferences SET provider=p_provider,model=p_model,params='{}',updated_at=now() WHERE agent_id=result;
 RETURN result;
END $$;

CREATE FUNCTION public.desktop_begin_chat(p_user uuid,p_request uuid,p_agent uuid,p_conversation uuid,p_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE r desktop_requests; c conversation_sessions; uid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid();
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO r FROM desktop_requests WHERE id=p_request;
 IF FOUND THEN
  IF r.user_id<>p_user OR r.agent_id<>p_agent OR (p_conversation IS NOT NULL AND r.conversation_id<>p_conversation)
    OR NOT EXISTS(SELECT 1 FROM chat_messages_v2 WHERE id=r.user_message_id AND content->>'text'=p_text) THEN RAISE EXCEPTION 'Request identifier already used'; END IF;
  RETURN to_jsonb(r)||jsonb_build_object('existing',true);
 END IF;
 IF length(trim(p_text)) NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Message must contain between 1 and 100000 characters'; END IF;
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active) THEN RAISE EXCEPTION 'Agent not found'; END IF;
 IF p_conversation IS NULL THEN
  INSERT INTO conversation_sessions(conversation_id,user_id,agent_id,title) VALUES(gen_random_uuid(),p_user,p_agent,left(trim(p_text),80)) RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM conversation_sessions WHERE conversation_id=p_conversation AND user_id=p_user AND agent_id=p_agent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversation not found'; END IF;
 END IF;
 INSERT INTO chat_messages_v2(id,conversation_id,session_id,sender_user_id,role,content,metadata)
 VALUES(uid,c.conversation_id,c.id,p_user,'user',jsonb_build_object('type','text','text',p_text),jsonb_build_object('request_id',p_request));
 INSERT INTO chat_messages_v2(id,conversation_id,session_id,sender_agent_id,role,content,metadata)
 VALUES(aid,c.conversation_id,c.id,p_agent,'assistant',jsonb_build_object('type','text','text',''),jsonb_build_object('request_id',p_request,'status','running'));
 INSERT INTO desktop_requests(id,user_id,agent_id,conversation_id,user_message_id,assistant_message_id,status)
 VALUES(p_request,p_user,p_agent,c.conversation_id,uid,aid,'running') RETURNING * INTO r;
 UPDATE conversation_sessions SET message_count=message_count+2,last_active=now() WHERE id=c.id;
 RETURN to_jsonb(r)||jsonb_build_object('existing',false);
END $$;

CREATE FUNCTION public.desktop_checkpoint_chat(p_user uuid,p_request uuid,p_text text,p_status text,p_error text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r desktop_requests;
BEGIN
 IF p_status NOT IN ('running','completed','cancelled','failed','interrupted') THEN RAISE EXCEPTION 'Invalid response status'; END IF;
 SELECT * INTO r FROM desktop_requests WHERE id=p_request AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.status<>'running' THEN RETURN; END IF;
 UPDATE chat_messages_v2 SET content=jsonb_build_object('type','text','text',p_text),metadata=metadata||jsonb_build_object('status',p_status,'error',p_error),updated_at=now() WHERE id=r.assistant_message_id;
 UPDATE desktop_requests SET status=p_status,error=p_error,updated_at=now() WHERE id=p_request;
END $$;

CREATE FUNCTION public.desktop_set_admin(p_actor uuid,p_target uuid,p_admin boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role_id_admin uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(724919004);
 IF NOT public.user_has_role(p_actor,'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 SELECT id INTO role_id_admin FROM roles WHERE name='admin';
 IF p_admin THEN INSERT INTO user_roles(user_id,role_id) VALUES(p_target,role_id_admin) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM user_roles WHERE user_id=p_target AND role_id=role_id_admin; END IF;
END $$;

CREATE FUNCTION public.desktop_guard_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE target uuid; removes boolean:=false;
BEGIN
 PERFORM pg_advisory_xact_lock(724919004);
 IF TG_TABLE_NAME='user_roles' THEN
  target:=OLD.user_id;
  removes:=EXISTS(SELECT 1 FROM roles WHERE id=OLD.role_id AND name='admin') AND
    (TG_OP='DELETE' OR NEW.user_id<>OLD.user_id OR NEW.role_id<>OLD.role_id);
 ELSE
  target:=OLD.id;
  removes:=TG_OP='DELETE' OR NEW.banned_until>now();
 END IF;
 IF removes AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN auth.users u ON u.id=ur.user_id
   WHERE ur.user_id=target AND r.name='admin' AND (u.banned_until IS NULL OR u.banned_until<=now()))
 AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN auth.users u ON u.id=ur.user_id
   WHERE ur.user_id<>target AND r.name='admin' AND (u.banned_until IS NULL OR u.banned_until<=now())) THEN
  RAISE EXCEPTION 'The last active administrator must remain enabled';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER desktop_keep_admin_role BEFORE DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.desktop_guard_admin();
CREATE TRIGGER desktop_keep_admin_account BEFORE DELETE OR UPDATE OF banned_until ON auth.users FOR EACH ROW EXECUTE FUNCTION public.desktop_guard_admin();

-- Only the trusted desktop broker may call the service transactions.
REVOKE ALL ON FUNCTION public.desktop_save_agent(uuid,uuid,text,text,text,text,text),public.desktop_begin_chat(uuid,uuid,uuid,uuid,text),public.desktop_checkpoint_chat(uuid,uuid,text,text,text),public.desktop_set_admin(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_save_agent(uuid,uuid,text,text,text,text,text),public.desktop_begin_chat(uuid,uuid,uuid,uuid,text),public.desktop_checkpoint_chat(uuid,uuid,text,text,text),public.desktop_set_admin(uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
