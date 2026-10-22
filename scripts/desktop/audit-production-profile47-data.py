"""Back up and compare saved application data around a UI-only replacement."""
from pathlib import Path
import datetime, glob, hashlib, json, os, subprocess, sys
from urllib.parse import urlparse, unquote

candidate=Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-platform-release/candidate-04447')
pointer=json.loads((candidate.parent.parent/'desktop-profile-location/production47-current.json').read_text())
work=Path(pointer['out'].replace('C:\\','/mnt/c/').replace('\\','/'))
assert sys.argv[1:] in (['before'],['after-normal'],['after-host'],['after-host-visible'],['after-host-hidden-before-close'])
mode=sys.argv[1]
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077)
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(state['env']['DB_URL'])
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC')
args=['-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres']
def sql(statement):
 result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*args],input=statement,env=env,text=True,capture_output=True)
 assert result.returncode==0,'Read-only data check failed'
 return result.stdout
assert sql("SELECT count(*) FROM public.desktop_requests WHERE status='running'").strip()=='0','A response is still running'
assert sql("SELECT count(*) FROM public.desktop_goals WHERE status='running'").strip()=='0','An Agentopia goal is still active'
tables=json.loads(sql("SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"))
summary={}
for schema,name in [('public',name) for name in tables]+[('auth','users'),('vault','secrets')]:
 assert name.replace('_','').isalnum()
 # Sign-in bookkeeping changes when the application reopens; account credentials remain included.
 expression="to_jsonb(t)-'last_sign_in_at'-'updated_at'" if schema=='auth' else 'to_jsonb(t)'
 rows=sql(f'SELECT {expression} FROM {schema}."{name}" t ORDER BY ({expression})::text')
 summary[schema+'.'+name]={'rows':len(rows.splitlines()),'sha256':hashlib.sha256(rows.encode()).hexdigest()}
if mode=='before':
 backup=work/'database.dump'
 result=subprocess.run([str(binary/'pg_dump'),'-Fc',*args,'-f',str(backup)],env=env,capture_output=True)
 assert result.returncode==0,'Database recovery archive failed'
 result=subprocess.run([str(binary/'pg_restore'),'--list',str(backup)],capture_output=True)
 assert result.returncode==0 and b'TABLE DATA' in result.stdout
else:
 before=json.loads((work/'data-before.json').read_text())
 assert summary==before['tables'],'Saved application rows changed across the UI replacement'
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':mode,'tables':summary,'tableCount':len(summary),'providerRequests':0,'databaseReadOnly':True}
if mode=='before':
 with backup.open('rb') as stream:receipt['backupSha256']=hashlib.file_digest(stream,'sha256').hexdigest()
 receipt['backup']=str(backup)
with (work/('data-'+mode+'.json')).open('x') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps({k:v for k,v in receipt.items() if k!='tables'}))
