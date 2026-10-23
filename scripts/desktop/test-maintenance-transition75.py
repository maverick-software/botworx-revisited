"""Rehearse72-to73 in a stopped generated database and restore its exact schema/data."""
import glob,json,os,re,subprocess,sys,traceback,uuid
from pathlib import Path
from urllib.parse import urlparse,unquote
from audit_logical_snapshot71 import audit
os.umask(0o077)
root=Path('/mnt/f/Agentopia');out,intent,assets=map(Path,sys.argv[1:4]);cfg=json.loads(intent.read_text());instance=str(uuid.UUID(cfg['instance']))
assert intent.is_relative_to(root/'.supabase/desktop-agent-creation75-real') and out.parent==root/'.supabase/desktop-maintenance75-transition'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==instance and instance!='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==cfg['portBase']+2 and db.port!=57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0];env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGAPPNAME='agentopia_schema73_transition_fixture')
def sql(query):
 r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',env=env,text=True,capture_output=True)
 if r.returncode:(out/'private-query-error.log').write_text(r.stderr);raise RuntimeError('Inspect private-query-error.log')
 return r.stdout.strip()
def literal(value):return "'"+value.replace("'","''")+"'"
def snapshot(destination):
 r=subprocess.run(['python3','/opt/agentopia/manage.py','backup',str(destination)],capture_output=True,text=True,timeout=180)
 (out/(destination.name+'.log')).write_text(r.stdout+'\n'+r.stderr);assert r.returncode==0
sig='public.desktop_create_agent_presentation(uuid,uuid,text,text,text,text,text,jsonb,text)';migration='0073-agent-creation-presentation.sql';migration_sql=(assets/'database'/migration).read_text();e={'success':False,'productionAccess':False,'providerRequests':0,'actualPostgres':True,'checks':[]};dropped=False;restored=False
try:
 assert sql("SELECT count(*) FROM desktop_requests")=='0';assert sql("SELECT count(*) FROM agentopia_desktop.migrations")=='73'
 before=json.loads(sql("SELECT json_build_object('migration',(SELECT to_jsonb(t) FROM agentopia_desktop.migrations t WHERE version='"+migration+"'),'function',pg_get_functiondef('"+sig+"'::regprocedure),'index',pg_get_indexdef('public.desktop_agent_creation_owner'::regclass))"));(out/'private-schema-before.json').write_text(json.dumps(before))
 snapshot(out/'original73')
 sql('BEGIN;DROP INDEX public.desktop_agent_creation_owner;DROP FUNCTION '+sig+";DELETE FROM agentopia_desktop.migrations WHERE version='"+migration+"';COMMIT;");dropped=True;assert sql("SELECT count(*) FROM agentopia_desktop.migrations")=='72';snapshot(out/'baseline72')
 e['checks'].append('The generated database is temporarily on the exact prior72 migration set, with all original application/account rows retained.')
 sql('BEGIN;'+migration_sql+';INSERT INTO agentopia_desktop.migrations SELECT * FROM jsonb_populate_record(NULL::agentopia_desktop.migrations,'+literal(json.dumps(before['migration']))+'::jsonb);COMMIT;');restored=True
 comparison=out/'after73';comparison.mkdir();result=audit(out/'baseline72',comparison,instance,db.port);assert result['success'] and result['tablesCompared']==128 and result['schemaMigrations']==73;e['transitionAudit']=str(comparison/'evidence.json');e['transitionRowsCompared']=result['savedRowsCompared']
 e['checks'].append('The exact packaged73 migration passes strict comparison of every prior128-table saved row, password/role and encryption-root binding.')
 after=json.loads(sql("SELECT json_build_object('migration',(SELECT to_jsonb(t) FROM agentopia_desktop.migrations t WHERE version='"+migration+"'),'function',pg_get_functiondef('"+sig+"'::regprocedure),'index',pg_get_indexdef('public.desktop_agent_creation_owner'::regclass))"));assert after==before;e['exactSchemaRestored']=True
 e['checks'].append('The prior function, unique index and original migration timestamp/checksum are restored exactly.')
 e['checksPassed']=True
except Exception as error:e['error']=str(error);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
 try:
  if dropped and not restored:
   sql('BEGIN;'+migration_sql+';INSERT INTO agentopia_desktop.migrations SELECT * FROM jsonb_populate_record(NULL::agentopia_desktop.migrations,'+literal(json.dumps(before['migration']))+'::jsonb);COMMIT;');restored=True
  if (out/'original73/manifest.json').exists():
   final=out/'original-comparison';final.mkdir();r=audit(out/'original73',final,instance,db.port);assert r['success'] and r['tablesCompared']==128 and r['schemaMigrations']==73;e['previousRowsAndSchemaRestored']=bool(restored and e.get('exactSchemaRestored'));e['originalAudit']=str(final/'evidence.json')
 except Exception as error:e['cleanupError']=str(error);(out/'private-cleanup-error.log').write_text(traceback.format_exc())
 e['success']=bool(e.get('checksPassed') and e.get('previousRowsAndSchemaRestored'));(out/'evidence.json').write_text(json.dumps(e,indent=2))
print(json.dumps({'success':e['success'],'checks':len(e['checks']),'previousRowsAndSchemaRestored':e.get('previousRowsAndSchemaRestored'),'error':e.get('error'),'cleanupError':e.get('cleanupError')}),flush=True)
sys.exit(0 if e['success'] else 1)
