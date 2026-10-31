-- Standalone skills own their data and grants. Tool-less private envelopes retain the
-- existing native/preview protocol until that protocol accepts skill identities directly.
CREATE TABLE public.desktop_skills (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 id uuid NOT NULL, name text NOT NULL, description text NOT NULL, files jsonb NOT NULL,
 execution_name text NOT NULL, enabled boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 1,
 origin_plugin text, origin_directory text, PRIMARY KEY(user_id,id), UNIQUE(user_id,execution_name)
);
CREATE TABLE public.desktop_skill_grants (
 user_id uuid NOT NULL, skill_id uuid NOT NULL, agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
 enabled boolean NOT NULL, PRIMARY KEY(user_id,skill_id,agent_id),
 FOREIGN KEY(user_id,skill_id) REFERENCES public.desktop_skills(user_id,id) ON DELETE CASCADE
);
CREATE TABLE public.desktop_skill_migrations (
 user_id uuid NOT NULL, plugin_name text NOT NULL, source_digest text NOT NULL, receipt jsonb NOT NULL,
 completed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,plugin_name),
 FOREIGN KEY(user_id,plugin_name) REFERENCES public.desktop_plugins(user_id,name)
);
CREATE TABLE public.desktop_skill_aliases (
 user_id uuid NOT NULL, selection text NOT NULL, skill_id uuid NOT NULL, execution_name text NOT NULL, digest text NOT NULL,
 PRIMARY KEY(user_id,selection), FOREIGN KEY(user_id,skill_id) REFERENCES public.desktop_skills(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,execution_name) REFERENCES public.desktop_plugins(user_id,name)
);
CREATE TABLE public.desktop_skill_versions (
 user_id uuid NOT NULL, skill_id uuid NOT NULL, execution_name text NOT NULL, digest text NOT NULL, package jsonb NOT NULL,
 PRIMARY KEY(user_id,execution_name), FOREIGN KEY(user_id,skill_id) REFERENCES public.desktop_skills(user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(user_id,execution_name) REFERENCES public.desktop_plugins(user_id,name)
);
ALTER TABLE public.desktop_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_skill_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_skill_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_skill_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_skill_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_skills,public.desktop_skill_grants,public.desktop_skill_migrations,public.desktop_skill_aliases,public.desktop_skill_versions FROM anon,authenticated;
GRANT ALL ON public.desktop_skills,public.desktop_skill_grants,public.desktop_skill_migrations,public.desktop_skill_aliases,public.desktop_skill_versions TO service_role;

CREATE FUNCTION public.desktop_create_skill(p_user uuid,p_id uuid,p_name text,p_description text,p_package jsonb,p_digest text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE execution text=p_package#>>'{manifest,name}';
BEGIN
 IF p_user IS NULL OR p_id IS NULL OR execution IS DISTINCT FROM 'skill-'||p_id::text OR p_package ? 'mcp' OR jsonb_typeof(p_package->'files') IS DISTINCT FROM 'object' OR length(p_name) NOT BETWEEN 1 AND 200 OR length(p_description) NOT BETWEEN 1 AND 4000 OR p_digest !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid standalone skill'; END IF;
 INSERT INTO desktop_plugins(user_id,name,package,digest,source) VALUES(p_user,execution,p_package,p_digest,'imported');
 INSERT INTO desktop_skills(user_id,id,name,description,files,execution_name) VALUES(p_user,p_id,p_name,p_description,p_package->'files',execution);
 INSERT INTO desktop_skill_versions VALUES(p_user,p_id,execution,p_digest,p_package);
END $$;
CREATE FUNCTION public.desktop_save_skill(p_user uuid,p_id uuid,p_revision integer,p_name text,p_description text,p_package jsonb,p_digest text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE skill desktop_skills; execution text=p_package#>>'{manifest,name}'; grant_row record;
BEGIN
 SELECT * INTO skill FROM desktop_skills WHERE user_id=p_user AND id=p_id FOR UPDATE;
 IF NOT FOUND OR skill.revision<>p_revision THEN RAISE EXCEPTION 'This skill changed. Reload before saving.'; END IF;
 IF execution !~ '^skill-[a-f0-9-]{36}$' OR p_package ? 'mcp' OR jsonb_typeof(p_package->'files') IS DISTINCT FROM 'object' OR length(p_name) NOT BETWEEN 1 AND 200 OR length(p_description) NOT BETWEEN 1 AND 4000 OR p_digest !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid standalone skill'; END IF;
 INSERT INTO desktop_plugins(user_id,name,package,digest,source,enabled) VALUES(p_user,execution,p_package,p_digest,'imported',skill.enabled);
 INSERT INTO desktop_skill_versions VALUES(p_user,p_id,execution,p_digest,p_package);
 INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) SELECT user_id,execution,agent_id,enabled FROM desktop_skill_grants WHERE user_id=p_user AND skill_id=p_id;
 UPDATE desktop_skills SET name=p_name,description=p_description,files=p_package->'files',execution_name=execution,revision=revision+1 WHERE user_id=p_user AND id=p_id;
END $$;
CREATE FUNCTION public.desktop_control_skill(p_user uuid,p_id uuid,p_agent uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM desktop_skills WHERE user_id=p_user AND id=p_id FOR UPDATE;
 IF NOT FOUND OR p_enabled IS NULL THEN RAISE EXCEPTION 'Skill not found'; END IF;
 IF p_agent IS NULL THEN
  UPDATE desktop_skills SET enabled=p_enabled WHERE user_id=p_user AND id=p_id;
  UPDATE desktop_plugins p SET enabled=p_enabled FROM desktop_skill_versions v WHERE v.user_id=p_user AND v.skill_id=p_id AND p.user_id=v.user_id AND p.name=v.execution_name;
 ELSE
  PERFORM 1 FROM agents WHERE id=p_agent AND user_id=p_user AND (NOT p_enabled OR active) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose an available owned agent'; END IF;
  INSERT INTO desktop_skill_grants VALUES(p_user,p_id,p_agent,p_enabled) ON CONFLICT(user_id,skill_id,agent_id) DO UPDATE SET enabled=p_enabled;
  INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) SELECT p_user,execution_name,p_agent,p_enabled FROM desktop_skill_versions WHERE user_id=p_user AND skill_id=p_id ON CONFLICT(user_id,plugin_name,agent_id) DO UPDATE SET enabled=p_enabled;
 END IF;
END $$;
CREATE FUNCTION public.desktop_migrate_skill_package(p_user uuid,p_name text,p_digest text,p_skills jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE source desktop_plugins; item jsonb; skill uuid; execution text; original jsonb; reconciled jsonb='{}'::jsonb; receipts jsonb='[]'::jsonb; grant_count integer;
BEGIN
 SELECT * INTO source FROM desktop_plugins WHERE user_id=p_user AND name=p_name FOR UPDATE;
 IF EXISTS(SELECT 1 FROM desktop_skill_migrations WHERE user_id=p_user AND plugin_name=p_name) THEN RETURN; END IF;
 IF NOT FOUND OR source.source<>'imported' OR source.digest<>p_digest OR source.package ? 'mcp' OR jsonb_typeof(source.package->'files') IS DISTINCT FROM 'object' OR jsonb_typeof(p_skills) IS DISTINCT FROM 'array' OR jsonb_array_length(p_skills) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Skill source changed'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_skills) LOOP
  skill=(item->>'id')::uuid; execution=item->>'execution_name'; original=item->'files';
  IF jsonb_typeof(original) IS DISTINCT FROM 'object' OR original<>item#>'{package,files}' OR execution IS DISTINCT FROM 'skill-'||skill::text OR item#>>'{package,manifest,name}' IS DISTINCT FROM execution OR item->'package' ? 'mcp' OR NOT(original ? ('skills/'||(item->>'directory')||'/SKILL.md')) OR EXISTS(SELECT 1 FROM jsonb_each(original) f WHERE left(f.key,length('skills/'||(item->>'directory')||'/'))<>'skills/'||(item->>'directory')||'/' OR source.package->'files'->f.key IS DISTINCT FROM f.value OR reconciled ? f.key) THEN RAISE EXCEPTION 'Skill byte reconciliation failed'; END IF;
  PERFORM desktop_create_skill(p_user,skill,item->>'name',item->>'description',item->'package',item->>'digest');
  UPDATE desktop_skills SET enabled=source.enabled,origin_plugin=p_name,origin_directory=item->>'directory' WHERE user_id=p_user AND id=skill;
  UPDATE desktop_plugins SET enabled=source.enabled WHERE user_id=p_user AND name=execution;
  INSERT INTO desktop_skill_grants SELECT user_id,skill,agent_id,enabled FROM desktop_agent_plugins WHERE user_id=p_user AND plugin_name=p_name;
  INSERT INTO desktop_agent_plugins(user_id,plugin_name,agent_id,enabled) SELECT user_id,execution,agent_id,enabled FROM desktop_agent_plugins WHERE user_id=p_user AND plugin_name=p_name;
  INSERT INTO desktop_skill_aliases VALUES(p_user,'agentopia-plugin:'||p_name||':'||p_digest||':skills/'||(item->>'directory')||'/SKILL.md',skill,execution,item->>'digest');
  reconciled=reconciled||original; receipts=receipts||jsonb_build_array(jsonb_build_object('id',skill,'directory',item->>'directory','files',(SELECT count(*) FROM jsonb_object_keys(original)),'digest',item->>'digest'));
 END LOOP;
 IF reconciled IS DISTINCT FROM source.package->'files' THEN RAISE EXCEPTION 'Skill migration omitted source bytes'; END IF;
 SELECT count(*) INTO grant_count FROM desktop_agent_plugins WHERE user_id=p_user AND plugin_name=p_name;
 IF EXISTS(SELECT 1 FROM desktop_skills s WHERE s.user_id=p_user AND s.origin_plugin=p_name AND (SELECT count(*) FROM desktop_skill_grants g WHERE g.user_id=p_user AND g.skill_id=s.id)<>grant_count) THEN RAISE EXCEPTION 'Skill grant reconciliation failed'; END IF;
 INSERT INTO desktop_skill_migrations(user_id,plugin_name,source_digest,receipt) VALUES(p_user,p_name,p_digest,jsonb_build_object('skills',receipts,'grantsPerSkill',grant_count));
END $$;
REVOKE ALL ON FUNCTION public.desktop_create_skill(uuid,uuid,text,text,jsonb,text),public.desktop_save_skill(uuid,uuid,integer,text,text,jsonb,text),public.desktop_control_skill(uuid,uuid,uuid,boolean),public.desktop_migrate_skill_package(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_create_skill(uuid,uuid,text,text,jsonb,text),public.desktop_save_skill(uuid,uuid,integer,text,text,jsonb,text),public.desktop_control_skill(uuid,uuid,uuid,boolean),public.desktop_migrate_skill_package(uuid,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.desktop_validate_creation_plugin_grants(p_user uuid,p_grants jsonb) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grant_row jsonb; plugin desktop_plugins; adapters integer:=0; key text;
BEGIN
 IF jsonb_typeof(p_grants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_grants)>100 THEN RAISE EXCEPTION 'Choose up to 100 installed apps'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_grants) g WHERE jsonb_typeof(g) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'Invalid draft app selection'; END IF;
 IF (SELECT count(*)<>count(DISTINCT value->>'name') FROM jsonb_array_elements(p_grants)) THEN RAISE EXCEPTION 'Choose distinct apps'; END IF;
 FOR grant_row IN SELECT value FROM jsonb_array_elements(p_grants) ORDER BY (value->>'name') COLLATE "C" LOOP
  FOR key IN SELECT jsonb_object_keys(grant_row) LOOP IF key NOT IN ('name','digest') THEN RAISE EXCEPTION 'Draft app selection cannot contain credentials or authority fields'; END IF; END LOOP;
  IF jsonb_typeof(grant_row->'name') IS DISTINCT FROM 'string' OR length(grant_row->>'name')>64 OR grant_row->>'name' !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' OR position('..' in grant_row->>'name')>0 OR position('--' in grant_row->>'name')>0 OR jsonb_typeof(grant_row->'digest') IS DISTINCT FROM 'string' OR grant_row->>'digest' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Choose installed apps with their reviewed versions'; END IF;
  SELECT * INTO plugin FROM desktop_plugins WHERE user_id=p_user AND name=grant_row->>'name' FOR UPDATE;
  IF NOT FOUND OR NOT plugin.enabled OR plugin.digest<>grant_row->>'digest' THEN RAISE EXCEPTION 'An app was disabled, removed or changed. Refresh its reviewed selection'; END IF;
  IF EXISTS(SELECT 1 FROM desktop_skill_versions v WHERE v.user_id=p_user AND v.execution_name=plugin.name) AND NOT EXISTS(SELECT 1 FROM desktop_skills s JOIN desktop_skill_versions v ON v.user_id=s.user_id AND v.skill_id=s.id WHERE s.user_id=p_user AND v.execution_name=plugin.name AND s.enabled AND NOT(v.package ? 'mcp') AND v.package=plugin.package AND v.digest=plugin.digest) THEN RAISE EXCEPTION 'This standalone skill is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM desktop_skills WHERE user_id=p_user AND origin_plugin=plugin.name AND NOT enabled) THEN RAISE EXCEPTION 'A skill in this retained package was disabled'; END IF;
  IF plugin.source='legacy' THEN RAISE EXCEPTION 'An existing protected connection belongs to its original agent. Install a reviewed package for this draft'; END IF;
  IF plugin.package#>>'{manifest,extensions,com.agentopia,adapter}' IS NOT NULL THEN adapters=adapters+1; END IF;
 END LOOP;
 IF adapters>1 THEN RAISE EXCEPTION 'Choose one search provider for this draft'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.desktop_create_agent_with_tools(p_user uuid,p_creation uuid,p_tool_revision bigint,p_name text,p_description text,p_instructions text,p_provider text,p_model text,p_appearance jsonb,p_avatar text,p_behavior jsonb DEFAULT NULL) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE scope desktop_creation_tool_scopes; result uuid; existing uuid; grant_row jsonb; standalone uuid; skill_row record;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
 SELECT * INTO scope FROM desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR UPDATE;
 IF NOT FOUND OR scope.revision IS DISTINCT FROM p_tool_revision THEN RAISE EXCEPTION 'Refresh the creation app selection before saving this agent'; END IF;
 SELECT id INTO existing FROM agents WHERE user_id=p_user AND metadata->>'desktop_creation_id'=p_creation::text;
 IF existing IS NOT NULL AND scope.bound_agent_id IS DISTINCT FROM existing THEN RAISE EXCEPTION 'This creation already saved an agent without this app selection'; END IF;
 IF scope.bound_agent_id IS NULL THEN UPDATE desktop_creation_tool_scopes SET binding=true WHERE id=scope.id; END IF;
 IF p_behavior IS NULL THEN result=desktop_create_agent_presentation(p_user,p_creation,p_name,p_description,p_instructions,p_provider,p_model,p_appearance,p_avatar);
 ELSE result=desktop_create_agent_definition(p_user,p_creation,p_name,p_description,p_instructions,p_provider,p_model,p_appearance,p_avatar,p_behavior); END IF;
 IF scope.bound_agent_id IS NOT NULL THEN RETURN result; END IF;
 PERFORM desktop_agent_profile(p_user,result);
 PERFORM desktop_validate_creation_plugin_grants(p_user,scope.grants);
 FOR grant_row IN SELECT value FROM jsonb_array_elements(scope.grants) LOOP
  SELECT skill_id INTO standalone FROM desktop_skill_versions WHERE user_id=p_user AND execution_name=grant_row->>'name';
  IF standalone IS NOT NULL THEN PERFORM desktop_control_skill(p_user,standalone,result,true); ELSIF EXISTS(SELECT 1 FROM desktop_skill_migrations WHERE user_id=p_user AND plugin_name=grant_row->>'name') THEN FOR skill_row IN SELECT id FROM desktop_skills WHERE user_id=p_user AND origin_plugin=grant_row->>'name' LOOP PERFORM desktop_control_skill(p_user,skill_row.id,result,true); END LOOP; ELSE PERFORM desktop_assign_plugin(p_user,grant_row->>'name',result,true); END IF;
 END LOOP;
 UPDATE desktop_agent_plugins SET enabled=false WHERE user_id=p_user AND agent_id=result AND plugin_name IN ('agentopia-browser','agentopia-files-terminal','agentopia-computer','agentopia-workspace-agents','agentopia-documents-planning','agentopia-schedules') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(scope.grants) g WHERE g->>'name'=plugin_name);
 UPDATE desktop_creation_tool_scopes SET bound_agent_id=result,bound_revision=revision,binding=false,updated_at=now() WHERE id=scope.id;
 RETURN result;
END $$;


ALTER FUNCTION public.desktop_assign_plugin(uuid,text,uuid,boolean) RENAME TO desktop_assign_tool_plugin;
CREATE FUNCTION public.desktop_assign_plugin(p_user uuid,p_name text,p_agent uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM desktop_skill_versions WHERE user_id=p_user AND execution_name=p_name) OR EXISTS(SELECT 1 FROM desktop_skill_migrations WHERE user_id=p_user AND plugin_name=p_name) THEN RAISE EXCEPTION 'Manage standalone assignments in Skills'; END IF;
 PERFORM desktop_assign_tool_plugin(p_user,p_name,p_agent,p_enabled);
END $$;
REVOKE ALL ON FUNCTION public.desktop_assign_plugin(uuid,text,uuid,boolean),public.desktop_assign_tool_plugin(uuid,text,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.desktop_assign_plugin(uuid,text,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';

-- Old saved option/draft selections resolve through immutable original-byte aliases,
-- while the independent skill account/grant remains the sole authorization.
CREATE FUNCTION public.desktop_selected_skill_allowed(p_user uuid,p_agent uuid,p_selection text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM desktop_skill_aliases a JOIN desktop_skills s ON s.user_id=a.user_id AND s.id=a.skill_id
  JOIN desktop_skill_grants g ON g.user_id=s.user_id AND g.skill_id=s.id AND g.agent_id=p_agent AND g.enabled
  JOIN desktop_skill_versions v ON v.user_id=a.user_id AND v.execution_name=a.execution_name AND v.digest=a.digest
  JOIN desktop_plugins p ON p.user_id=v.user_id AND p.name=v.execution_name AND p.digest=v.digest AND p.package=v.package AND p.enabled
  WHERE a.user_id=p_user AND a.selection=p_selection AND s.enabled AND NOT(v.package ? 'mcp') AND (v.package->'files') ? split_part(p_selection,':',4)
 ) OR EXISTS(
  SELECT 1 FROM desktop_plugins p JOIN desktop_agent_plugins g ON g.user_id=p.user_id AND g.plugin_name=p.name AND g.agent_id=p_agent AND g.enabled
  LEFT JOIN desktop_skill_versions v ON v.user_id=p.user_id AND v.execution_name=p.name
  LEFT JOIN desktop_skills s ON s.user_id=v.user_id AND s.id=v.skill_id
  WHERE p.user_id=p_user AND p.name=split_part(p_selection,':',2) AND p.digest=split_part(p_selection,':',3) AND p.enabled AND (p.package->'files') ? split_part(p_selection,':',4)
  AND NOT EXISTS(SELECT 1 FROM desktop_skill_migrations m WHERE m.user_id=p_user AND m.plugin_name=p.name)
  AND (v.execution_name IS NULL OR s.enabled AND v.package=p.package AND v.digest=p.digest AND NOT(v.package ? 'mcp') AND EXISTS(SELECT 1 FROM desktop_skill_grants sg WHERE sg.user_id=p_user AND sg.skill_id=s.id AND sg.agent_id=p_agent AND sg.enabled))
 );
$$;
REVOKE ALL ON FUNCTION public.desktop_selected_skill_allowed(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_selected_skill_allowed(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.desktop_begin_scoped_preview(p_user uuid,p_session uuid,p_request uuid,p_source uuid,p_snapshot jsonb,p_text text,p_context jsonb DEFAULT NULL,p_creation uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE session public.desktop_preview_sessions; request public.desktop_preview_requests; key text; requested jsonb; reference jsonb; skill jsonb; file jsonb; bundle_count integer; bundle_bytes bigint; normalized_root text; normalized_reference text; creation_scope public.desktop_creation_tool_scopes;
BEGIN
 IF p_user IS NULL OR p_session IS NULL OR p_request IS NULL OR p_text IS NULL OR length(trim(p_text)) NOT BETWEEN 1 AND 100000 OR length(p_text)>100000 OR p_snapshot IS NULL OR jsonb_typeof(p_snapshot)<>'object' THEN RAISE EXCEPTION 'Invalid draft preview'; END IF;
 IF p_snapshot - ARRAY['name','description','instructions','personality','provider','model','thinking','behavior','execution','builder'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Unsupported draft context'; END IF;
 FOREACH key IN ARRAY ARRAY['name','description','instructions','personality','provider','model','thinking'] LOOP
  IF jsonb_typeof(p_snapshot->key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid draft snapshot'; END IF;
 END LOOP;
 IF length(trim(p_snapshot->>'name')) NOT BETWEEN 1 AND 100 OR length(p_snapshot->>'name')>100 OR length(p_snapshot->>'description')>4000 OR length(p_snapshot->>'instructions')>100000 OR length(p_snapshot->>'personality')>20000 OR length(trim(p_snapshot->>'model')) NOT BETWEEN 1 AND 200 OR length(p_snapshot->>'model')>200 OR p_snapshot->>'provider' NOT IN ('openai-oauth','openrouter') OR p_snapshot->>'thinking' NOT IN ('default','none','minimal','low','medium','high','xhigh','max','ultra') THEN RAISE EXCEPTION 'Invalid draft snapshot'; END IF;
 PERFORM public.desktop_validate_preview_behavior(p_snapshot->'behavior');
 PERFORM public.desktop_validate_preview_execution(p_user,p_snapshot->'execution');
 -- Builder data is retained with the request; it never grants execution authority.
 IF p_snapshot ? 'builder' THEN
  reference=p_snapshot->'builder';
  IF jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['name','description','instructions','behavior','appearance']) OR reference - ARRAY['name','description','instructions','behavior','appearance']<>'{}'::jsonb OR octet_length(reference::text)>4000000 OR jsonb_typeof(reference->'behavior') IS DISTINCT FROM 'object' OR jsonb_typeof(reference->'appearance') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid passive builder configuration'; END IF;
  FOREACH key IN ARRAY ARRAY['name','description','instructions'] LOOP
   IF jsonb_typeof(reference->key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid passive builder text'; END IF;
  END LOOP;
  IF length(reference->>'name')>100 OR length(reference->>'description')>4000 OR length(reference->>'instructions')>100000 THEN RAISE EXCEPTION 'Invalid passive builder text'; END IF;
  IF p_snapshot#>'{behavior,policy}' IS DISTINCT FROM '{"tools":[],"delegation":false,"delegateAgents":[],"memory":false,"memoryWrite":false,"maxDepth":0,"maxTurns":1}'::jsonb OR p_snapshot#>>'{execution,permission}' IS DISTINCT FROM 'chat' OR p_snapshot#>>'{execution,mode}' IS DISTINCT FROM 'chat' OR EXISTS(SELECT 1 FROM unnest(ARRAY['files','windows','skills','tools','sources']) field WHERE jsonb_array_length(coalesce(p_snapshot->'execution'->field,'[]'::jsonb))>0) THEN RAISE EXCEPTION 'Builder execution must remain Chat only without tools or delegation'; END IF;
  IF p_context IS NOT NULL AND (p_context->'policy' IS DISTINCT FROM p_snapshot#>'{behavior,policy}' OR EXISTS(SELECT 1 FROM unnest(ARRAY['references','roots','inputFiles','definitions']) field WHERE jsonb_array_length(coalesce(p_context->field,'[]'::jsonb))>0) OR p_context ?| ARRAY['pluginFiles','workspaceSkills','remoteTools','creationResources']) THEN RAISE EXCEPTION 'Builder context cannot attach action resources'; END IF;
 END IF;

 IF p_context->'version'='2'::jsonb THEN
  SELECT * INTO request FROM public.desktop_preview_requests WHERE id=p_request;
  IF FOUND THEN
   IF p_source IS NOT NULL OR p_creation IS NULL OR request.user_id<>p_user OR request.conversation_id<>p_session OR request.snapshot<>p_snapshot OR request.input_text<>p_text OR request.execution_context IS DISTINCT FROM p_context OR request.creation_id IS DISTINCT FROM p_creation THEN RAISE EXCEPTION 'This preview request identifier was already used'; END IF;
   SELECT * INTO session FROM public.desktop_preview_sessions WHERE id=p_session;
   IF NOT FOUND OR session.user_id<>p_user OR session.source_agent_id IS NOT NULL OR session.creation_id IS DISTINCT FROM p_creation THEN RAISE EXCEPTION 'This preview belongs to a different scope'; END IF;
   RETURN to_jsonb(request)||jsonb_build_object('existing',true);
  END IF;
 END IF;
 requested=coalesce(p_snapshot->'execution','{"permission":"chat","mode":"chat","files":[]}'::jsonb);
 IF p_context IS NULL THEN
  IF requested->>'permission'<>'chat' OR EXISTS(SELECT 1 FROM unnest(ARRAY['files','windows','skills','tools','sources']) field WHERE jsonb_array_length(coalesce(requested->field,'[]'::jsonb))>0) THEN RAISE EXCEPTION 'Prepare an execution snapshot before accepting a tool-capable preview'; END IF;
 ELSE
  IF jsonb_typeof(p_context) IS DISTINCT FROM 'object' OR NOT(p_context ?& ARRAY['version','owner','key','options','references','roots','inputFiles','definitions','policy']) OR p_context - ARRAY['version','owner','key','options','references','roots','inputFiles','definitions','policy','pluginFiles','workspaceSkills','remoteTools','creationResources'] <> '{}'::jsonb OR octet_length(p_context::text)>100663296 OR jsonb_typeof(p_context->'version') IS DISTINCT FROM 'number' OR p_context->'version' NOT IN ('1'::jsonb,'2'::jsonb) OR p_context->>'owner' IS DISTINCT FROM p_user::text OR jsonb_typeof(p_context->'key') IS DISTINCT FROM 'string' OR p_context->>'key' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid broker preview execution snapshot'; END IF;
  IF p_context->'version'='2'::jsonb THEN
   reference=p_context->'creationResources';
   IF p_creation IS NULL OR p_source IS NOT NULL OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['kind','id','creationId','revision']) OR reference - ARRAY['kind','id','creationId','revision']<>'{}'::jsonb OR reference->>'kind' IS DISTINCT FROM 'creation' OR reference->>'creationId' IS DISTINCT FROM p_creation::text OR jsonb_typeof(reference->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(reference->'revision') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid creation preview resource identity'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
   SELECT * INTO creation_scope FROM public.desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR SHARE;
   IF NOT FOUND OR creation_scope.bound_agent_id IS NOT NULL OR reference->>'id' IS DISTINCT FROM creation_scope.id::text OR reference->'revision' IS DISTINCT FROM to_jsonb(creation_scope.revision) THEN RAISE EXCEPTION 'The creation app selection changed or was saved'; END IF;
   PERFORM public.desktop_validate_creation_plugin_grants(p_user,creation_scope.grants);
  ELSIF p_context ? 'creationResources' THEN RAISE EXCEPTION 'Creation resources require a versioned creation preview context'; END IF;
  IF p_context ? 'remoteTools' THEN
   reference=p_context->'remoteTools';
   IF reference->'version'='2'::jsonb THEN
    IF p_context->'version'<>'2'::jsonb OR requested->>'permission' NOT IN ('ask','full') OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['version','owner','principal','mode','sources','definitions','bindings','key']) OR reference - ARRAY['version','owner','principal','mode','sources','definitions','bindings','key']<>'{}'::jsonb OR reference->'principal' IS DISTINCT FROM p_context->'creationResources' OR reference->>'owner' IS DISTINCT FROM p_user::text OR reference->>'mode' IS DISTINCT FROM requested->>'mode' OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'sources') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'definitions') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'bindings') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid owned creation preview connection binding'; END IF;
   ELSE
   IF p_source IS NULL OR requested->>'permission' NOT IN ('ask','full') OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['version','owner','agentId','mode','sources','definitions','bindings','key']) OR reference - ARRAY['version','owner','agentId','mode','sources','definitions','bindings','key'] <> '{}'::jsonb OR reference->'version' IS DISTINCT FROM '1'::jsonb OR reference->>'owner' IS DISTINCT FROM p_user::text OR reference->>'agentId' IS DISTINCT FROM p_source::text OR reference->>'mode' IS DISTINCT FROM requested->>'mode' OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'sources') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'definitions') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'bindings') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid owned preview connection binding'; END IF;
    IF p_context->'version'='2'::jsonb THEN RAISE EXCEPTION 'A creation cannot borrow a saved-agent connection binding'; END IF;
   END IF;
   IF jsonb_array_length(reference->'sources') NOT BETWEEN 1 AND 1000 OR jsonb_array_length(reference->'definitions') NOT BETWEEN 1 AND 3 OR jsonb_array_length(reference->'bindings')<>jsonb_array_length(reference->'sources') OR (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(reference->'sources')) OR (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(reference->'bindings')) THEN RAISE EXCEPTION 'Invalid preview connection count'; END IF;
   FOR skill IN SELECT value FROM jsonb_array_elements(reference->'sources') LOOP
    IF jsonb_typeof(skill) IS DISTINCT FROM 'object' OR NOT(skill ?& ARRAY['id','name','kind','ready','enabled','detail']) OR skill - ARRAY['id','name','kind','ready','enabled','detail','plugin','validation'] <> '{}'::jsonb OR jsonb_typeof(skill->'id') IS DISTINCT FROM 'string' OR skill->>'id' !~ '^(web_search|mcp:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$' OR skill->>'kind' IS DISTINCT FROM (CASE WHEN skill->>'id'='web_search' THEN 'web' ELSE 'mcp' END) OR skill->'ready' IS DISTINCT FROM 'true'::jsonb OR skill->'enabled' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(skill->'name') IS DISTINCT FROM 'string' OR length(skill->>'name')>1000 OR jsonb_typeof(skill->'detail') IS DISTINCT FROM 'string' OR length(skill->>'detail')>4000 OR skill ? 'plugin' AND (jsonb_typeof(skill->'plugin') IS DISTINCT FROM 'string' OR length(skill->>'plugin')>200) OR skill ? 'validation' AND (jsonb_typeof(skill->'validation') IS DISTINCT FROM 'string' OR length(skill->>'validation')>500) OR requested ? 'tools' AND NOT(requested->'tools' ? (skill->>'id')) THEN RAISE EXCEPTION 'Invalid selected preview connection'; END IF;
    IF p_context->'version'='2'::jsonb THEN PERFORM public.desktop_validate_creation_remote_source(p_user,creation_scope.id,skill); END IF;
   END LOOP;
   FOR skill IN SELECT value FROM jsonb_array_elements(reference->'bindings') LOOP
    IF jsonb_typeof(skill) IS DISTINCT FROM 'object' OR NOT(skill ?& ARRAY['id','signature']) OR skill - ARRAY['id','signature'] <> '{}'::jsonb OR jsonb_typeof(skill->'signature') IS DISTINCT FROM 'string' OR skill->>'signature' !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(reference->'sources') s WHERE s->>'id'=skill->>'id') THEN RAISE EXCEPTION 'Invalid preview connection fingerprint'; END IF;
   END LOOP;
   FOR skill IN SELECT value FROM jsonb_array_elements(reference->'definitions') LOOP
    IF jsonb_typeof(skill) IS DISTINCT FROM 'object' OR skill->>'namespace' IS DISTINCT FROM 'tools' OR skill->>'name' NOT IN ('web_search','mcp_search','mcp_call') OR jsonb_typeof(skill->'parameters') IS DISTINCT FROM 'object' OR skill->>'name'='web_search' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(reference->'sources') s WHERE s->>'id'='web_search') OR skill->>'name' IN ('mcp_search','mcp_call') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(reference->'sources') s WHERE s->>'kind'='mcp') THEN RAISE EXCEPTION 'Invalid preview connection tool'; END IF;
   END LOOP;
   IF (SELECT count(*)<>count(DISTINCT value->>'name') FROM jsonb_array_elements(reference->'definitions')) THEN RAISE EXCEPTION 'Duplicate preview connection tool'; END IF;
  END IF;
  FOR reference IN SELECT value FROM jsonb_array_elements(p_context->'definitions') LOOP
   IF reference->>'name' IN ('web_search','mcp_search','mcp_call') AND (NOT(p_context ? 'remoteTools') OR NOT(p_context#>'{remoteTools,definitions}' @> jsonb_build_array(reference))) THEN RAISE EXCEPTION 'Bind preview connection tools before declaration'; END IF;
  END LOOP;
  IF p_context ? 'pluginFiles' THEN
   reference=p_context->'pluginFiles';
   IF jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['owner','key','packages']) OR reference->>'owner' IS DISTINCT FROM p_user::text OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'packages') IS DISTINCT FROM 'array' OR requested->>'permission'='chat' AND jsonb_array_length(coalesce(requested->'skills','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Invalid owned preview plugin binding'; END IF;
   IF p_context->'version'='2'::jsonb THEN
    IF p_source IS NOT NULL OR NOT(reference ? 'creation') OR reference - ARRAY['owner','creation','key','packages']<>'{}'::jsonb OR reference->'creation' IS DISTINCT FROM p_context->'creationResources' THEN RAISE EXCEPTION 'Invalid creation preview plugin binding'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(reference->'packages') item WHERE NOT EXISTS(SELECT 1 FROM desktop_plugins p JOIN jsonb_array_elements(creation_scope.grants) g ON g->>'name'=p.name AND g->>'digest'=p.digest WHERE p.user_id=p_user AND p.enabled AND p.name=item->>'name' AND p.digest=item->>'digest' AND jsonb_typeof(p.package->'files')='object')) OR EXISTS(SELECT 1 FROM desktop_plugins p JOIN jsonb_array_elements(creation_scope.grants) g ON g->>'name'=p.name AND g->>'digest'=p.digest WHERE p.user_id=p_user AND p.enabled AND jsonb_typeof(p.package->'files')='object' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(reference->'packages') item WHERE item->>'name'=p.name AND item->>'digest'=p.digest)) THEN RAISE EXCEPTION 'The creation preview package selection changed'; END IF;
   ELSIF p_source IS NULL OR NOT(reference ? 'agentId') OR reference - ARRAY['owner','agentId','key','packages']<>'{}'::jsonb OR reference->>'agentId' IS DISTINCT FROM p_source::text THEN RAISE EXCEPTION 'Invalid saved preview plugin binding'; END IF;
   IF jsonb_array_length(reference->'packages')>1000 THEN RAISE EXCEPTION 'Too many preview plugin packages'; END IF;
   FOR reference IN SELECT value FROM jsonb_array_elements(reference->'packages') LOOP
    IF jsonb_typeof(reference) IS DISTINCT FROM 'object' OR reference - ARRAY['name','digest'] <> '{}'::jsonb OR jsonb_typeof(reference->'name') IS DISTINCT FROM 'string' OR length(reference->>'name') NOT BETWEEN 1 AND 64 OR reference->>'name' !~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$' OR reference->>'name' LIKE '%..%' OR reference->>'name' LIKE '%--%' OR jsonb_typeof(reference->'digest') IS DISTINCT FROM 'string' OR reference->>'digest' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid reviewed preview plugin package'; END IF;
   END LOOP;
   IF (SELECT count(*)<>count(DISTINCT value->>'name') FROM jsonb_array_elements(p_context#>'{pluginFiles,packages}')) THEN RAISE EXCEPTION 'Duplicate preview plugin package'; END IF;
  END IF;
  IF jsonb_array_length(coalesce(requested->'skills','[]'::jsonb))>0 THEN
   FOR key IN SELECT jsonb_array_elements_text(requested->'skills') LOOP
    IF key LIKE 'agentopia-plugin:%' THEN
     IF NOT(p_context ? 'pluginFiles') THEN RAISE EXCEPTION 'Bind selected preview native skills to reviewed packages'; END IF;
     IF key !~ '^agentopia-plugin:[a-z0-9][a-z0-9.-]*:[a-f0-9]{64}:skills/[^:]+/SKILL[.]md$' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_context#>'{pluginFiles,packages}') p WHERE p->>'name'=split_part(key,':',2) AND p->>'digest'=split_part(key,':',3)) OR (p_source IS NOT NULL AND NOT desktop_selected_skill_allowed(p_user,p_source,key) OR p_source IS NULL AND NOT EXISTS(SELECT 1 FROM desktop_plugins p JOIN jsonb_array_elements(creation_scope.grants) g ON g->>'name'=p.name AND g->>'digest'=p.digest WHERE p.user_id=p_user AND p.enabled AND p.name=split_part(key,':',2) AND p.digest=split_part(key,':',3) AND (p.package->'files') ? split_part(key,':',4))) THEN RAISE EXCEPTION 'Selected preview native skill is unavailable for this source'; END IF;
    ELSIF NOT(p_context ? 'workspaceSkills') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_context#>'{workspaceSkills,skills}') s WHERE s->>'selection'=key) THEN RAISE EXCEPTION 'Selected preview native skill requires an attached workspace binding';
    END IF;
   END LOOP;
  END IF;
  IF p_context ? 'workspaceSkills' THEN
   reference=p_context->'workspaceSkills';
   IF jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['version','owner','key','skills']) OR reference - ARRAY['version','owner','key','skills'] <> '{}'::jsonb OR reference->'version' IS DISTINCT FROM '1'::jsonb OR reference->>'owner' IS DISTINCT FROM p_user::text OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'skills') IS DISTINCT FROM 'array' OR requested->>'permission'='chat' THEN RAISE EXCEPTION 'Invalid owned workspace skill snapshot'; END IF;
   IF jsonb_array_length(reference->'skills') NOT BETWEEN 1 AND 20 OR (SELECT count(*)<>count(DISTINCT value->>'selection') FROM jsonb_array_elements(reference->'skills')) THEN RAISE EXCEPTION 'Workspace skill selections must be distinct'; END IF;
   bundle_count=0;bundle_bytes=0;
   FOR skill IN SELECT value FROM jsonb_array_elements(reference->'skills') LOOP
    IF jsonb_typeof(skill) IS DISTINCT FROM 'object' OR NOT(skill ?& ARRAY['referenceId','referencePath','root','selection','device','inode','files']) OR skill - ARRAY['referenceId','referencePath','root','selection','device','inode','files'] <> '{}'::jsonb OR jsonb_typeof(skill->'files') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid captured workspace skill'; END IF;
    FOREACH key IN ARRAY ARRAY['referenceId','referencePath','root','selection','device','inode'] LOOP
     IF jsonb_typeof(skill->key) IS DISTINCT FROM 'string' OR length(skill->>key) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'Invalid workspace skill identity'; END IF;
    END LOOP;
    normalized_root=replace(skill->>'root',chr(92),'/');normalized_reference=replace(skill->>'referencePath',chr(92),'/')||'/.agents/skills/';
    IF NOT(requested->'skills' ? (skill->>'selection')) OR NOT(requested->'files' ? (skill->>'referenceId')) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_context->'references') r WHERE r->>'id'=skill->>'referenceId' AND r->>'path'=skill->>'referencePath' AND r->>'kind'='folder' AND coalesce(r->>'source','')<>'clipboard') OR left(normalized_root,length(normalized_reference))<>normalized_reference OR normalized_root ~ '(^|/)[.]{1,2}(/|$)' OR replace(skill->>'selection',chr(92),'/')<>normalized_root||'/SKILL.md' THEN RAISE EXCEPTION 'Workspace skills must belong to their selected folder'; END IF;
    IF jsonb_array_length(skill->'files') NOT BETWEEN 1 AND 512 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(skill->'files') f WHERE f->>'path'='SKILL.md') OR (SELECT count(*)<>count(DISTINCT lower(value->>'path')) FROM jsonb_array_elements(skill->'files')) THEN RAISE EXCEPTION 'Invalid workspace skill bundle'; END IF;
    FOR file IN SELECT value FROM jsonb_array_elements(skill->'files') LOOP
     IF jsonb_typeof(file) IS DISTINCT FROM 'object' OR NOT(file ?& ARRAY['path','bytes','sha256','device','inode']) OR file - ARRAY['path','bytes','sha256','device','inode'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid workspace skill file'; END IF;
     FOREACH key IN ARRAY ARRAY['path','bytes','sha256','device','inode'] LOOP
      IF jsonb_typeof(file->key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid workspace skill file identity'; END IF;
     END LOOP;
     IF length(file->>'path') NOT BETWEEN 1 AND 4000 OR file->>'path' ~ '(^/|//|/$|(^|/)[.]{1,2}(/|$)|:)' OR strpos(file->>'path',chr(92))>0 OR file->>'sha256' !~ '^[a-f0-9]{64}$' OR encode(digest(decode(file->>'bytes','base64'),'sha256'),'hex')<>file->>'sha256' OR octet_length(decode(file->>'bytes','base64'))>2097152 THEN RAISE EXCEPTION 'Workspace skill file bytes or path changed'; END IF;
     IF EXISTS(SELECT 1 FROM regexp_split_to_table(file->>'path','/') part WHERE left(part,1)='.' OR lower(part) IN ('node_modules','venv','credentials.bin','id_rsa','id_ed25519','appdata','windows','programdata','backups','__pycache__','auth.json','credentials.json','token.json','tokens.json','secrets.json') OR part ~* '[.](pem|key|pfx|p12)$' OR part ~ '[. ]$' OR part ~* '^(con|prn|aux|nul|com[0-9]|lpt[0-9])([.]|$)') THEN RAISE EXCEPTION 'Credential and hidden workspace skill files are excluded'; END IF;
     bundle_count=bundle_count+1;bundle_bytes=bundle_bytes+octet_length(decode(file->>'bytes','base64'));
    END LOOP;
   END LOOP;
   IF bundle_count>512 OR bundle_bytes>16777216 THEN RAISE EXCEPTION 'Workspace skill bundles exceed the snapshot limit'; END IF;
  END IF;
  IF jsonb_typeof(p_context->'options') IS DISTINCT FROM 'object' OR (p_context->'options') - ARRAY['harness','provider','model','thinking','permission','mode','files','windows','skills','tools','sources'] <> '{}'::jsonb OR p_context#>>'{options,harness}' IS DISTINCT FROM 'codex' OR p_context#>>'{options,provider}' IS DISTINCT FROM p_snapshot->>'provider' OR p_context#>>'{options,model}' IS DISTINCT FROM p_snapshot->>'model' OR p_context#>>'{options,thinking}' IS DISTINCT FROM p_snapshot->>'thinking' OR p_context#>>'{options,permission}' IS DISTINCT FROM requested->>'permission' OR p_context#>>'{options,mode}' IS DISTINCT FROM requested->>'mode' THEN RAISE EXCEPTION 'The preview execution snapshot changed model or permissions'; END IF;
  FOREACH key IN ARRAY ARRAY['files','windows','skills','tools','sources'] LOOP
   IF coalesce(p_context->'options'->key,'[]'::jsonb)<>coalesce(requested->key,'[]'::jsonb) THEN RAISE EXCEPTION 'The preview execution snapshot changed selected context'; END IF;
  END LOOP;
  FOREACH key IN ARRAY ARRAY['references','roots','inputFiles','definitions'] LOOP
   IF jsonb_typeof(p_context->key) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid broker preview resources'; END IF;
  END LOOP;
  IF jsonb_array_length(p_context->'references')<>jsonb_array_length(requested->'files') OR jsonb_array_length(p_context->'roots')<>jsonb_array_length(requested->'files') OR jsonb_array_length(p_context->'inputFiles')>30 OR jsonb_array_length(p_context->'definitions')>200 OR jsonb_typeof(p_context->'policy') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid broker preview resource count'; END IF;
  FOR reference IN SELECT value FROM jsonb_array_elements(p_context->'references') LOOP
   IF jsonb_typeof(reference) IS DISTINCT FROM 'object' OR jsonb_typeof(reference->'id') IS DISTINCT FROM 'string' OR NOT(requested->'files' ? (reference->>'id')) OR jsonb_typeof(reference->'path') IS DISTINCT FROM 'string' OR jsonb_typeof(reference->'kind') IS DISTINCT FROM 'string' OR reference->>'kind' NOT IN ('file','folder') THEN RAISE EXCEPTION 'Invalid broker preview reference'; END IF;
  END LOOP;
  FOR reference IN SELECT value FROM jsonb_array_elements(p_context->'roots') LOOP
   IF jsonb_typeof(reference) IS DISTINCT FROM 'object' OR jsonb_typeof(reference->'id') IS DISTINCT FROM 'string' OR NOT(requested->'files' ? (reference->>'id')) OR jsonb_typeof(reference->'path') IS DISTINCT FROM 'string' OR jsonb_typeof(reference->'device') IS DISTINCT FROM 'string' OR jsonb_typeof(reference->'inode') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid broker preview root binding'; END IF;
  END LOOP;
  IF (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(p_context->'references')) OR (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(p_context->'roots')) THEN RAISE EXCEPTION 'Preview resource bindings must be distinct'; END IF;
 END IF;
 IF jsonb_typeof(p_snapshot#>'{behavior,policy,delegateAgents}')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_snapshot#>'{behavior,policy,delegateAgents}') target WHERE NOT EXISTS(SELECT 1 FROM public.agents WHERE id=target.value::uuid AND user_id=p_user)) THEN RAISE EXCEPTION 'Choose delegates from your own account'; END IF;
 IF p_creation IS NOT NULL AND p_source IS NOT NULL THEN RAISE EXCEPTION 'A new-agent preview cannot use a saved agent identity'; END IF;
 IF p_source IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.agents WHERE id=p_source AND user_id=p_user AND active) THEN RAISE EXCEPTION 'This saved agent is unavailable for your account'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_session::text,0));
 SELECT * INTO session FROM public.desktop_preview_sessions WHERE id=p_session;
 IF FOUND AND (session.user_id<>p_user OR session.source_agent_id IS DISTINCT FROM p_source OR session.creation_id IS DISTINCT FROM p_creation) THEN RAISE EXCEPTION 'This preview belongs to a different scope'; END IF;
 SELECT * INTO request FROM public.desktop_preview_requests WHERE id=p_request;
 IF FOUND THEN
  IF request.user_id<>p_user OR request.conversation_id<>p_session OR request.snapshot<>p_snapshot OR request.input_text<>p_text OR request.execution_context IS DISTINCT FROM p_context OR request.creation_id IS DISTINCT FROM p_creation THEN RAISE EXCEPTION 'This preview request identifier was already used'; END IF;
  RETURN to_jsonb(request)||jsonb_build_object('existing',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.desktop_preview_requests WHERE conversation_id=p_session AND status='running') THEN RAISE EXCEPTION 'This draft preview is already working'; END IF;
 IF (SELECT count(*) FROM public.desktop_preview_requests WHERE conversation_id=p_session)>=200 THEN RAISE EXCEPTION 'Start a new preview conversation to continue testing'; END IF;
 INSERT INTO public.desktop_preview_sessions(id,user_id,source_agent_id,creation_id) VALUES(p_session,p_user,p_source,p_creation) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.desktop_preview_requests(id,user_id,conversation_id,snapshot,input_text,execution_context,creation_id) VALUES(p_request,p_user,p_session,p_snapshot,p_text,p_context,p_creation) RETURNING * INTO request;
 RETURN to_jsonb(request)||jsonb_build_object('existing',false);
END $$;
NOTIFY pgrst,'reload schema';
