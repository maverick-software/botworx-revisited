import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {desktopOperation} from './operation-lock.mjs';
desktopOperation('add versioned creation resource acceptance without altering historical migrations');
const source=(await readFile('desktop/database/0076-preview-creation-identity.sql','utf8')).replaceAll('\r\n','\n');
const start=source.indexOf('CREATE FUNCTION public.desktop_begin_scoped_preview('),end=source.indexOf('\nEND $$;',start)+'\nEND $$;'.length;assert(start>=0&&end>start);
let body=source.slice(start,end).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
const change=(old,value)=>{assert.equal(body.split(old).length,2,old);body=body.replace(old,()=>value);};
change('normalized_root text; normalized_reference text;','normalized_root text; normalized_reference text; creation_scope public.desktop_creation_tool_scopes;');
change(" requested=coalesce(p_snapshot->'execution'",` IF p_context->'version'='2'::jsonb THEN
  SELECT * INTO request FROM public.desktop_preview_requests WHERE id=p_request;
  IF FOUND THEN
   IF p_source IS NOT NULL OR p_creation IS NULL OR request.user_id<>p_user OR request.conversation_id<>p_session OR request.snapshot<>p_snapshot OR request.input_text<>p_text OR request.execution_context IS DISTINCT FROM p_context OR request.creation_id IS DISTINCT FROM p_creation THEN RAISE EXCEPTION 'This preview request identifier was already used'; END IF;
   SELECT * INTO session FROM public.desktop_preview_sessions WHERE id=p_session;
   IF NOT FOUND OR session.user_id<>p_user OR session.source_agent_id IS NOT NULL OR session.creation_id IS DISTINCT FROM p_creation THEN RAISE EXCEPTION 'This preview belongs to a different scope'; END IF;
   RETURN to_jsonb(request)||jsonb_build_object('existing',true);
  END IF;
 END IF;
 requested=coalesce(p_snapshot->'execution'`);
change("p_context - ARRAY['version','owner','key','options','references','roots','inputFiles','definitions','policy','pluginFiles','workspaceSkills','remoteTools']","p_context - ARRAY['version','owner','key','options','references','roots','inputFiles','definitions','policy','pluginFiles','workspaceSkills','remoteTools','creationResources']");
change("p_context->'version'<>'1'::jsonb","p_context->'version' NOT IN ('1'::jsonb,'2'::jsonb)");
change("  IF p_context ? 'remoteTools' THEN",`  IF p_context->'version'='2'::jsonb THEN
   reference=p_context->'creationResources';
   IF p_creation IS NULL OR p_source IS NOT NULL OR p_context ? 'pluginFiles' OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['kind','id','creationId','revision']) OR reference - ARRAY['kind','id','creationId','revision']<>'{}'::jsonb OR reference->>'kind' IS DISTINCT FROM 'creation' OR reference->>'creationId' IS DISTINCT FROM p_creation::text OR jsonb_typeof(reference->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(reference->'revision') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid creation preview resource identity'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||':'||p_creation::text,0));
   SELECT * INTO creation_scope FROM public.desktop_creation_tool_scopes WHERE user_id=p_user AND creation_id=p_creation FOR SHARE;
   IF NOT FOUND OR creation_scope.bound_agent_id IS NOT NULL OR reference->>'id' IS DISTINCT FROM creation_scope.id::text OR reference->'revision' IS DISTINCT FROM to_jsonb(creation_scope.revision) THEN RAISE EXCEPTION 'The creation app selection changed or was saved'; END IF;
   PERFORM public.desktop_validate_creation_plugin_grants(p_user,creation_scope.grants);
  ELSIF p_context ? 'creationResources' THEN RAISE EXCEPTION 'Creation resources require a versioned creation preview context'; END IF;
  IF p_context ? 'remoteTools' THEN`);
