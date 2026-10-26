"""Exact existing QA only: passive catalog migration and fixtures always roll back."""
import glob,hashlib,json,os,re,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote

assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='b521a8fe-d803-4031-af23-4bb51f4e1e56'
assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1'
marker=Path('/mnt/f/Agentopia-Acceptance/agent-creation75-transition76-1792860573077-source/home/AppData/Roaming/Agentopia/schema-release.json')
before_marker=marker.read_bytes();release=json.loads(before_marker);assert release['version']=='0.44.83' and release['schema']==89
state=json.loads(subprocess.check_output(['supabase','status','--output-format','json'],text=True,stderr=subprocess.DEVNULL));url=urlparse(state['env']['DB_URL']);assert url.port==60750;assert urlparse(state['env']['API_URL']).port==60749
psql=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''));args=[psql,'-XqAt','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres']
def query(sql):
 result=subprocess.run(args,input=sql,capture_output=True,text=True,env=env)
 if result.returncode or 'ERROR:' in result.stderr:raise RuntimeError(result.stderr)
 return result.stdout.strip()

# Only hashes leave PostgreSQL. Include all public account/application rows,
# the auth account rows, migration history, public function definitions and ACLs.
tables=json.loads(query("SELECT json_agg(row_to_json(t)) FROM (SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','agentopia_desktop') OR schemaname='auth' AND tablename='users' ORDER BY schemaname,tablename) t;"))
def baseline():
 hashes=[]
 for table in tables:
  schema=table['schemaname'].replace('"','""');name=table['tablename'].replace('"','""')
  hashes.append(query('SELECT count(*)::text||\':\'||md5(coalesce(string_agg(value,\'\' ORDER BY value),\'\')) FROM (SELECT to_jsonb(t)::text value FROM "'+schema+'"."'+name+'" t) x;'))
 hashes.append(query("SELECT md5(string_agg(oid::regprocedure::text||pg_get_functiondef(oid)||coalesce(proacl::text,''),'' ORDER BY oid::regprocedure::text)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';"))
 return hashlib.sha256(json.dumps(hashes).encode()).hexdigest()
