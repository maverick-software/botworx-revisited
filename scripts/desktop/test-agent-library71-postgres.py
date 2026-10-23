"""Temporarily qualify schema72 in the owned restored QA runtime, then undo it."""
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import traceback
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse
from audit_logical_snapshot71 import audit

os.umask(0o077)
root=Path('/mnt/f/Agentopia');out=Path(sys.argv[1]);cfg=json.loads(Path(sys.argv[2]).read_text());source=json.loads(Path(sys.argv[3]).read_text())
assert out.parent==root/'.supabase/desktop-agent-library71' and out.name.startswith('postgres-')
assert cfg['role']=='restored' and cfg['instance']=='7d87fd24-b2da-41ea-81a9-e9a764327845'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==cfg['instance']
os.chdir('/home/agentopia/app')
e={'success':False,'productionAccess':False,'providerRequests':0,'checks':[]};applied=False;started=False
agents=[str(uuid.uuid4()),str(uuid.uuid4())];quota=str(uuid.uuid4());attempted=str(uuid.uuid4());extra=str(uuid.uuid4())
private=out/'private-client.json';checkpoint=out/'checkpoint.json';foreign_checkpoint=out/'foreign-owner.json';owner=None;binary=None
def sql(query,expect=True):
 r=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,env=env,capture_output=True)
 if expect and r.returncode:(out/'private-query-error.log').write_text(r.stderr);raise RuntimeError('Inspect private-query-error.log')
 return r.stdout.strip() if expect else r
def windows(p):return subprocess.check_output(['wslpath','-w',str(p)],text=True).strip()
try:
 r=subprocess.run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],capture_output=True,text=True,timeout=300)
 (out/'private-start.log').write_text(r.stdout+'\n'+r.stderr);assert r.returncode==0;started=True
 state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL'])
 assert url.port==cfg['portBase']+2 and url.port!=57322
 binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
 env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_library71_generated_only')
 assert sql("SELECT to_regclass('public.desktop_media_revisions') IS NULL")=='t'
 assert sql('SELECT count(*) FROM agentopia_desktop.migrations')=='71'
 original_import=sql("SELECT pg_get_functiondef('public.desktop_import_agent_document(uuid,uuid,uuid,jsonb)'::regprocedure)")
 backup=out/'before-database';r=subprocess.run(['python3','/opt/agentopia/manage.py','backup',str(backup)],capture_output=True,text=True,timeout=180);assert r.returncode==0
 (out/'original-import.sql').write_text(original_import)
 owner=sql('SELECT id FROM auth.users ORDER BY id LIMIT 1');assert str(uuid.UUID(owner))==owner
 for aid in agents:sql("INSERT INTO agents(id,user_id,name,description,system_instructions,assistant_instructions,active) VALUES('"+aid+"','"+owner+"','Generated library71 fixture','','Generated fixture','',true)")
 sql('BEGIN;\n'+(root/'desktop/database/0072-agent-document-library.sql').read_text()+'\nCOMMIT;');applied=True
 sql("NOTIFY pgrst,'reload schema'")
 api=state['env']['API_URL'].replace('localhost','127.0.0.1');assert urlparse(api).port!=57321
 configuration={'owner':owner,'agent':agents[0],'peer':agents[1],'base':api,'token':state['env']['SERVICE_ROLE_KEY'],'anon':state['env']['ANON_KEY'],
  'distribution':cfg['distribution'],'build':source['build'],'pdfAssets':cfg['assets']+'\\ui','temp':windows(out/'inputs'),'checkpoint':windows(checkpoint),
  'foreignCheckpoint':windows(foreign_checkpoint),'result':windows(out/'client-result.json')}
 private.write_text(json.dumps(configuration))
 electron_windows=subprocess.check_output(['/mnt/c/Program Files/nodejs/node.exe','-p',"require('electron')"],cwd=root,text=True).strip()
 electron=subprocess.check_output(['wslpath','-u',electron_windows],text=True).strip()
 r=subprocess.run([electron,windows(root/'scripts/desktop/test-agent-library71-electron.cjs'),windows(private)],capture_output=True,text=True,timeout=240,
  env={**{k:v for k,v in os.environ.items() if k not in ('NODE_OPTIONS','ELECTRON_RUN_AS_NODE')},'AGENTOPIA_DOCUMENT_TEST_RESOURCES':cfg['assets'],'TEMP':windows(out/'inputs'),'TMP':windows(out/'inputs')})
 (out/'private-client.log').write_text(r.stdout+'\n'+r.stderr);assert r.returncode==0,'Inspect private-client.log'
 client=json.loads((out/'client-result.json').read_text());assert client['success'];e['checks']+=client['checks']
 foreign=str(uuid.UUID(client['foreignOwner']));foreign_agent=str(uuid.UUID(client['foreignAgent']))
 sql("INSERT INTO media_library(id,user_id,file_name,file_type,file_size,file_extension,storage_bucket,storage_path,processing_status,text_content,version) VALUES('"+quota+"','"+foreign+"','Quota.md','text/markdown',1,'.md','agentopia-desktop-database','"+foreign+'/'+quota+"','completed','q',13)")
 sql("INSERT INTO desktop_media_files(media_id,user_id,bytes) VALUES('"+quota+"','"+foreign+"','q'::bytea)")
 sql("INSERT INTO desktop_media_revisions(media_id,version,user_id,document,bytes) SELECT '"+quota+"',n,'"+foreign+"','{}',convert_to(repeat('Q',20971520),'UTF8') FROM generate_series(1,12)n")
 payload="(SELECT jsonb_build_object('name','Quota.pdf','extension','.pdf','mime','application/pdf','text','','base64',replace(encode(bytes,'base64'),E'\\n',''),'sha256',encode(sha256(bytes),'hex'),'truncated',false) FROM (SELECT convert_to(repeat('R',20971520),'UTF8') bytes) x)"
 rejected=sql("SELECT desktop_import_agent_document('"+foreign+"','"+foreign_agent+"','"+attempted+"',"+payload+")",False)
 assert rejected.returncode!=0 and '256 MB' in rejected.stderr
 rejected=sql("SELECT desktop_update_library_document('"+foreign+"','"+foreign_agent+"','"+quota+"',13,(SELECT updated_at FROM media_library WHERE id='"+quota+"'),'replace',"+payload+")",False)
 assert rejected.returncode!=0 and '256 MB' in rejected.stderr
 assert sql("SELECT count(*) FROM desktop_media_revisions WHERE media_id='"+quota+"'")=='12'
 assert sql("SELECT count(*) FROM media_library WHERE id='"+attempted+"'")=='0'
 e['checks'].append('Retained previous originals count toward the real 256 MB account quota; import and replacement fail atomically before adding rows or history.')
 sql("UPDATE desktop_media_files SET user_id='"+owner+"' WHERE media_id='"+quota+"'")
 rejected=sql("SELECT desktop_update_library_document('"+foreign+"','"+foreign_agent+"','"+quota+"',13,(SELECT updated_at FROM media_library WHERE id='"+quota+"'),'archive','{}')",False)
 assert rejected.returncode!=0 and 'ownership' in rejected.stderr
 sql("UPDATE desktop_media_files SET user_id='"+foreign+"' WHERE media_id='"+quota+"'")
 e['checks'].append('A malformed original-owner binding is rejected before archive or history capture; the generated binding is repaired before cleanup.')
 sql("INSERT INTO media_library(user_id,file_name,file_type,file_size,file_extension,storage_path) SELECT '"+foreign+"','Limit-'||n||'.txt','text/plain',1,'.txt','library71-limit-'||n FROM generate_series(1,199)n")
 call=lambda operation:"SELECT desktop_update_library_document('"+foreign+"','"+foreign_agent+"','"+quota+"',13,(SELECT updated_at FROM media_library WHERE id='"+quota+"'),'"+operation+"','{}')"
 sql(call('archive'))
 sql("INSERT INTO media_library(id,user_id,file_name,file_type,file_size,file_extension,storage_path) VALUES('"+extra+"','"+foreign+"','Extra.txt','text/plain',1,'.txt','library71-extra')")
 rejected=sql(call('restore'),False);assert rejected.returncode!=0 and '200' in rejected.stderr
 sql("UPDATE media_library SET is_archived=true WHERE id='"+extra+"'");sql(call('restore'))
 e['checks'].append('The active 200-document limit also applies to restoration; freeing one active slot permits restoration without assignments.')
 e['clientAndLimitsPassed']=True
