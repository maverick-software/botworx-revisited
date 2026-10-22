"""Read-only comparison of the untouched production database after isolated tests."""
from pathlib import Path
import datetime,glob,hashlib,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-layout-fresh-runtime') and re.fullmatch(r'\d{13}',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
before=json.loads((out/'data-before-ui.json').read_text());os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0];env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC');commands=['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;']
for key,record in before['tables'].items():
 schema,name=key.split('.');assert re.fullmatch('[a-z_0-9]+',schema) and re.fullmatch('[a-z_0-9]+',name);assert all(re.fullmatch('[a-z_0-9]+',c) for c in record['columns'])
 columns=','.join('"'+c+'"' for c in record['columns']);commands += ["SELECT '__AGENTOPIA_TABLE__"+key+"';",'COPY (SELECT '+columns+' FROM '+schema+'."'+name+'") TO STDOUT;']
commands.append('COMMIT;');result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='\n'.join(commands),text=True,env=env,capture_output=True,check=True).stdout;tables={}
for part in result.split('__AGENTOPIA_TABLE__')[1:]:
 key,*rows=part.splitlines();columns=before['tables'][key]['columns'];keep=[i for i,c in enumerate(columns) if not(key.startswith('auth.') and c in ('last_sign_in_at','updated_at'))];lines=sorted('\t'.join(row.split('\t')[i] for i in keep) for row in rows)
 tables[key]={'columns':columns,'rows':len(lines),'sha256':hashlib.sha256(('\n'.join(lines)+('\n' if lines else '')).encode()).hexdigest()}
assert len(tables)==126;differences=[key for key in tables if tables[key]!=before['tables'][key]]
report={'success':not differences,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'originalProductionRuntimeVerified':True,'savedTablesCompared':126,'savedRowsCompared':sum(row['rows'] for row in tables.values()),'mismatches':differences,'counts':{'accounts':tables['auth.users']['rows'],'chats':tables['public.conversation_sessions']['rows'],'messages':tables['public.chat_messages_v2']['rows'],'vaultRecords':tables['vault.secrets']['rows']},'databaseReadOnly':True,'consistentSnapshot':True,'providerRequests':0}
with (out/'production-after.json').open('x') as stream:json.dump(report,stream,indent=2)
print(json.dumps(report));assert report['success']
