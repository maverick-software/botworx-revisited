"""Read only the generated live-agent case; never submit or recover requests."""
from pathlib import Path
import datetime,glob,json,os,subprocess,sys,uuid
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]);assert out.resolve()==out and out.is_relative_to(Path('/mnt/f/Agentopia/.supabase/desktop-live-agents62/1792630528847'))
e=json.loads((out/'evidence.json').read_text());root=str(uuid.UUID(e['rootRequest']));owner='810f3e3a-ea15-45a7-a8aa-a87d04ff7c32'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='c0e548ce-f913-4746-9e2e-9a466362c900'
os.umask(0o077);os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port!=57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_live_agents62_readonly')
query=f"""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH ids AS (SELECT '{root}'::uuid AS id UNION SELECT request_id FROM desktop_agent_invocations WHERE origin_request_id='{root}' AND user_id='{owner}')
SELECT jsonb_build_object('requests',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'error',error,'conversation_id',conversation_id)) FROM desktop_requests WHERE id IN (SELECT id FROM ids) AND user_id='{owner}'),'invocations',(SELECT jsonb_agg(to_jsonb(t)-'payload') FROM desktop_agent_invocations t WHERE origin_request_id='{root}' AND user_id='{owner}'));
COMMIT;"""
r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query,env=env,text=True,capture_output=True)
if r.returncode:
    (out/'private-read-query-error.txt').write_text(r.stderr);raise RuntimeError('Read-only query failed; private diagnostic retained')
value={'readOnly':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),**json.loads(r.stdout)}
(out/('read-only-observation-'+str(int(datetime.datetime.now().timestamp()*1000))+'.json')).write_text(json.dumps(value,indent=2))
print(json.dumps(value))