const remoteLine=body.split('\n').find(line=>line.startsWith('   IF p_source IS NULL OR requested'));assert(remoteLine);
change(remoteLine,`   IF reference->'version'='2'::jsonb THEN
    IF p_context->'version'<>'2'::jsonb OR requested->>'permission' NOT IN ('ask','full') OR jsonb_typeof(reference) IS DISTINCT FROM 'object' OR NOT(reference ?& ARRAY['version','owner','principal','mode','sources','definitions','bindings','key']) OR reference - ARRAY['version','owner','principal','mode','sources','definitions','bindings','key']<>'{}'::jsonb OR reference->'principal' IS DISTINCT FROM p_context->'creationResources' OR reference->>'owner' IS DISTINCT FROM p_user::text OR reference->>'mode' IS DISTINCT FROM requested->>'mode' OR jsonb_typeof(reference->'key') IS DISTINCT FROM 'string' OR reference->>'key' !~ '^[a-f0-9]{64}$' OR jsonb_typeof(reference->'sources') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'definitions') IS DISTINCT FROM 'array' OR jsonb_typeof(reference->'bindings') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid owned creation preview connection binding'; END IF;
   ELSE
${remoteLine}
    IF p_context->'version'='2'::jsonb THEN RAISE EXCEPTION 'A creation cannot borrow a saved-agent connection binding'; END IF;
   END IF;`);
const sourceLine=body.split('\n').find(line=>line.includes("THEN RAISE EXCEPTION 'Invalid selected preview connection'"));assert(sourceLine);
change(sourceLine,sourceLine+"\n    IF p_context->'version'='2'::jsonb THEN PERFORM public.desktop_validate_creation_remote_source(p_user,creation_scope.id,skill); END IF;");
const helpers=`-- Accept creation-owned connections with an explicit, revision-bound resource identity.
-- Historical 0074-0077 migrations and existing version1 requests remain intact.
CREATE FUNCTION public.desktop_creation_connection_id(p_scope uuid,p_plugin text,p_server text) RETURNS uuid
 LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path=public,extensions,pg_temp AS $$
 WITH hash AS (SELECT encode(digest('['||to_json('agentopia-creation-mcp-v1'::text)::text||','||to_json(p_scope::text)::text||','||to_json(p_plugin)::text||','||to_json(p_server)::text||']','sha256'),'hex') value)
 SELECT (substr(value,1,8)||'-'||substr(value,9,4)||'-8'||substr(value,14,3)||'-'||substr('89ab',(strpos('0123456789abcdef',substr(value,17,1))-1)%4+1,1)||substr(value,18,3)||'-'||substr(value,21,12))::uuid FROM hash;
$$;
CREATE FUNCTION public.desktop_validate_creation_remote_source(p_user uuid,p_scope uuid,p_source jsonb) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM desktop_creation_tool_scopes c CROSS JOIN LATERAL jsonb_array_elements(c.grants) g
  JOIN desktop_plugins p ON p.user_id=c.user_id AND p.name=g->>'name' AND p.digest=g->>'digest' AND p.enabled AND p.source<>'legacy'
  WHERE c.id=p_scope AND c.user_id=p_user AND c.bound_agent_id IS NULL AND p_source->>'plugin'=p.name AND (
   p_source->>'id'='web_search' AND p.package#>>'{manifest,extensions,com.agentopia,adapter}' IN ('serper','tavily')
   OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(p.package#>'{mcp,mcpServers}','{}'::jsonb)) d WHERE p_source->>'id'='mcp:'||public.desktop_creation_connection_id(c.id,p.name,d.key)::text AND coalesce(d.value#>>'{extensions,com.openai,auth,type}','none')='none')
  )
 ) THEN RAISE EXCEPTION 'This connection is not selected and ready for this creation'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.desktop_creation_connection_id(uuid,text,text),public.desktop_validate_creation_remote_source(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.desktop_creation_connection_id(uuid,text,text),public.desktop_validate_creation_remote_source(uuid,uuid,jsonb) TO service_role;

`;
assert(body.endsWith('END $$;'));
await writeFile('desktop/database/0078-preview-creation-resources.sql',helpers+body+"\nNOTIFY pgrst,'reload schema';\n",{flag:'wx'});
console.log('Created migration0078 with retained version1 validation and version2 creation bindings.');
