-- Agent identity is independent of any one chat. Existing migrations stay immutable.
ALTER TABLE public.agents ADD CONSTRAINT desktop_agents_owned_id UNIQUE(id,user_id);
ALTER TABLE public.conversation_sessions ADD CONSTRAINT desktop_conversations_owned_id UNIQUE(conversation_id,user_id);
ALTER TABLE public.chat_messages_v2 ADD CONSTRAINT desktop_messages_conversation_id UNIQUE(id,conversation_id);
ALTER TABLE public.desktop_projects ADD COLUMN agent_memory_isolated boolean NOT NULL DEFAULT false;

CREATE TABLE public.desktop_agent_profiles(
 agent_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 handle text NOT NULL CHECK(handle ~ '^[a-z][a-z0-9_-]{1,63}$'),
 role text NOT NULL DEFAULT '' CHECK(length(role)<=1000),sops text NOT NULL DEFAULT '' CHECK(length(sops)<=50000),
 guardrails text NOT NULL DEFAULT '' CHECK(length(guardrails)<=20000),
 skills jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(skills)='array' AND jsonb_array_length(skills)<=30),
 policy jsonb NOT NULL DEFAULT '{"tools":null,"delegation":true,"delegateAgents":null,"memory":true,"memoryWrite":true,"maxDepth":2,"maxTurns":10}',
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),definition jsonb NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,handle),UNIQUE(agent_id,user_id),
 FOREIGN KEY(agent_id,user_id) REFERENCES public.agents(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.desktop_agent_definition_revisions(
 agent_id uuid NOT NULL,user_id uuid NOT NULL,revision bigint NOT NULL,definition jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(agent_id,revision),
 FOREIGN KEY(agent_id,user_id) REFERENCES public.desktop_agent_profiles(agent_id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.desktop_agent_participants(
 user_id uuid NOT NULL,conversation_id uuid NOT NULL,agent_id uuid NOT NULL,
 joined_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(conversation_id,agent_id),
 FOREIGN KEY(conversation_id,user_id) REFERENCES public.conversation_sessions(conversation_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(agent_id,user_id) REFERENCES public.agents(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.desktop_agent_instances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL,agent_revision bigint NOT NULL,conversation_id uuid NOT NULL,project_id uuid,
 parent_instance_id uuid,depth integer NOT NULL DEFAULT 0 CHECK(depth BETWEEN 0 AND 4),
 assignment text NOT NULL CHECK(length(assignment) BETWEEN 1 AND 8000),
 status text NOT NULL DEFAULT 'ready' CHECK(status IN('ready','queued','running','awaiting_approval','completed','failed','cancelled','interrupted')),
 checkpoint text NOT NULL DEFAULT '' CHECK(length(checkpoint)<=8000),request_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(id,user_id),
 FOREIGN KEY(agent_id,user_id) REFERENCES public.agents(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(agent_id,agent_revision) REFERENCES public.desktop_agent_definition_revisions(agent_id,revision),
 FOREIGN KEY(conversation_id,user_id) REFERENCES public.conversation_sessions(conversation_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,user_id) REFERENCES public.desktop_projects(id,user_id) ON DELETE SET NULL(project_id),
 FOREIGN KEY(parent_instance_id,user_id) REFERENCES public.desktop_agent_instances(id,user_id) ON DELETE SET NULL(parent_instance_id)
);
CREATE INDEX desktop_agent_instances_work ON public.desktop_agent_instances(user_id,agent_id,updated_at DESC,id);
ALTER TABLE public.desktop_requests ADD COLUMN agent_instance_id uuid REFERENCES public.desktop_agent_instances(id) ON DELETE SET NULL;
CREATE TABLE public.desktop_agent_invocations(
 user_id uuid NOT NULL,caller_instance_id uuid NOT NULL,call_id text NOT NULL CHECK(length(call_id) BETWEEN 1 AND 300),
 target_agent_id uuid NOT NULL,payload jsonb NOT NULL,request_id uuid NOT NULL UNIQUE,
 child_instance_id uuid,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(caller_instance_id,call_id),
 FOREIGN KEY(caller_instance_id,user_id) REFERENCES public.desktop_agent_instances(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(target_agent_id,user_id) REFERENCES public.agents(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(child_instance_id,user_id) REFERENCES public.desktop_agent_instances(id,user_id) ON DELETE SET NULL(child_instance_id)
);
CREATE TABLE public.desktop_agent_memories(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 agent_id uuid NOT NULL,project_id uuid,instance_id uuid,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),content text NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 12000),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),source_message_id uuid,source_conversation_id uuid,
 authored_by text NOT NULL CHECK(authored_by IN('user','agent')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((source_message_id IS NULL)=(source_conversation_id IS NULL)),
 FOREIGN KEY(agent_id,user_id) REFERENCES public.agents(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(project_id,user_id) REFERENCES public.desktop_projects(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(instance_id,user_id) REFERENCES public.desktop_agent_instances(id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(source_message_id,source_conversation_id) REFERENCES public.chat_messages_v2(id,conversation_id) ON DELETE CASCADE
);
CREATE INDEX desktop_agent_memory_search ON public.desktop_agent_memories USING gin(to_tsvector('english',title||' '||content));
CREATE INDEX desktop_agent_memory_owner ON public.desktop_agent_memories(user_id,agent_id,updated_at DESC,id);
CREATE TABLE public.desktop_agent_memory_revisions(
 memory_id uuid NOT NULL REFERENCES public.desktop_agent_memories(id) ON DELETE CASCADE,
 revision bigint NOT NULL,content jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(memory_id,revision)
);

-- Only the authenticated host may mutate these records. SELECT remains owner-scoped.
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['desktop_agent_profiles','desktop_agent_definition_revisions','desktop_agent_participants','desktop_agent_instances','desktop_agent_invocations','desktop_agent_memories'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING(user_id=auth.uid())',name||'_owner',name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',name);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',name);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',name);
 END LOOP;
END $$;
ALTER TABLE public.desktop_agent_memory_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY desktop_agent_memory_revisions_owner ON public.desktop_agent_memory_revisions FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.desktop_agent_memories m WHERE m.id=memory_id AND m.user_id=auth.uid()));
REVOKE ALL ON public.desktop_agent_memory_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.desktop_agent_memory_revisions TO authenticated;
GRANT ALL ON public.desktop_agent_memory_revisions TO service_role;

CREATE FUNCTION public.desktop_agent_profile(p_user uuid,p_agent uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a agents;p desktop_agent_profiles;snapshot jsonb;preferences jsonb;
BEGIN
 SELECT * INTO a FROM agents WHERE id=p_agent AND user_id=p_user FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agent is unavailable for your account'; END IF;
 INSERT INTO desktop_agent_profiles(agent_id,user_id,handle) VALUES(p_agent,p_user,'agent-'||replace(p_agent::text,'-','')) ON CONFLICT(agent_id) DO NOTHING;
 SELECT * INTO p FROM desktop_agent_profiles WHERE agent_id=p_agent AND user_id=p_user FOR UPDATE;
 SELECT jsonb_build_object('provider',provider,'model',model) INTO preferences FROM agent_llm_preferences WHERE agent_id=p_agent LIMIT 1;
 snapshot=jsonb_build_object('name',a.name,'description',a.description,'instructions',coalesce(a.system_instructions,a.assistant_instructions,''),
  'personality',a.personality,'active',a.active,'handle',p.handle,'role',p.role,'sops',p.sops,'guardrails',p.guardrails,'skills',p.skills,'policy',p.policy,'model',preferences);
 IF p.definition IS DISTINCT FROM snapshot OR p.revision=0 THEN
  UPDATE desktop_agent_profiles SET definition=snapshot,revision=revision+1,updated_at=now() WHERE agent_id=p_agent AND user_id=p_user RETURNING * INTO p;
  INSERT INTO desktop_agent_definition_revisions(agent_id,user_id,revision,definition) VALUES(p_agent,p_user,p.revision,snapshot);
 END IF;
 RETURN to_jsonb(p);
END $$;

CREATE FUNCTION public.desktop_save_agent_profile(p_user uuid,p_agent uuid,p_revision bigint,p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_value jsonb;
BEGIN
 current_value=desktop_agent_profile(p_user,p_agent);
 IF (current_value->>'revision')::bigint IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'This agent changed. Reload its definition before saving'; END IF;
 IF jsonb_typeof(p_value->'policy') IS DISTINCT FROM 'object' OR jsonb_typeof(p_value->'skills') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid agent configuration'; END IF;
 UPDATE desktop_agent_profiles SET handle=p_value->>'handle',role=p_value->>'role',sops=p_value->>'sops',guardrails=p_value->>'guardrails',skills=p_value->'skills',policy=p_value->'policy' WHERE agent_id=p_agent AND user_id=p_user;
 RETURN desktop_agent_profile(p_user,p_agent);
END $$;

-- Isolation applies in both directions, including projectless assignments.
CREATE FUNCTION public.desktop_agent_project_visible(p_user uuid,p_context uuid,p_source uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE isolated boolean;source_isolated boolean;
BEGIN
 IF p_context IS NOT NULL THEN
  SELECT agent_memory_isolated INTO isolated FROM desktop_projects WHERE id=p_context AND user_id=p_user;
  IF NOT FOUND THEN RETURN false; END IF;
  IF isolated THEN RETURN p_source IS NOT DISTINCT FROM p_context; END IF;
 END IF;
 IF p_source IS NULL THEN RETURN true; END IF;
 SELECT agent_memory_isolated INTO source_isolated FROM desktop_projects WHERE id=p_source AND user_id=p_user;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN NOT source_isolated OR p_source IS NOT DISTINCT FROM p_context;
END $$;

CREATE FUNCTION public.desktop_agent_request(p_user uuid,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE instance desktop_agent_instances;membership uuid;profile jsonb;
BEGIN
 SELECT i.* INTO instance FROM desktop_requests r JOIN desktop_agent_instances i ON i.id=r.agent_instance_id AND i.user_id=r.user_id
  WHERE r.id=p_request AND r.user_id=p_user AND r.status='running' AND r.agent_id=i.agent_id FOR SHARE OF i,r;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agent assignment is no longer active'; END IF;
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=instance.agent_id AND user_id=p_user AND active) THEN RAISE EXCEPTION 'This agent has been retired'; END IF;
 SELECT project_id INTO membership FROM desktop_project_chats WHERE conversation_id=instance.conversation_id AND user_id=p_user;
 IF membership IS DISTINCT FROM instance.project_id THEN RAISE EXCEPTION 'This assignment moved to another project'; END IF;
 profile=desktop_agent_profile(p_user,instance.agent_id);
 IF (profile->>'revision')::bigint<>instance.agent_revision THEN RAISE EXCEPTION 'This agent definition changed. Start a fresh response with its current policy'; END IF;
 RETURN jsonb_build_object('instance',to_jsonb(instance),'profile',profile);
END $$;

CREATE FUNCTION public.desktop_search_agent_memory(p_user uuid,p_agent uuid,p_project uuid,p_query text,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE query tsquery;result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM agents WHERE id=p_agent AND user_id=p_user) THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 30 OR p_query IS NULL OR length(p_query)>500 THEN RAISE EXCEPTION 'Use up to 500 characters and 1 to 30 results'; END IF;
 IF p_project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user) THEN RAISE EXCEPTION 'This project is unavailable'; END IF;
 query=websearch_to_tsquery('english',p_query);
 SELECT coalesce(jsonb_agg(to_jsonb(hit)),'[]') INTO result FROM (
  SELECT m.* FROM desktop_agent_memories m WHERE m.user_id=p_user AND m.agent_id=p_agent
   AND desktop_agent_project_visible(p_user,p_project,m.project_id)
   AND (m.source_conversation_id IS NULL OR EXISTS(SELECT 1 FROM conversation_sessions c WHERE c.conversation_id=m.source_conversation_id AND c.user_id=p_user AND coalesce(c.session_state->>'desktop_archived','false')<>'true'))
   AND (trim(p_query)='' OR to_tsvector('english',m.title||' '||m.content)@@query)
  ORDER BY CASE WHEN trim(p_query)='' THEN 0 ELSE ts_rank_cd(to_tsvector('english',m.title||' '||m.content),query) END DESC,m.updated_at DESC,m.id LIMIT p_limit
 ) hit;
 RETURN result;
END $$;

CREATE FUNCTION public.desktop_save_agent_memory(p_user uuid,p_agent uuid,p_instance uuid,p_id uuid,p_revision bigint,p_title text,p_content text,p_source uuid,p_project uuid,p_author text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result desktop_agent_memories;source_chat uuid;source_project uuid;
BEGIN
 PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This agent is unavailable'; END IF;
 IF p_author NOT IN('user','agent') OR p_title IS NULL OR p_content IS NULL THEN RAISE EXCEPTION 'Invalid memory record'; END IF;
 IF p_instance IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_agent_instances WHERE id=p_instance AND user_id=p_user AND agent_id=p_agent AND project_id IS NOT DISTINCT FROM p_project) THEN RAISE EXCEPTION 'This memory assignment is unavailable'; END IF;
 IF p_project IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_projects WHERE id=p_project AND user_id=p_user) THEN RAISE EXCEPTION 'This memory project is unavailable'; END IF;
 IF p_source IS NOT NULL THEN
  SELECT m.conversation_id,pc.project_id INTO source_chat,source_project FROM chat_messages_v2 m JOIN conversation_sessions c ON c.conversation_id=m.conversation_id AND c.user_id=p_user
   LEFT JOIN desktop_project_chats pc ON pc.conversation_id=c.conversation_id AND pc.user_id=p_user
   WHERE m.id=p_source AND m.role IN('user','assistant') AND (m.role='user' OR m.metadata->>'status'='completed')
    AND (m.sender_agent_id=p_agent OR EXISTS(SELECT 1 FROM desktop_requests r WHERE r.user_message_id=m.id AND r.agent_id=p_agent AND r.user_id=p_user));
  IF NOT FOUND OR source_project IS DISTINCT FROM p_project THEN RAISE EXCEPTION 'Choose a source from this agent and project'; END IF;
 ELSIF p_author='agent' THEN RAISE EXCEPTION 'Agent memories require a saved source'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO desktop_agent_memories(user_id,agent_id,instance_id,project_id,title,content,source_message_id,source_conversation_id,authored_by)
   VALUES(p_user,p_agent,p_instance,p_project,trim(p_title),trim(p_content),p_source,source_chat,p_author) RETURNING * INTO result;
 ELSE
  UPDATE desktop_agent_memories SET title=trim(p_title),content=trim(p_content),revision=revision+1,source_message_id=p_source,source_conversation_id=source_chat,authored_by=p_author,updated_at=now()
   WHERE id=p_id AND user_id=p_user AND agent_id=p_agent AND project_id IS NOT DISTINCT FROM p_project AND revision=p_revision RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'This memory changed or is unavailable. Read it before updating'; END IF;
 END IF;
 INSERT INTO desktop_agent_memory_revisions(memory_id,revision,content) VALUES(result.id,result.revision,to_jsonb(result));
 RETURN to_jsonb(result);
END $$;

DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'desktop_agent_profile(uuid,uuid)','desktop_save_agent_profile(uuid,uuid,bigint,jsonb)',
  'desktop_agent_project_visible(uuid,uuid,uuid)','desktop_agent_request(uuid,uuid)',
  'desktop_search_agent_memory(uuid,uuid,uuid,text,integer)',
  'desktop_save_agent_memory(uuid,uuid,uuid,uuid,bigint,text,text,uuid,uuid,text)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||signature||' TO service_role';
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
