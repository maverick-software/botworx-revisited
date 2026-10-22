"""Audit only the uniquely bound disposable restored database."""
from pathlib import Path
import datetime,glob,hashlib,json,os,re,subprocess,sys,tomllib
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-layout-fresh-runtime') and re.fullmatch(r'\d{13}',out.name)
intent=json.loads((out/'intent.json').read_text());assert Path('/opt/agentopia/runtime-instance').read_text().strip()==intent['instanceId']
assert intent['instanceId']!='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==intent['ports']['database']
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]);env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC')
def sql(statement):
    return subprocess.run([str(binary),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=statement,text=True,env=env,capture_output=True,check=True).stdout
before=json.loads((out/'data-before-ui.json').read_text());commands=['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;']
for key,record in before['tables'].items():
    schema,name=key.split('.');assert re.fullmatch('[a-z_0-9]+',schema) and re.fullmatch('[a-z_0-9]+',name);assert all(re.fullmatch('[a-z_0-9]+',c) for c in record['columns'])
    columns=','.join('"'+c+'"' for c in record['columns']);commands += ["SELECT '__AGENTOPIA_TABLE__"+key+"';",'COPY (SELECT '+columns+' FROM '+schema+'."'+name+'") TO STDOUT;']
commands.append('COMMIT;');tables={}
for part in sql('\n'.join(commands)).split('__AGENTOPIA_TABLE__')[1:]:
    key,*rows=part.splitlines();record=before['tables'][key];columns=record['columns'];keep=[i for i,c in enumerate(columns) if not(key.startswith('auth.') and c in ('last_sign_in_at','updated_at'))]
    lines=sorted('\t'.join(row.split('\t')[i] for i in keep) for row in rows);tables[key]={'columns':columns,'rows':len(lines),'sha256':hashlib.sha256(('\n'.join(lines)+('\n' if lines else '')).encode()).hexdigest()}
assert len(tables)==126;differences=[key for key in tables if tables[key]!=before['tables'][key]];assert not differences,differences
source_root=(out/'profile/migration-input/pgsodium_root.key').read_text().strip();roots=list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'));states=list(Path('/home/agentopia/.supabase/stacks').glob('*/state.json'));assert len(roots)==len(states)==1
assert roots[0].read_text().strip()==source_root and json.loads(states[0].read_text())['credentials']['postgresRootKey']==source_root
assert json.loads(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').read_text())['root_key']==source_root and tomllib.loads(Path('supabase/config.toml').read_text())['db']['root_key']==source_root
versions=json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations'))
assert versions==intent['migrations']
readable=int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'));assert readable==tables['vault.secrets']['rows']
report={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'savedTablesCompared':126,'savedRowsCompared':sum(t['rows'] for t in tables.values()),'mismatches':[],'migrationsCompared':len(versions),'readableVaultRecords':readable,'encryptionRootBindingsVerified':4,'databaseReadOnly':True,'providerRequests':0,'services':[{k:s[k] for k in ('service','state','health')}for s in state['services']]}
print(json.dumps(report))
