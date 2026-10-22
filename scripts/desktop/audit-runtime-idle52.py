"""Read saved native activity before a normal maintenance closure."""
from pathlib import Path
import datetime,glob,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote

out=Path(sys.argv[1])
assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-agent-health52') and re.fullmatch(r'\d{13}',out.name)
assert out.resolve()==out and out.is_dir()
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app')
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(s['env']['DB_URL']);assert db.port==57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
query="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT coalesce(jsonb_agg(jsonb_build_object('request',request_id,'state',state)),'[]') FROM desktop_codex_turns; COMMIT;"
r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query,env=env,text=True,capture_output=True)
if r.returncode:
    (out/'private-native-idle-error.txt').write_text(r.stderr)
    raise RuntimeError('Native idle query failed; private diagnostic retained')
rows=json.loads(r.stdout);busy=[]
def inspect(state,request):
    for entry in state.get('items',[]):
        if entry.get('background')=='running':busy.append({'request':request,'kind':'background-command'})
    for child in state.get('children',[]):
        if child.get('status') in ('running','awaiting_approval'):busy.append({'request':request,'kind':'native-child'})
        inspect(child.get('state',{}),request)
    for report in state.get('reports',[]):
        if report.get('status') in ('running','awaiting_approval'):busy.append({'request':request,'kind':'native-report'})
        inspect(report.get('state',{}),request)
for row in rows:inspect(row['state'],row['request'])
e={'success':not busy,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'databaseReadOnly':True,'nativeRows':len(rows),'busy':busy,'providerRequests':0}
(out/'runtime-idlecheck.json').write_text(json.dumps(e,indent=2));print(json.dumps(e));sys.exit(0 if e['success'] else 1)
