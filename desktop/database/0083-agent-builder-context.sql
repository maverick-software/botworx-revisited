-- Retain structured agent-builder context as passive configuration data.
-- Preserve every existing preview acceptance, retry, owner and resource check.
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
     IF key !~ '^agentopia-plugin:[a-z0-9][a-z0-9.-]*:[a-f0-9]{64}:skills/[^:]+/SKILL[.]md$' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_context#>'{pluginFiles,packages}') p WHERE p->>'name'=split_part(key,':',2) AND p->>'digest'=split_part(key,':',3)) OR (p_source IS NOT NULL AND NOT EXISTS(SELECT 1 FROM desktop_plugins p JOIN desktop_agent_plugins g ON g.user_id=p.user_id AND g.plugin_name=p.name WHERE p.user_id=p_user AND p.name=split_part(key,':',2) AND p.digest=split_part(key,':',3) AND p.enabled AND g.agent_id=p_source AND g.enabled AND (p.package->'files') ? split_part(key,':',4)) OR p_source IS NULL AND NOT EXISTS(SELECT 1 FROM desktop_plugins p JOIN jsonb_array_elements(creation_scope.grants) g ON g->>'name'=p.name AND g->>'digest'=p.digest WHERE p.user_id=p_user AND p.enabled AND p.name=split_part(key,':',2) AND p.digest=split_part(key,':',3) AND (p.package->'files') ? split_part(key,':',4))) THEN RAISE EXCEPTION 'Selected preview native skill is unavailable for this source'; END IF;
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
