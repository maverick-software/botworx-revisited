import os,json,glob,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote
os.chdir('/home/sylvana/app')
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(s['env']['DB_URL']);binary=glob.glob('/home/sylvana/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''))
payload=json.loads(Path('/mnt/f/Sylvana/verification/default-assistant/input.json').read_text());quote=lambda v:"'"+str(v).replace("'","''")+"'"
args=','.join(k+'=>'+('null' if v is None else quote(json.dumps(v))+'::jsonb' if isinstance(v,dict) else quote(v)) for k,v in payload.items())
query="""begin;DO $verify$ DECLARE owner uuid;a uuid;b uuid;original jsonb;afterward jsonb;BEGIN
 SELECT id INTO owner FROM auth.users ORDER BY created_at LIMIT 1;
 IF owner IS NULL THEN RAISE EXCEPTION 'No fixture owner available';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') INTO original FROM agents x WHERE user_id=owner AND coalesce(metadata->>'desktop_creation_id','')<>%s;
 a=desktop_create_agent_presentation(p_user=>owner,%s);
 b=desktop_create_agent_presentation(p_user=>owner,%s);
 IF a IS DISTINCT FROM b OR (SELECT count(*) FROM agents WHERE user_id=owner AND metadata->>'desktop_creation_id'=%s)<>1 THEN RAISE EXCEPTION 'Default assistant is not idempotent';END IF;
 IF NOT EXISTS(SELECT 1 FROM agents x JOIN agent_llm_preferences p ON p.agent_id=x.id WHERE x.id=a AND x.user_id=owner AND x.active AND x.name='Sylvana' AND p.provider='sylvana' AND p.model='standard') THEN RAISE EXCEPTION 'Default assistant is not ready';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') INTO afterward FROM agents x WHERE user_id=owner AND x.id<>a;
 IF original IS DISTINCT FROM afterward THEN RAISE EXCEPTION 'Existing custom agents changed';END IF;
 IF has_function_privilege('authenticated','public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text)','execute') THEN RAISE EXCEPTION 'Creation privilege expanded';END IF;
 END $verify$;rollback;"""%(quote(payload['p_creation']),args,args,quote(payload['p_creation']))
r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query,env=env,text=True,capture_output=True)
if r.returncode:raise RuntimeError('Default assistant transaction check failed: '+r.stderr[-1000:])
result={'success':True,'sameAssistantOnRetry':True,'readyForManagedChat':True,'existingCustomAgentsUnchanged':True,'serverOnlyCreation':True,'transactionRolledBack':True}
Path('/mnt/f/Sylvana/verification/default-assistant/database-proof.json').write_text(json.dumps(result));print(json.dumps(result))
