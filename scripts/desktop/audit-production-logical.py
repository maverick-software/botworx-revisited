"""Compare fresh recovery archives with the original read-only live database."""
from pathlib import Path
import datetime,glob,hashlib,json,os,re,subprocess,sys,tomllib
from urllib.parse import urlparse,unquote

out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-production-logical') and re.fullmatch(r'\d{13}',out.name)
evidence=json.loads((out/'evidence.json').read_text());assert evidence['success'] and evidence['distribution']=='AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
archive=out/'current-database-backup';manifest=json.loads((archive/'manifest.json').read_text());binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0]).parent
for record in manifest['files']:assert hashlib.file_digest((archive/record['name']).open('rb'),'sha256').hexdigest()==record['sha256']

def fingerprint(columns,rows,schema):
    keep=[i for i,name in enumerate(columns) if schema!='auth' or name not in ('last_sign_in_at','updated_at')]
    lines=sorted('\t'.join(row.split('\t')[i] for i in keep) for row in rows)
    return {'columns':columns,'rows':len(lines),'sha256':hashlib.sha256(('\n'.join(lines)+('\n' if lines else '')).encode()).hexdigest()}

tables={};account_ids=[]
for schema,name in [('public','application.dump'),('auth','auth.dump'),('vault','vault.dump')]:
    text=subprocess.check_output([str(binary/'pg_restore'),'--data-only','--file=-',str(archive/name)],text=True)
    for match in re.finditer(r'^COPY ([a-z_]+)\."?([a-z_0-9]+)"? \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S):
        found,table=match.group(1,2)
        if found!=schema or (schema=='auth' and table!='users') or (schema=='vault' and table!='secrets'):continue
        columns=[c.strip().strip('"') for c in match[3].split(',')];assert all(re.fullmatch('[a-z_0-9]+',c) for c in columns)
        rows=match[4].splitlines();tables[schema+'.'+table]=fingerprint(columns,rows,schema)
        if schema=='auth':account_ids=sorted(row.split('\t')[columns.index('id')] for row in rows)
assert len(tables)==126 and account_ids==sorted(manifest['accountIds'])
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==57322
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC')
commands=['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;']
for key,record in tables.items():
    schema,name=key.split('.');columns=','.join('"'+c+'"' for c in record['columns']);commands += ["SELECT '__AGENTOPIA_TABLE__"+key+"';",'COPY (SELECT '+columns+' FROM '+schema+'."'+name+'") TO STDOUT;']
commands.append('COMMIT;')
def sql(text):return subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=text,text=True,env=env,capture_output=True,check=True).stdout
actual={}
for block in sql('\n'.join(commands)).split('__AGENTOPIA_TABLE__')[1:]:
    key,*rows=block.splitlines();actual[key]=fingerprint(tables[key]['columns'],rows,key.split('.')[0])
differences=[key for key in tables if tables[key]!=actual[key]];assert not differences,differences
source_key=(archive/'pgsodium_root.key').read_text().strip();roots=list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'));states=list(Path('/home/agentopia/.supabase/stacks').glob('*/state.json'));assert len(roots)==len(states)==1
assert roots[0].read_text().strip()==source_key and json.loads(states[0].read_text())['credentials']['postgresRootKey']==source_key
assert json.loads(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').read_text())['root_key']==source_key and tomllib.loads(Path('supabase/config.toml').read_text())['db']['root_key']==source_key
readable=int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'));assert readable==tables['vault.secrets']['rows']
report={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'tablesCompared':126,'savedRowsCompared':sum(t['rows'] for t in tables.values()),'accountPasswordAndRoleRowsPreserved':True,'accounts':tables['auth.users']['rows'],'chats':tables['public.conversation_sessions']['rows'],'messages':tables['public.chat_messages_v2']['rows'],'readableVaultRecords':readable,'encryptionRootBindingsVerified':4,'snapshotAccountIdsVerifiedAgainstArchive':True,'mismatches':differences,'databaseReadOnly':True,'servicesRestarted':0,'providerRequests':0}
(out/'independent-verification.json').write_text(json.dumps(report,indent=2));(out/'archive-table-fingerprints.json').write_text(json.dumps(tables,indent=2));print(json.dumps(report),flush=True)
