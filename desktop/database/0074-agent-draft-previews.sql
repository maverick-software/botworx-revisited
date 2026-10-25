-- Test conversations retain their own snapshots and native receipts. Saved agents
-- and ordinary conversation/message tables are never modified by this path.
CREATE TABLE public.desktop_preview_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 source_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,user_id)
);
CREATE TABLE public.desktop_preview_requests (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL, snapshot jsonb NOT NULL,
 execution_context jsonb CHECK(execution_context IS NULL OR jsonb_typeof(execution_context)='object'),
 input_text text NOT NULL CHECK(length(input_text) BETWEEN 1 AND 100000),
 output_text text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'running'
 CHECK(status IN ('running','completed','cancelled','failed','interrupted')),
 error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id), UNIQUE(id,user_id,conversation_id), FOREIGN KEY(conversation_id,user_id) REFERENCES public.desktop_preview_sessions(id,user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX desktop_preview_one_running ON public.desktop_preview_requests(conversation_id) WHERE status='running';
CREATE TABLE public.desktop_preview_codex_threads (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, conversation_id uuid NOT NULL,
 scope text NOT NULL, provider text NOT NULL CHECK(provider IN ('openai-oauth','openrouter')),
 thread_id text NOT NULL, runtime_version text NOT NULL, imported_history boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(conversation_id,scope), UNIQUE(user_id,thread_id),
 FOREIGN KEY(conversation_id,user_id) REFERENCES public.desktop_preview_sessions(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.desktop_preview_codex_turns (
 request_id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 thread_id text, turn_id text, runtime_version text NOT NULL, state jsonb NOT NULL DEFAULT '{}',
 context jsonb, agent_references jsonb, updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(request_id,user_id) REFERENCES public.desktop_preview_requests(id,user_id) ON DELETE CASCADE
);
CREATE TABLE public.desktop_preview_tool_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 request_id uuid NOT NULL, conversation_id uuid NOT NULL,
 assistant_message_id text NOT NULL CHECK(assistant_message_id=request_id::text||':assistant'),
 native_thread_id text, name text NOT NULL, label text NOT NULL,
 status text NOT NULL CHECK(status IN('running','awaiting_approval','completed','denied','failed','interrupted','reverted')),
 arguments jsonb NOT NULL CHECK(jsonb_typeof(arguments)='object' AND arguments ?& ARRAY['provider_call_id','provider_arguments_hash'] AND jsonb_typeof(arguments->'provider_call_id')='string' AND length(arguments->>'provider_call_id') BETWEEN 1 AND 256 AND jsonb_typeof(arguments->'provider_arguments_hash')='string' AND arguments->>'provider_arguments_hash' ~ '^[a-f0-9]{64}$'),
 result jsonb, preview jsonb, approval jsonb, error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(request_id,user_id,conversation_id) REFERENCES public.desktop_preview_requests(id,user_id,conversation_id) ON DELETE CASCADE
);
CREATE INDEX desktop_preview_tools_conversation ON public.desktop_preview_tool_calls(user_id,conversation_id,created_at);
CREATE UNIQUE INDEX desktop_preview_tool_identity ON public.desktop_preview_tool_calls(request_id,coalesce(native_thread_id,''),(arguments->>'provider_call_id'));
ALTER TABLE public.desktop_preview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_preview_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_preview_codex_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_preview_codex_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_preview_tool_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_preview_sessions,public.desktop_preview_requests,public.desktop_preview_codex_threads,public.desktop_preview_codex_turns,public.desktop_preview_tool_calls FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.desktop_preview_sessions,public.desktop_preview_requests,public.desktop_preview_codex_threads,public.desktop_preview_codex_turns,public.desktop_preview_tool_calls TO service_role;

-- This is the same editable behavior shape used by saved agents. Skill hashes
-- and authority come from the broker, never from a supplied draft snapshot.
CREATE FUNCTION public.desktop_validate_preview_behavior(p_behavior jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE policy jsonb; skill jsonb; entry jsonb; key text;
BEGIN
 IF jsonb_typeof(p_behavior) IS DISTINCT FROM 'object' OR NOT(p_behavior ?& ARRAY['handle','role','sops','guardrails','skills','policy']) OR p_behavior - ARRAY['handle','role','sops','guardrails','skills','policy'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid draft behavior'; END IF;
 FOREACH key IN ARRAY ARRAY['handle','role','sops','guardrails'] LOOP
  IF jsonb_typeof(p_behavior->key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid draft behavior text'; END IF;
 END LOOP;
 IF p_behavior->>'handle' !~ '^[a-z][a-z0-9_-]{1,63}$' OR length(p_behavior->>'role')>1000 OR length(p_behavior->>'sops')>50000 OR length(p_behavior->>'guardrails')>20000 THEN RAISE EXCEPTION 'Invalid draft behavior text'; END IF;
 IF jsonb_typeof(p_behavior->'skills') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid draft skills'; END IF;
 IF jsonb_array_length(p_behavior->'skills')>30 THEN RAISE EXCEPTION 'Too many draft skills'; END IF;
 FOR skill IN SELECT value FROM jsonb_array_elements(p_behavior->'skills') LOOP
  IF jsonb_typeof(skill) IS DISTINCT FROM 'object' OR NOT(skill ?& ARRAY['id','name','description','content']) OR skill - ARRAY['id','name','description','content'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid draft skill'; END IF;
  FOREACH key IN ARRAY ARRAY['id','name','description','content'] LOOP
   IF jsonb_typeof(skill->key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid draft skill text'; END IF;
  END LOOP;
  IF skill->>'id' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR length(trim(skill->>'name')) NOT BETWEEN 1 AND 100 OR length(skill->>'name')>100 OR length(skill->>'description')>1000 OR length(trim(skill->>'content')) NOT BETWEEN 1 AND 50000 OR length(skill->>'content')>50000 THEN RAISE EXCEPTION 'Invalid draft skill text'; END IF;
 END LOOP;
 IF (SELECT count(*)<>count(DISTINCT value->>'id') OR coalesce(sum(length(value->>'content')),0)>200000 FROM jsonb_array_elements(p_behavior->'skills')) THEN RAISE EXCEPTION 'Draft skills need distinct identifiers and at most 200000 characters'; END IF;
 policy=p_behavior->'policy';
 IF jsonb_typeof(policy) IS DISTINCT FROM 'object' OR NOT(policy ?& ARRAY['tools','delegation','delegateAgents','memory','memoryWrite','maxDepth','maxTurns']) OR policy - ARRAY['tools','delegation','delegateAgents','memory','memoryWrite','maxDepth','maxTurns'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid draft tool policy'; END IF;
 FOREACH key IN ARRAY ARRAY['delegation','memory','memoryWrite'] LOOP
  IF jsonb_typeof(policy->key) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid draft capability'; END IF;
 END LOOP;
 IF jsonb_typeof(policy->'maxDepth') IS DISTINCT FROM 'number' OR policy->>'maxDepth' !~ '^[0-4]$' OR jsonb_typeof(policy->'maxTurns') IS DISTINCT FROM 'number' OR policy->>'maxTurns' !~ '^([1-9]|[1-4][0-9]|50)$' THEN RAISE EXCEPTION 'Invalid draft execution limits'; END IF;
 FOREACH key IN ARRAY ARRAY['tools','delegateAgents'] LOOP
  IF jsonb_typeof(policy->key) NOT IN ('array','null') THEN RAISE EXCEPTION 'Invalid draft capability list'; END IF;
  IF jsonb_typeof(policy->key)='array' THEN
   IF jsonb_array_length(policy->key)>200 THEN RAISE EXCEPTION 'Too many draft capabilities'; END IF;
   FOR entry IN SELECT value FROM jsonb_array_elements(policy->key) LOOP
    IF jsonb_typeof(entry) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid draft capability entry'; END IF;
    IF key='tools' AND entry#>>'{}' !~ '^(?:[a-z][a-z0-9_]*\.)?[a-z][a-z0-9_]*$' OR key='delegateAgents' AND entry#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'Invalid draft capability entry'; END IF;
   END LOOP;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.desktop_validate_preview_behavior(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_validate_preview_behavior(jsonb) TO service_role;

CREATE FUNCTION public.desktop_validate_preview_execution(p_user uuid,p_execution jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE key text; entry jsonb; maximum integer;
BEGIN
 IF p_execution IS NULL THEN RETURN; END IF;
 IF jsonb_typeof(p_execution) IS DISTINCT FROM 'object' OR NOT(p_execution ?& ARRAY['permission','mode','files']) OR p_execution - ARRAY['permission','mode','files','windows','skills','tools','sources'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid preview execution selection'; END IF;
 IF jsonb_typeof(p_execution->'permission') IS DISTINCT FROM 'string' OR p_execution->>'permission' NOT IN ('chat','ask','files','full') OR jsonb_typeof(p_execution->'mode') IS DISTINCT FROM 'string' OR p_execution->>'mode' NOT IN ('chat','plan') THEN RAISE EXCEPTION 'Invalid preview permissions'; END IF;
 FOREACH key IN ARRAY ARRAY['files','windows','skills','tools','sources'] LOOP
  IF NOT(p_execution ? key) THEN CONTINUE; END IF;
  maximum=CASE key WHEN 'files' THEN 20 WHEN 'windows' THEN 5 WHEN 'skills' THEN 20 WHEN 'tools' THEN 1000 ELSE 10 END;
  IF jsonb_typeof(p_execution->key) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid preview selection list'; END IF;
  IF jsonb_array_length(p_execution->key)>maximum THEN RAISE EXCEPTION 'Too many preview selections'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_execution->key) LOOP
   IF key IN ('files','windows') THEN
    IF jsonb_typeof(entry) IS DISTINCT FROM 'string' OR entry#>>'{}' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'Invalid preview reference identifier'; END IF;
   ELSIF key='skills' THEN
    IF jsonb_typeof(entry) IS DISTINCT FROM 'string' OR length(entry#>>'{}')>4000 THEN RAISE EXCEPTION 'Invalid preview skill selection'; END IF;
   ELSIF key='tools' THEN
    IF jsonb_typeof(entry) IS DISTINCT FROM 'string' OR entry#>>'{}' !~* '^(web_search|mcp:[a-f0-9-]{36})$' THEN RAISE EXCEPTION 'Invalid preview connection selection'; END IF;
   ELSE
    IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR entry->>'owner' IS DISTINCT FROM p_user::text OR jsonb_typeof(entry->'kind') IS DISTINCT FROM 'string' OR entry->>'kind' NOT IN ('browser','chat') OR jsonb_typeof(entry->'text') IS DISTINCT FROM 'string' OR length(entry->>'text')>16000 THEN RAISE EXCEPTION 'Invalid preview selected source'; END IF;
   END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.desktop_validate_preview_execution(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_validate_preview_execution(uuid,jsonb) TO service_role;

CREATE FUNCTION public.desktop_begin_agent_preview(p_user uuid,p_session uuid,p_request uuid,p_source uuid,p_snapshot jsonb,p_text text,p_context jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE session public.desktop_preview_sessions; request public.desktop_preview_requests; key text; requested jsonb; reference jsonb; skill jsonb; file jsonb; bundle_count integer; bundle_bytes bigint; normalized_root text; normalized_reference text;
BEGIN
 IF p_user IS NULL OR p_session IS NULL OR p_request IS NULL OR p_text IS NULL OR length(trim(p_text)) NOT BETWEEN 1 AND 100000 OR length(p_text)>100000 OR p_snapshot IS NULL OR jsonb_typeof(p_snapshot)<>'object' THEN RAISE EXCEPTION 'Invalid draft preview'; END IF;
 IF p_snapshot - ARRAY['name','description','instructions','personality','provider','model','thinking','behavior','execution'] <> '{}'::jsonb THEN RAISE EXCEPTION 'Unsupported draft context'; END IF;
 FOREACH key IN ARRAY ARRAY['name','description','instructions','personality','provider','model','thinking'] LOOP
  IF jsonb_typeof(p_snapshot->key) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid draft snapshot'; END IF;
 END LOOP;
 IF length(trim(p_snapshot->>'name')) NOT BETWEEN 1 AND 100 OR length(p_snapshot->>'name')>100 OR length(p_snapshot->>'description')>4000 OR length(p_snapshot->>'instructions')>100000 OR length(p_snapshot->>'personality')>20000 OR length(trim(p_snapshot->>'model')) NOT BETWEEN 1 AND 200 OR length(p_snapshot->>'model')>200 OR p_snapshot->>'provider' NOT IN ('openai-oauth','openrouter') OR p_snapshot->>'thinking' NOT IN ('default','none','minimal','low','medium','high','xhigh','max','ultra') THEN RAISE EXCEPTION 'Invalid draft snapshot'; END IF;
 PERFORM public.desktop_validate_preview_behavior(p_snapshot->'behavior');
 PERFORM public.desktop_validate_preview_execution(p_user,p_snapshot->'execution');
 requested=coalesce(p_snapshot->'execution','{"permission":"chat","mode":"chat","files":[]}'::jsonb);
 IF p_context IS NULL THEN
  IF requested->>'permission'<>'chat' OR EXISTS(SELECT 1 FROM unnest(ARRAY['files','windows','skills','tools','sources']) field WHERE jsonb_array_length(coalesce(requested->field,'[]'::jsonb))>0) THEN RAISE EXCEPTION 'Prepare an execution snapshot before accepting a tool-capable preview'; END IF;
 ELSE
  IF jsonb_typeof(p_context) IS DISTINCT FROM 'object' OR NOT(p_context ?& ARRAY['version','owner','key','options','references','roots','inputFiles','definitions','policy']) OR p_context - ARRAY['version','owner','key','options','references','roots','inputFiles','definitions','policy','pluginFiles','workspaceSkills','remoteTools'] <> '{}'::jsonb OR octet_length(p_context::text)>100663296 OR jsonb_typeof(p_context->'version') IS DISTINCT FROM 'number' OR p_context->'version'<>'1'::jsonb OR p_context->>'owner' IS DISTINCT FROM p_user::text OR jsonb_typeof(p_context->'key') IS DISTINCT FROM 'string' OR p_context->>'key' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid broker preview execution snapshot'; END IF;
  IF p_context ? 'remoteTools' THEN
   reference=p_context->'remoteTools';
   IF p_source IS NULL OR requested->>'permission' NOT IN ('ask','full') OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['version','owner','agentId','mode','sources','definitions','bindings','key']) OR reference - ARRAY['version','owner','agentId','mode','sources','definitions','bindings','key'] <> '{}'::jsonb OR reference->'version' IS DISTINCT FROM '1'::jsonb OR reference->>'owner' IS DISTINCT FROM p_user::text OR reference->>'agentId' IS DISTINCT FROM p_source::text OR reference->>'mode' IS DISTINCT FROM requested->>'mode' OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'sources') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'definitions') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'bindings') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid owned preview connection binding'; END IF;
   IF jsonb_array_length(reference->'sources') NOT BETWEEN 1 AND 1000 OR jsonb_array_length(reference->'definitions') NOT BETWEEN 1 AND 3 OR jsonb_array_length(reference->'bindings')<>jsonb_array_length(reference->'sources') OR (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(reference->'sources')) OR (SELECT count(*)<>count(DISTINCT value->>'id') FROM jsonb_array_elements(reference->'bindings')) THEN RAISE EXCEPTION 'Invalid preview connection count'; END IF;
   FOR skill IN SELECT value FROM jsonb_array_elements(reference->'sources') LOOP
    IF jsonb_typeof(skill) IS DISTINCT FROM 'object' OR NOT(skill ?& ARRAY['id','name','kind','ready','enabled','detail']) OR skill - ARRAY['id','name','kind','ready','enabled','detail','plugin','validation'] <> '{}'::jsonb OR jsonb_typeof(skill->'id') IS DISTINCT FROM 'string' OR skill->>'id' !~ '^(web_search|mcp:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$' OR skill->>'kind' IS DISTINCT FROM (CASE WHEN skill->>'id'='web_search' THEN 'web' ELSE 'mcp' END) OR skill->'ready' IS DISTINCT FROM 'true'::jsonb OR skill->'enabled' IS DISTINCT FROM 'true'::jsonb OR jsonb_typeof(skill->'name') IS DISTINCT FROM 'string' OR length(skill->>'name')>1000 OR jsonb_typeof(skill->'detail') IS DISTINCT FROM 'string' OR length(skill->>'detail')>4000 OR skill ? 'plugin' AND (jsonb_typeof(skill->'plugin') IS DISTINCT FROM 'string' OR length(skill->>'plugin')>200) OR skill ? 'validation' AND (jsonb_typeof(skill->'validation') IS DISTINCT FROM 'string' OR length(skill->>'validation')>500) OR requested ? 'tools' AND NOT(requested->'tools' ? (skill->>'id')) THEN RAISE EXCEPTION 'Invalid selected preview connection'; END IF;
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
   IF p_source IS NULL OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['owner','agentId','key','packages']) OR reference - ARRAY['owner','agentId','key','packages'] <> '{}'::jsonb OR reference->>'owner' IS DISTINCT FROM p_user::text OR reference->>'agentId' IS DISTINCT FROM p_source::text OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'packages') IS DISTINCT FROM 'array' OR requested->>'permission'='chat' AND jsonb_array_length(coalesce(requested->'skills','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Invalid owned preview plugin binding'; END IF;
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
     IF key !~ '^agentopia-plugin:[a-z0-9][a-z0-9.-]*:[a-f0-9]{64}:skills/[^:]+/SKILL[.]md$' OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_context#>'{pluginFiles,packages}') p WHERE p->>'name'=split_part(key,':',2) AND p->>'digest'=split_part(key,':',3)) OR NOT EXISTS(SELECT 1 FROM desktop_plugins p JOIN desktop_agent_plugins g ON g.user_id=p.user_id AND g.plugin_name=p.name WHERE p.user_id=p_user AND p.name=split_part(key,':',2) AND p.digest=split_part(key,':',3) AND p.enabled AND g.agent_id=p_source AND g.enabled AND (p.package->'files') ? split_part(key,':',4)) THEN RAISE EXCEPTION 'Selected preview native skill is unavailable for this source'; END IF;
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
 IF p_source IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.agents WHERE id=p_source AND user_id=p_user AND active) THEN RAISE EXCEPTION 'This saved agent is unavailable for your account'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_session::text,0));
 SELECT * INTO session FROM public.desktop_preview_sessions WHERE id=p_session;
 IF FOUND AND (session.user_id<>p_user OR session.source_agent_id IS DISTINCT FROM p_source) THEN RAISE EXCEPTION 'This preview belongs to a different scope'; END IF;
 SELECT * INTO request FROM public.desktop_preview_requests WHERE id=p_request;
 IF FOUND THEN
  IF request.user_id<>p_user OR request.conversation_id<>p_session OR request.snapshot<>p_snapshot OR request.input_text<>p_text OR request.execution_context IS DISTINCT FROM p_context THEN RAISE EXCEPTION 'This preview request identifier was already used'; END IF;
  RETURN to_jsonb(request)||jsonb_build_object('existing',true);
 END IF;
 IF EXISTS(SELECT 1 FROM public.desktop_preview_requests WHERE conversation_id=p_session AND status='running') THEN RAISE EXCEPTION 'This draft preview is already working'; END IF;
 IF (SELECT count(*) FROM public.desktop_preview_requests WHERE conversation_id=p_session)>=200 THEN RAISE EXCEPTION 'Start a new preview conversation to continue testing'; END IF;
 INSERT INTO public.desktop_preview_sessions(id,user_id,source_agent_id) VALUES(p_session,p_user,p_source) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.desktop_preview_requests(id,user_id,conversation_id,snapshot,input_text,execution_context) VALUES(p_request,p_user,p_session,p_snapshot,p_text,p_context) RETURNING * INTO request;
 RETURN to_jsonb(request)||jsonb_build_object('existing',false);
END $$;
REVOKE ALL ON FUNCTION public.desktop_begin_agent_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_begin_agent_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
