"""Inspect only numeric activity and preservation fingerprints in the active local runtime."""
import os,json,glob,subprocess,sys,hashlib
from urllib.parse import urlparse,unquote
from pathlib import Path
os.chdir('/home/sylvana/app')
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(s['env']['DB_URL']);binary=glob.glob('/home/sylvana/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
def sql(q):
 r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='begin read only;'+q+';commit;',env=env,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Local read-only audit failed')
 return json.loads(r.stdout)
tables=['conversation_sessions','chat_messages_v2','agents','desktop_projects','desktop_requests','desktop_agent_instances']
counts=sql("select jsonb_build_object("+','.join("'"+t+"',(select count(*) from public."+t+")" for t in tables)+")")
activity=sql("select jsonb_build_object('requests',(select count(*) from public.desktop_requests where status='running'),'instances',(select count(*) from public.desktop_agent_instances where status in ('running','awaiting_approval')),'goals',(select count(*) from public.desktop_goals where status='running'))")
identities=sql("select coalesce(jsonb_agg(jsonb_build_object('id',id,'password_fingerprint',md5(encrypted_password)) order by id),'[]') from auth.users")
turns=sql("select coalesce(jsonb_agg(state),'[]') from public.desktop_codex_turns")
busy=0
def inspect(state):
 global busy
 for entry in state.get('items',[]):
  if entry.get('background')=='running':busy+=1
 for child in state.get('children',[]):
  if child.get('status') in ('running','awaiting_approval'):busy+=1
  inspect(child.get('state',{}))
 for report in state.get('reports',[]):
  if report.get('status') in ('running','awaiting_approval'):busy+=1
  inspect(report.get('state',{}))
for row in turns:inspect(row)
default_assistants=sql("select to_jsonb(count(*)) from agents where metadata->>'desktop_creation_id'='9c3fc705-595d-48f3-8ae2-40bd2e37b0dc'")
result={'readOnly':True,'defaultAssistants':default_assistants,'counts':counts,'identityFingerprint':hashlib.sha256(json.dumps(identities,sort_keys=True).encode()).hexdigest(),'activity':activity,'nativeBusy':busy,'idle':not any(activity.values()) and busy==0,'at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
if '--firm-connections' in sys.argv:
    result['firmConnectionSchema']=sql("select jsonb_build_object('migrationApplied',exists(select 1 from sylvana_desktop.migrations where version='0093-firm-ai-connections.sql'),'providerConstraints',(select count(*) from pg_constraint where conname in ('desktop_codex_threads_provider_check','desktop_preview_codex_threads_provider_check') and position('openai-api' in pg_get_constraintdef(oid))>0 and position('sylvana' in pg_get_constraintdef(oid))>0))")
print(json.dumps(result))
