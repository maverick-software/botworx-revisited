"""Disposable generated database using the installed native PostgreSQL/PostgREST binaries."""
import glob,hashlib,json,os,re,subprocess,sys,traceback,uuid
from pathlib import Path
from urllib.parse import urlparse,unquote
from importlib.util import spec_from_file_location,module_from_spec
os.umask(0o077)
root=Path('/mnt/f/Agentopia');out=Path(sys.argv[1]).resolve();build=sys.argv[2];temp=sys.argv[3]
assert out.parent==root/'.supabase/desktop-chat-file-history69' and out.name.startswith('postgres-') and out.is_dir()
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL']);assert url.port==57322
psql=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql');assert len(psql)==1
database='agentopia_delivery_'+uuid.uuid4().hex[:16];assert re.fullmatch('agentopia_delivery_[a-f0-9]{16}',database)
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_file_history69_fixture')
e={'success':False,'database':database,'productionWrites':0,'providerRequests':0,'actualPostgreSQL':True,'actualPostgREST':True};created=False;rest=None;config=out/'private-client.json'
def sql(statement,target=None):
 target=target or database;query_env=dict(env)
 if target=='postgres' and statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):query_env['PGOPTIONS']='-c default_transaction_read_only=on'
 result=subprocess.run([psql[0],'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d',target],input=statement+'\n',text=True,env=query_env,capture_output=True)
 if result.returncode:(out/'private-query-error.log').write_text(result.stderr);raise RuntimeError('Inspect private-query-error.log')
 return result.stdout.strip()
def production():
 return json.loads(sql("SELECT json_build_object('migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'users',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY id),'')) FROM auth.users t),'chats',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY conversation_id),'')) FROM conversation_sessions t),'messages',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY id),'')) FROM chat_messages_v2 t))",'postgres'))
def windows(file):return subprocess.check_output(['wslpath','-w',str(file)],text=True).strip()
try:
 e['productionBefore']=production();assert e['productionBefore']['migrations']==70
 sql('CREATE DATABASE '+database+' TEMPLATE template0','postgres');created=True
 sql("CREATE TABLE conversation_sessions(conversation_id uuid PRIMARY KEY,user_id uuid NOT NULL);CREATE TABLE chat_messages_v2(id uuid PRIMARY KEY,conversation_id uuid NOT NULL REFERENCES conversation_sessions,role text NOT NULL,content jsonb NOT NULL,desktop_sequence bigint NOT NULL);CREATE INDEX ON chat_messages_v2(conversation_id,desktop_sequence,id);CREATE TABLE desktop_codex_threads(conversation_id uuid REFERENCES conversation_sessions,user_id uuid,scope text);GRANT USAGE ON SCHEMA public TO service_role;GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA public TO service_role")
 spec=spec_from_file_location('native_postgrest',root/'scripts/desktop/native-postgrest-fixture.py');module=module_from_spec(spec);spec.loader.exec_module(module);rest=module.NativePostgrest(state['env']['DB_URL'],database,out/'private-postgrest.log',sql)
 config.write_text(json.dumps({'base':rest.base,'token':rest.token,'build':build,'temp':temp,'result':windows(out/'client-result.json')}))
 child=subprocess.run(['/mnt/c/Program Files/nodejs/node.exe',windows(root/'scripts/desktop/test-file-history69-native.cjs'),windows(config)],env={k:v for k,v in os.environ.items() if k not in ('NODE_OPTIONS','ELECTRON_RUN_AS_NODE')},capture_output=True,text=True,timeout=120)
 (out/'private-client.log').write_text(child.stdout+'\n'+child.stderr);assert child.returncode==0,'Inspect private-client.log'
 client=json.loads((out/'client-result.json').read_text());assert client['success'];e['clientChecks']=client['checks'];e['checksPassed']=True
except Exception as error:e['error']=str(error);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
 if config.exists():config.unlink()
 if rest:rest.close()
 if created:sql('DROP DATABASE '+database,'postgres');e['disposableDatabaseRemoved']=True
 e['productionAfter']=production();e['productionUnchanged']=e.get('productionBefore')==e['productionAfter'];e['success']=bool(e.get('checksPassed') and e.get('disposableDatabaseRemoved') and e['productionUnchanged']);(out/'evidence.json').write_text(json.dumps(e,indent=2))
print(json.dumps({'success':e['success'],'out':str(out),'checks':len(e.get('clientChecks',[])),'productionUnchanged':e['productionUnchanged'],'databaseRemoved':e.get('disposableDatabaseRemoved'),'error':e.get('error')}));sys.exit(0 if e['success'] else 1)
