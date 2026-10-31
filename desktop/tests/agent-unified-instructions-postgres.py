"""Isolated existing QA only. Forward migration and fixtures always roll back."""
import glob,json,os,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote
assert Path('/opt/sylvana/runtime-instance').read_text().strip()=='b521a8fe-d803-4031-af23-4bb51f4e1e56'
assert Path('/opt/sylvana/runtime-identity').read_text().strip()=='local.sylvana.desktop-runtime.v1'
marker=Path('/mnt/f/Sylvana-Acceptance/agent-creation75-transition76-1792860573077-source/home/AppData/Roaming/Sylvana/schema-release.json')
before_marker=marker.read_bytes();release=json.loads(before_marker);assert release['version']=='0.44.82' and release['schema']==88
state=json.loads(subprocess.check_output(['supabase','status','--output-format','json'],text=True,stderr=subprocess.DEVNULL));url=urlparse(state['env']['DB_URL']);assert url.port==60750;assert urlparse(state['env']['API_URL']).port==60749
psql=glob.glob('/home/sylvana/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''))
args=[psql,'-XqAt','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres']
def query(sql):
 r=subprocess.run(args,input=sql,capture_output=True,text=True,env=env)
 if r.returncode or 'ERROR:' in r.stderr:raise RuntimeError(r.stderr)
 return r.stdout.strip()
baseline_sql="SELECT json_build_object('migrations',coalesce((SELECT json_agg(row_to_json(m)) FROM (SELECT * FROM sylvana_desktop.migrations ORDER BY version) m),'[]'::json),'profiles',(SELECT count(*) FROM desktop_agent_profiles),'revisions',(SELECT count(*) FROM desktop_agent_definition_revisions),'agents',(SELECT count(*) FROM agents),'previews',(SELECT count(*) FROM desktop_preview_requests),'newRpc',to_regprocedure('public.desktop_save_agent_unified(uuid,uuid,text,text,text,text,text,jsonb)')::text,'previewFunction',md5(pg_get_functiondef('public.desktop_begin_scoped_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb,uuid)'::regprocedure)),'creationFunction',md5(pg_get_functiondef('public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text)'::regprocedure)),'saveFunction',md5(pg_get_functiondef('public.desktop_save_agent(uuid,uuid,text,text,text,text,text)'::regprocedure)));"
baseline=query(baseline_sql)
grants_sql="SELECT json_agg(row_to_json(x)) FROM (SELECT oid::regprocedure::text signature,proacl FROM pg_proc WHERE oid IN ('public.desktop_save_agent(uuid,uuid,text,text,text,text,text)'::regprocedure,'public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text)'::regprocedure,'public.desktop_begin_scoped_preview(uuid,uuid,uuid,uuid,jsonb,text,jsonb,uuid)'::regprocedure) ORDER BY oid::regprocedure::text) x;"
grants=query(grants_sql)
root=Path(__file__).resolve().parents[2];migration=(root/'desktop/database/0089-unified-agent-instructions.sql').read_text()
fixture=r"""
DO $test$
DECLARE owner uuid; foreign_owner uuid; a uuid; foreign_agent uuid; legacy jsonb; unified jsonb; old_profile jsonb; next_profile jsonb; old_snapshot jsonb; row jsonb; again jsonb; sid uuid=gen_random_uuid(); rid uuid=gen_random_uuid(); long_text text=repeat('i',404500); old_basic jsonb; old_raw_profile jsonb; revision_count bigint; rev bigint; appearance jsonb='{"version":1,"icon":"bot","color":"blue","starters":null}'; builder_snapshot jsonb;
BEGIN
 SELECT id INTO owner FROM auth.users ORDER BY id LIMIT 1;SELECT id INTO foreign_owner FROM auth.users WHERE id<>owner ORDER BY id LIMIT 1;
 IF owner IS NULL OR foreign_owner IS NULL THEN RAISE EXCEPTION 'Two QA accounts required'; END IF;
 a=desktop_save_agent(owner,NULL,'Unified QA','Original description',E' Original instructions.\n','openai-oauth','owner-selected-model');
 foreign_agent=desktop_save_agent(foreign_owner,NULL,'Foreign QA','','Foreign instructions','openrouter','foreign-model');
 old_profile=desktop_agent_profile(owner,a);
 legacy=jsonb_build_object('handle','unified-'||replace(a::text,'-',''),'role',E'  Rôle 東京\n','sops',E'\nRead.\n\nReport.  ','guardrails',' Keep seal. ','skills',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name','Original skill','description',E'Exact description\n','content',E'\nPreserve original content.  ','sha256',repeat('a',64))),'policy','{"tools":["read_file"],"delegation":false,"delegateAgents":[],"memory":true,"memoryWrite":false,"maxDepth":0,"maxTurns":1}'::jsonb);
 old_profile=desktop_save_agent_profile(owner,a,(old_profile->>'revision')::bigint,legacy);rev=(old_profile->>'revision')::bigint;
 old_snapshot=jsonb_build_object('name','Legacy preview','description','','instructions',E' Original instructions.\n','personality','','provider','openai-oauth','model','owner-selected-model','thinking','default','behavior',legacy||jsonb_build_object('skills',jsonb_build_array((legacy#>'{skills,0}')-'sha256')),'execution','{"permission":"chat","mode":"chat","files":[]}'::jsonb);
 row=desktop_begin_scoped_preview(owner,sid,rid,a,old_snapshot,'Original accepted question',NULL,NULL);
 UPDATE desktop_preview_requests SET status='completed',output_text='Original accepted answer' WHERE id=rid AND user_id=owner;
 unified=legacy||'{"role":"","sops":"","guardrails":"","skills":[]}'::jsonb||jsonb_build_object('revision',rev);
 PERFORM desktop_save_agent_unified(owner,a,'Unified QA','Saved description',long_text,'openai-oauth','owner-selected-model',unified);
 next_profile=desktop_agent_profile(owner,a);
 IF next_profile->>'handle'<>legacy->>'handle' OR next_profile->'policy'<>legacy->'policy' OR next_profile->>'role'<>'' OR next_profile->>'sops'<>'' OR next_profile->>'guardrails'<>'' OR next_profile->'skills'<>'[]'::jsonb OR next_profile#>>'{definition,instructions}'<>long_text OR (next_profile->>'revision')::bigint<>rev+1 THEN RAISE EXCEPTION 'Unified atomic save did not retain text, identity and policy exactly'; END IF;
 IF (SELECT definition FROM desktop_agent_definition_revisions WHERE agent_id=a AND revision=rev)<>old_profile->'definition' THEN RAISE EXCEPTION 'Original raw recovery definition changed'; END IF;
 IF (SELECT jsonb_build_object('provider',provider,'model',model) FROM agent_llm_preferences WHERE agent_id=a)<>'{"provider":"openai-oauth","model":"owner-selected-model"}'::jsonb THEN RAISE EXCEPTION 'Selected model changed'; END IF;
 again=desktop_begin_scoped_preview(owner,sid,rid,a,old_snapshot,'Original accepted question',NULL,NULL);
 IF again->'snapshot'<>old_snapshot OR again->>'output_text'<>'Original accepted answer' OR again->'existing'<>'true'::jsonb THEN RAISE EXCEPTION 'Accepted preview was normalized or replayed'; END IF;
 BEGIN PERFORM desktop_begin_scoped_preview(owner,sid,rid,a,jsonb_set(old_snapshot,'{instructions}','"changed"'),'Original accepted question',NULL,NULL);RAISE EXCEPTION 'Changed preview identity accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Changed preview identity accepted' THEN RAISE;END IF;END;
 old_basic=(SELECT to_jsonb(x) FROM agents x WHERE id=a);
 BEGIN PERFORM desktop_save_agent_unified(owner,a,'Stale name','Stale description','Stale text','openrouter','other-model',unified);RAISE EXCEPTION 'Stale save accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Stale save accepted' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_save_agent_unified(foreign_owner,a,'Foreign name','','Foreign edit','openrouter','other-model',unified);RAISE EXCEPTION 'Foreign save accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Foreign save accepted' THEN RAISE;END IF;END;
 unified=jsonb_set(unified,'{revision}',next_profile->'revision');
 BEGIN PERFORM desktop_save_agent_unified(owner,a,'Bad delegate','','Bad edit','openai-oauth','owner-selected-model',jsonb_set(unified,'{policy,delegateAgents}',jsonb_build_array(foreign_agent)));RAISE EXCEPTION 'Foreign delegate accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Foreign delegate accepted' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_save_agent_unified(owner,a,'Bad policy','','Bad edit','openai-oauth','owner-selected-model',jsonb_set(unified,'{policy,memory}','"yes"'));RAISE EXCEPTION 'Invalid policy accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Invalid policy accepted' THEN RAISE;END IF;END;
 BEGIN PERFORM desktop_save_agent_unified(owner,a,'Oversize','','x'||repeat('x',500000),'openai-oauth','owner-selected-model',unified);RAISE EXCEPTION 'Oversized instructions accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Oversized instructions accepted' THEN RAISE;END IF;END;
 IF (SELECT to_jsonb(x) FROM agents x WHERE id=a)<>old_basic OR desktop_agent_profile(owner,a)<>next_profile THEN RAISE EXCEPTION 'Rejected save partially wrote fields'; END IF;
 PERFORM desktop_save_agent_unified(owner,a,'Unified QA','Saved description',long_text,'openai-oauth','owner-selected-model',unified);
 IF desktop_agent_profile(owner,a)<>next_profile THEN RAISE EXCEPTION 'Reopening and saving duplicate normalized guidance or revisions'; END IF;
 -- Another editor can change basic fields before its profile snapshot refresh.
 -- The unified save must detect that revision and roll its temporary snapshot
 -- and history insertion back together with all proposed basic fields.
 PERFORM desktop_save_agent(owner,a,'External basic edit','External description',long_text,'openai-oauth','owner-selected-model');
 old_basic=(SELECT to_jsonb(x) FROM agents x WHERE id=a);old_raw_profile=(SELECT to_jsonb(x) FROM desktop_agent_profiles x WHERE agent_id=a);SELECT count(*) INTO revision_count FROM desktop_agent_definition_revisions WHERE agent_id=a;
 BEGIN PERFORM desktop_save_agent_unified(owner,a,'Overwrite attempt','','Lost guidance','openai-oauth','owner-selected-model',unified);RAISE EXCEPTION 'Unrefreshed external basic edit accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unrefreshed external basic edit accepted' THEN RAISE;END IF;END;
 IF (SELECT to_jsonb(x) FROM agents x WHERE id=a)<>old_basic OR (SELECT to_jsonb(x) FROM desktop_agent_profiles x WHERE agent_id=a)<>old_raw_profile OR (SELECT count(*) FROM desktop_agent_definition_revisions WHERE agent_id=a)<>revision_count THEN RAISE EXCEPTION 'Stale external edit changed basic, profile or history'; END IF;
 row=desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),a,jsonb_set(old_snapshot,'{instructions}',to_jsonb(repeat('x',500000))),'Preview long instructions',NULL,NULL);
 IF length(row#>>'{snapshot,instructions}')<>500000 THEN RAISE EXCEPTION 'Preview truncated instructions'; END IF;
 BEGIN PERFORM desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),a,old_snapshot,repeat('m',100001),NULL,NULL);RAISE EXCEPTION 'Message limit widened';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Message limit widened' THEN RAISE;END IF;END;
 builder_snapshot=old_snapshot||jsonb_build_object('behavior',jsonb_set(old_snapshot->'behavior','{policy}','{"tools":[],"delegation":false,"delegateAgents":[],"memory":false,"memoryWrite":false,"maxDepth":0,"maxTurns":1}'::jsonb),'builder',jsonb_build_object('name','Passive target','description','','instructions',repeat('b',500000),'behavior',unified-'revision','appearance',appearance));
 PERFORM desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),a,builder_snapshot,'Generate starters',NULL,NULL);
 a=desktop_create_agent_definition(owner,gen_random_uuid(),'New unified agent','',repeat('n',500000),'openai-oauth','new-selected-model',appearance,NULL,jsonb_set(unified-'revision','{handle}',to_jsonb('new-'||replace(gen_random_uuid()::text,'-',''))));
 next_profile=desktop_agent_profile(owner,a);
 IF next_profile->>'role'<>'' OR next_profile->>'sops'<>'' OR next_profile->>'guardrails'<>'' OR next_profile->'skills'<>'[]'::jsonb OR length(next_profile#>>'{definition,instructions}')<>500000 THEN RAISE EXCEPTION 'New agent restored defunct guidance sources or truncated text'; END IF;
 IF has_function_privilege('authenticated','desktop_save_agent_unified(uuid,uuid,text,text,text,text,text,jsonb)','EXECUTE') OR has_function_privilege('anon','desktop_save_agent_unified(uuid,uuid,text,text,text,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Client can bypass broker'; END IF;
END $test$;
"""
# ON_ERROR_STOP stays off so ROLLBACK is sent even if the migration or fixture
# fails. Any SQL error is detected after the connection has rolled back.
r=subprocess.run(args,input='BEGIN;\n'+migration+'\n'+fixture+'\n'+grants_sql+'\nROLLBACK;',capture_output=True,text=True,env=env)
after=query(baseline_sql);assert baseline==after,'QA records, schema, function definitions or migration history changed';assert marker.read_bytes()==before_marker
if r.returncode or 'ERROR:' in r.stderr:raise RuntimeError(r.stderr)
assert r.stdout.strip()==grants,'Historical privileged function grants changed'
print(json.dumps({'success':True,'isolatedPort':60750,'transactionRolledBack':True,'schemaMarker':88,'releaseMarker':'0.44.82','providerRequests':0,'checks':['atomic instruction and behavior commit','original raw recovery revision retained','selected provider and model retained','accepted preview snapshot and retry unchanged','changed preview identity refused','stale and foreign saves write nothing','foreign delegates refused','oversized instructions refused','repeat save idempotent','500000 character preview and builder target retained','message limit stays100000','new unified agent has no legacy guidance sources','privileged API only','migration/function/record state restored']}))