except Exception as error:
 e['error']=str(error);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
 try:
  if binary:
   if foreign_checkpoint.exists():
    foreign=str(uuid.UUID(json.loads(foreign_checkpoint.read_text())['owner']));sql("DELETE FROM auth.users WHERE id='"+foreign+"'")
   if checkpoint.exists():
    for mid in json.loads(checkpoint.read_text())['ids']:
     mid=str(uuid.UUID(mid));sql("DELETE FROM media_library WHERE id='"+mid+"' AND user_id='"+owner+"'")
   for aid in agents:sql("DELETE FROM agents WHERE id='"+aid+"' AND user_id='"+owner+"'")
   if applied:
    sql("BEGIN; DROP TRIGGER desktop_validate_document_assignment ON agent_media_assignments; DROP FUNCTION desktop_validate_document_assignment(); DROP FUNCTION desktop_save_agent_settings(uuid,uuid,text,jsonb); ALTER FUNCTION desktop_save_agent_settings_v71(uuid,uuid,text,jsonb) RENAME TO desktop_save_agent_settings; GRANT EXECUTE ON FUNCTION desktop_save_agent_settings(uuid,uuid,text,jsonb) TO service_role; DROP FUNCTION desktop_update_library_document(uuid,uuid,uuid,integer,timestamptz,text,jsonb),desktop_library_document_versions(uuid,uuid,uuid),desktop_save_agent_document_assignments(uuid,uuid,jsonb); "+original_import+"; DROP FUNCTION desktop_document_payload_bytes(jsonb),desktop_document_storage_limit(uuid,bigint); DROP TABLE desktop_media_revisions; COMMIT;")
    sql("NOTIFY pgrst,'reload schema'")
   comparison=out/'after-comparison';comparison.mkdir()
   restored=audit(out/'before-database',comparison,cfg['instance'],cfg['portBase']+2)
   e['previousRowsAndSchemaRestored']=restored['success'] and restored['tablesCompared']==127 and sql("SELECT to_regclass('public.desktop_media_revisions') IS NULL")=='t'
 except Exception as error:
  e['cleanupError']=str(error);(out/'private-cleanup-traceback.log').write_text(traceback.format_exc())
 if private.exists():private.unlink()
 if started:
  stopped=subprocess.run(['supabase','stop'],capture_output=True,text=True,timeout=120);e['qaServicesStopped']=stopped.returncode==0
 e['success']=bool(e.get('clientAndLimitsPassed') and e.get('previousRowsAndSchemaRestored') and e.get('qaServicesStopped'))
 (out/'evidence.json').write_text(json.dumps(e,indent=2))
print(json.dumps({'success':e['success'],'checks':len(e['checks']),'previousRowsAndSchemaRestored':e.get('previousRowsAndSchemaRestored'),'error':e.get('error'),'cleanupError':e.get('cleanupError')}),flush=True)
sys.exit(0 if e['success'] else 1)
