"""Apply the migration to the owned restored QA database, then restore its schema.
The ordinary production runtime is never selected or contacted.
"""
import glob,hashlib,json,os,re,subprocess,sys,traceback,tomllib
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
root=Path('/mnt/f/Agentopia');out=Path(sys.argv[1]);build=sys.argv[2];temp=sys.argv[3]
assert out.parent==root/'.supabase/desktop-agent-documents70' and out.name.startswith('postgres-')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='0d473265-a4e8-4919-9e7f-9181ae61fed5'
os.chdir('/home/agentopia/app')
e={'success':False,'actualPostgreSQL':True,'actualPostgREST':True,'fullRestoredSchema':True,'productionAccess':False,'providerRequests':0,'checks':[]}
config=out/'private-client.json';started=False;applied=False;ids=[]
def windows(file):return subprocess.check_output(['wslpath','-w',str(file)],text=True).strip()
def sql(statement):
 result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=statement+'\n',text=True,env=env,capture_output=True)
 if result.returncode:(out/'private-query-error.log').write_text(result.stderr);raise RuntimeError('Inspect private-query-error.log')
 return result.stdout.strip()
def fingerprint():
 # Existing rows and password records are compared before/after the generated work.
 tables=json.loads(sql("SELECT json_agg(json_build_array(schemaname,tablename)) FROM pg_tables WHERE schemaname='public' OR schemaname='auth' AND tablename='users'"))
 result={}
 for schema,table in tables:
  assert re.fullmatch('[a-z_0-9]+',schema) and re.fullmatch('[a-z_0-9]+',table)
  result[schema+'.'+table]=sql('SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E\'\\n\' ORDER BY to_jsonb(t)::text),\'\')) FROM '+schema+'."'+table+'" t')
 return result
try:
 startup=subprocess.run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],text=True,capture_output=True,timeout=300)
 (out/'private-runtime-start.log').write_text(startup.stdout+'\n'+startup.stderr);assert startup.returncode==0;started=True
 state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL'])
 configured=tomllib.loads(Path('supabase/config.toml').read_text())['db']['port']
 assert url.port==configured and url.port!=57322,'The QA database must match its owned runtime configuration and exclude the production port.'
 binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
 env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_documents70_generated_fixture')
 assert sql("SELECT to_regclass('public.desktop_media_files') IS NULL")=='t'
 assert sql('SELECT count(*) FROM agentopia_desktop.migrations')=='70'
 e['before']=fingerprint()
 identity=json.loads(sql("SELECT json_build_object('owner',a.user_id,'agent',a.id) FROM agents a WHERE a.active AND NOT EXISTS(SELECT 1 FROM agent_media_assignments m WHERE m.agent_id=a.id AND m.is_active) ORDER BY a.id LIMIT 1"));assert identity
 sql('BEGIN;\n'+(root/'desktop/database/0071-agent-documents.sql').read_text()+'\nCOMMIT;');applied=True
 assert sql("SELECT NOT has_table_privilege('authenticated','public.desktop_media_files','SELECT') AND NOT has_function_privilege('authenticated','public.desktop_read_agent_document(uuid,uuid,uuid,boolean)','EXECUTE')")=='t'
 e['checks'].append('The migration applies to the complete restored schema; authenticated clients have no direct original-byte or broker-RPC access.')
 api=state['env']['API_URL'];assert urlparse(api).hostname in ('localhost','127.0.0.1')
 api=api.replace('localhost','127.0.0.1')
 cfg={**identity,'base':api,'token':state['env']['SERVICE_ROLE_KEY'],'build':build,'temp':temp,'result':windows(out/'client-result.json'),'checkpoint':windows(out/'checkpoint.json')}
 config.write_text(json.dumps(cfg))
 def client(phase):
  child=subprocess.run(['/mnt/c/Program Files/nodejs/node.exe',windows(root/'scripts/desktop/test-agent-documents70-native.cjs'),windows(config),phase],text=True,capture_output=True,timeout=180,env={k:v for k,v in os.environ.items() if k not in ('NODE_OPTIONS','ELECTRON_RUN_AS_NODE')})
  (out/('private-client-'+phase+'.log')).write_text(child.stdout+'\n'+child.stderr);assert child.returncode==0,'Inspect private-client-'+phase+'.log'
 client('seed');checkpoint=json.loads((out/'checkpoint.json').read_text());ids=checkpoint['ids'];assert ids and all(re.fullmatch('[a-f0-9-]{36}',value) for value in ids)
 archive=out/'originals.dump';connection=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres']
 dumped=subprocess.run([str(binary/'pg_dump'),*connection,'-Fc','--data-only','-t','public.desktop_media_files','-f',str(archive)],env=env,capture_output=True,text=True);assert dumped.returncode==0
 before=sql("SELECT md5(string_agg(media_id::text||sha256,',' ORDER BY media_id)) FROM desktop_media_files")
 sql('DELETE FROM desktop_media_files');assert sql('SELECT count(*) FROM desktop_media_files')=='0'
 restored=subprocess.run([str(binary/'pg_restore'),'--no-owner','--data-only',*connection,str(archive)],env=env,capture_output=True,text=True);(out/'private-originals-restore.log').write_text(restored.stderr);assert restored.returncode==0
 assert sql("SELECT md5(string_agg(media_id::text||sha256,',' ORDER BY media_id)) FROM desktop_media_files")==before
 e['checks'].append('Logical PostgreSQL backup restores every retained original byte after the original-byte table is emptied.')
 client('restored');client_result=json.loads((out/'client-result.json').read_text());assert client_result['success'];e['checks']+=client_result['checks'];e['clientPassed']=True
except Exception as error:
 e['error']=str(error);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
 if config.exists():config.unlink()
 if applied:
  # Only this run can create the dedicated storage bucket in the restored fixture.
  sql("DELETE FROM media_library WHERE storage_bucket='agentopia-desktop-database'; DROP FUNCTION public.desktop_import_agent_document(uuid,uuid,uuid,jsonb),public.desktop_agent_document_catalog(uuid,uuid),public.desktop_read_agent_document(uuid,uuid,uuid,boolean); DROP TABLE public.desktop_media_files;")
  e['after']=fingerprint();e['existingRowsAndSchemaRestored']=e.get('before')==e['after']
 if started:
  stopped=subprocess.run(['supabase','stop'],capture_output=True,text=True,timeout=120);e['qaServicesStopped']=stopped.returncode==0
 e['success']=bool(e.get('clientPassed') and e.get('existingRowsAndSchemaRestored') and e.get('qaServicesStopped'))
 (out/'evidence.json').write_text(json.dumps(e,indent=2))
print(json.dumps({'success':e['success'],'checks':len(e['checks']),'existingRowsAndSchemaRestored':e.get('existingRowsAndSchemaRestored'),'error':e.get('error')}));sys.exit(0 if e['success'] else 1)
