"""Read-only fingerprints of saved account and chat tables for the UI update."""
from pathlib import Path
import datetime,glob,hashlib,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote
assert len(sys.argv)==3 and sys.argv[1] in ('before','after','check')
mode=sys.argv[1];out=Path(sys.argv[2]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-responsive-context') and re.fullmatch(r'\d{13}',out.name)
scope=json.loads(Path('/mnt/d/Users/charl/AgentopiaRecovery/recovery-bootstrap-15/1792477990357/data-before-ui.json').read_text())['tables']
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0])
os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));started=False
if 'DB_URL' not in stack.get('env',{}):
    assert mode=='before','Reopen the verified existing runtime before comparing saved data'
    root=Path('/opt/agentopia');assert(root/'runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1' and(root/'runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
    directories=list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/data/PG_VERSION'));assert len(directories)==1 and directories[0].read_text().strip()=='17'
    assert(directories[0].parent/'global/pg_control').is_file() and(directories[0].parent.parent/'pgsodium_root.key').is_file()
    subprocess.run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],capture_output=True,text=True,check=True,timeout=240)
    stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));started=True
db=urlparse(stack['env']['DB_URL'])
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC')
commands=['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;']
for key,record in scope.items():
    schema,name=key.split('.');assert re.fullmatch('[a-z_0-9]+',schema) and re.fullmatch('[a-z_0-9]+',name)
    assert all(re.fullmatch('[a-z_0-9]+',c) for c in record['columns'])
    columns=','.join('"'+c+'"' for c in record['columns']);commands += ["SELECT '__AGENTOPIA_TABLE__"+key+"';",'COPY (SELECT '+columns+' FROM '+schema+'."'+name+'") TO STDOUT;']
commands.append('COMMIT;')
result=subprocess.run([str(binary),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='\n'.join(commands),text=True,env=env,capture_output=True,check=True).stdout
tables={}
for part in result.split('__AGENTOPIA_TABLE__')[1:]:
    key,*rows=part.splitlines();record=scope[key];columns=record['columns'];keep=[i for i,c in enumerate(columns) if not(key.startswith('auth.') and c in ('last_sign_in_at','updated_at'))]
    lines=sorted('\t'.join(row.split('\t')[i] for i in keep) for row in rows)
    tables[key]={'rows':len(lines),'sha256':hashlib.sha256(('\n'.join(lines)+('\n' if lines else '')).encode()).hexdigest()}
assert len(tables)==126
report={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tables':tables,'tableCount':len(tables),'databaseReadOnly':True,'consistentSnapshot':True,'existingRuntimeStarted':started,'providerRequests':0}
if mode=='after':
    before=json.loads((out/'data-before.json').read_text());report['mismatches']=[key for key in tables if tables[key]!=before['tables'][key]];report['success']=not report['mismatches']
with (out/('data-'+mode+'.json')).open('x') as stream:json.dump(report,stream,indent=2)
print(json.dumps({k:v for k,v in report.items() if k!='tables'}));assert report['success']