assert query('SELECT count(*) FROM agentopia_desktop.migrations;')=='89'
before=baseline();root=Path(__file__).resolve().parents[2]
migration=(root/'desktop/database/0090-agent-builder-resources.sql').read_text()
instructions=re.search(r'export const builderInstructions=`([\s\S]*?)`;', (root/'desktop/src/agent-builder.ts').read_text()).group(1)
policy={'tools':[],'delegation':False,'delegateAgents':[],'memory':False,'memoryWrite':False,'maxDepth':0,'maxTurns':1}
behavior={'handle':'agent-builder','role':'Agent configuration assistant','sops':'','guardrails':'Propose configuration edits only.','skills':[],'policy':policy}
entry={'id':'existing-app','name':'Existing app','description':'Public metadata','enabled':True,'configured':True,'assigned':False}
snapshot={'name':'Agent builder','description':'Create and improve agent configuration','instructions':instructions,'personality':'','provider':'openai-oauth','model':'owner-selected-model','thinking':'default','behavior':behavior,'execution':{'permission':'chat','mode':'chat','files':[]},'builder':{'name':'Resource target','description':'Public target','instructions':'x'*500000,'behavior':behavior,'appearance':{'version':1,'icon':'bot','color':'blue','starters':None},'resources':{'revision':7,'apps':[entry],'skills':[{**entry,'id':'11111111-1111-4111-8111-111111111111','digest':'a'*64,'assigned':True}]}}}
snapshot_json=json.dumps(snapshot,ensure_ascii=False).replace("'","''")
fixture=r"""
DO $test$
DECLARE owner uuid; snapshot jsonb=SNAPSHOT; original jsonb; malformed jsonb; candidate jsonb; row jsonb; again jsonb; sid uuid=gen_random_uuid(); rid uuid=gen_random_uuid(); creation uuid=gen_random_uuid(); rejected integer=0;
BEGIN
 SELECT id INTO owner FROM auth.users ORDER BY id LIMIT 1;IF owner IS NULL THEN RAISE EXCEPTION 'QA account required';END IF;
 original=snapshot#>'{builder,resources}';
 row=desktop_begin_scoped_preview(owner,sid,rid,NULL,snapshot,'Passive bounded catalog check',NULL,creation);
 IF row->'snapshot'<>snapshot OR length(row#>>'{snapshot,builder,instructions}')<>500000 THEN RAISE EXCEPTION 'Captured catalog or full Instructions changed'; END IF;
 UPDATE desktop_preview_requests SET status='completed',output_text='Retained local test result; no inference' WHERE id=rid AND user_id=owner;
 again=desktop_begin_scoped_preview(owner,sid,rid,NULL,snapshot,'Passive bounded catalog check',NULL,creation);
 IF again->'existing'<>'true'::jsonb OR again->'snapshot'<>snapshot OR again->>'output_text'<>'Retained local test result; no inference' THEN RAISE EXCEPTION 'Accepted request identity or result changed'; END IF;
 BEGIN PERFORM desktop_begin_scoped_preview(owner,sid,rid,NULL,jsonb_set(snapshot,'{builder,resources,revision}','8'),'Passive bounded catalog check',NULL,creation);RAISE EXCEPTION 'Changed identity accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Changed identity accepted' THEN RAISE;END IF;END;
 -- Historical snapshots omit the optional catalog and remain readable/retryable.
 candidate=jsonb_set(snapshot,'{builder}',(snapshot->'builder')-'resources');
 PERFORM desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),NULL,candidate,'Historical passive target',NULL,gen_random_uuid());
 FOR malformed IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
  'null'::jsonb,'[]'::jsonb,original||'{"token":"forbidden"}'::jsonb,original-'revision',jsonb_set(original,'{revision}','0'),jsonb_set(original,'{revision}','9007199254740992'),jsonb_set(original,'{revision}','"seven"'),
  jsonb_set(original,'{apps,0,url}','"https://example.com"'),jsonb_set(original,'{apps,0,id}','"https://example.com"'),jsonb_set(original,'{apps,0,name}','""'),jsonb_set(original,'{apps,0,description}',to_jsonb(repeat('x',1001))),
  jsonb_set(original,'{apps,0,enabled}','"true"'),jsonb_set(original,'{skills,0,digest}','"bad"'),jsonb_set(original,'{apps}',jsonb_build_array(original#>'{apps,0}',original#>'{apps,0}')),
  jsonb_set(original,'{skills}',(SELECT jsonb_agg(jsonb_set(original#>'{skills,0}','{id}',to_jsonb('skill-'||n))) FROM generate_series(1,500) n)))) LOOP
  candidate=jsonb_set(snapshot,'{builder,resources}',malformed);
  BEGIN PERFORM desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),NULL,candidate,'Malformed catalog',NULL,gen_random_uuid());RAISE EXCEPTION 'Malformed catalog accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Malformed catalog accepted' THEN RAISE;END IF;rejected=rejected+1;END;
 END LOOP;
 IF rejected<>15 THEN RAISE EXCEPTION 'Invalid catalog cases missing'; END IF;
 PERFORM desktop_validate_builder_resources(jsonb_set(original,'{revision}','null'));
 PERFORM desktop_validate_builder_resources(jsonb_set(original,'{skills}',(SELECT jsonb_agg(jsonb_set(original#>'{skills,0}','{id}',to_jsonb('skill-'||n))) FROM generate_series(1,499) n)));
 FOR candidate IN SELECT value FROM jsonb_array_elements(jsonb_build_array(jsonb_set(snapshot,'{behavior,policy,tools}','null'),jsonb_set(snapshot,'{behavior,policy,delegation}','true'),jsonb_set(snapshot,'{behavior,policy,memory}','true'),jsonb_set(snapshot,'{execution,permission}','"full"'))) LOOP
  BEGIN PERFORM desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),NULL,candidate,'Authority change',NULL,gen_random_uuid());RAISE EXCEPTION 'Builder authority accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Builder authority accepted' THEN RAISE;END IF;END;
 END LOOP;
 BEGIN PERFORM desktop_begin_scoped_preview(owner,gen_random_uuid(),gen_random_uuid(),NULL,snapshot,repeat('m',100001),NULL,gen_random_uuid());RAISE EXCEPTION 'Message bound widened';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Message bound widened' THEN RAISE;END IF;END;
 IF has_function_privilege('authenticated','desktop_validate_builder_resources(jsonb)','EXECUTE') OR has_function_privilege('anon','desktop_validate_builder_resources(jsonb)','EXECUTE') OR NOT has_function_privilege('service_role','desktop_validate_builder_resources(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Resource validator grants differ'; END IF;
END $test$;
""".replace('SNAPSHOT',"'"+snapshot_json+"'::jsonb")
# Keep ON_ERROR_STOP off so ROLLBACK executes even after migration/fixture error.
result=subprocess.run(args,input='BEGIN;\n'+migration+'\n'+fixture+'\nROLLBACK;',capture_output=True,text=True,env=env)
assert before==baseline(),'QA rows, migrations, functions or grants changed after rollback'
assert marker.read_bytes()==before_marker
assert query("SELECT to_regprocedure('public.desktop_validate_builder_resources(jsonb)') IS NULL;")=='t'
if result.returncode or 'ERROR:' in result.stderr:raise RuntimeError(result.stderr)
print(json.dumps({'success':True,'isolatedPort':60750,'schemaMarker':89,'releaseMarker':'0.44.83','transactionRolledBack':True,'tableFingerprintsRestored':len(tables),'providerRequests':0,'checks':['500000 character Instructions and catalog retained','identical request returns retained result','changed request identity rejected','historical catalog-free snapshot accepted','15 malformed catalogs rejected','500 combined entries accepted and 501 rejected','chat-only tools memory delegation enforced','message limit stays100000','validator service-role only','all table/function/grant fingerprints restored']}))
