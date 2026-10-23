"""Read the completed QA records after cold application/database acceptance."""
import glob,json,os,re,subprocess,sys,tomllib,uuid
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
out=Path(sys.argv[1]);cfg=json.loads(Path(sys.argv[2]).read_text());f=json.loads(Path(sys.argv[3]).read_text())
assert out.parent==Path(sys.argv[2]).parent and out.name.startswith('cold-audit-')
assert cfg['role']=='source' and cfg['distribution']=='AgentopiaRuntime-'+cfg['instance'] and cfg['instance']!='a91a4800-e08f-4440-a4ec-588762d01bfd'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==cfg['instance']
owner=str(uuid.UUID(f['owner']));ids=[str(uuid.UUID(f[key])) for key in ['directRequest','routerRequest','parentRequest','namedRequest','scheduledRequest']]+[str(uuid.UUID(f['library'][key])) for key in ['archiveRequest','replaceRequest','pdfRequest']]
task=str(uuid.UUID(f['taskId']));run=str(uuid.UUID(f['runId']));parent=str(uuid.UUID(f['parentRequest']));instance=str(uuid.UUID(f['namedInstance']))
os.chdir('/home/agentopia/app');e={'success':False,'providerRequests':0,'productionAccess':False,'databaseReadOnly':True}
try:
 started=subprocess.run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],capture_output=True,text=True,timeout=300)
 (out/'private-start.log').write_text(started.stdout+'\n'+started.stderr);assert started.returncode==0
 state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL']);assert url.port==tomllib.loads(Path('supabase/config.toml').read_text())['db']['port'] and url.port!=57322
 binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
 env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_document_cold71_readonly')
 query="SELECT jsonb_build_object('requests',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status)) FROM desktop_requests WHERE user_id='"+owner+"' AND id IN("+','.join("'"+value+"'" for value in ids)+")),'report',(SELECT state->'reports' FROM desktop_codex_turns WHERE user_id='"+owner+"' AND request_id='"+parent+"'),'task',(SELECT status FROM desktop_scheduled_tasks WHERE user_id='"+owner+"' AND id='"+task+"'),'runs',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'request',request_id)) FROM desktop_scheduled_runs WHERE user_id='"+owner+"' AND task_id='"+task+"'),'originals',(SELECT jsonb_object_agg(media_id::text,sha256) FROM desktop_media_files WHERE user_id='"+owner+"'),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations));"
 result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n',env=env,capture_output=True,text=True)
 if result.returncode:(out/'private-query-error.log').write_text(result.stderr);raise RuntimeError('Read-only cold audit query failed')
 saved=json.loads(result.stdout);assert saved['migrations']==72
 denied={f['library']['archiveRequest'],f['library']['replaceRequest']}
 assert len(saved['requests'])==8 and all(row['status']==('failed' if row['id'] in denied else 'completed') for row in saved['requests'])
 assert any(report['status']=='completed' and any(item['instanceId']==instance for item in report.get('assignments',[])) for report in saved['report'])
 assert saved['task']=='paused' and len(saved['runs'])==1 and saved['runs'][0]['id']==run and saved['runs'][0]['status']=='completed' and saved['runs'][0]['request']==f['scheduledRequest']
 assert saved['originals']==dict(zip(f['documents'],f['originals']))
 e.update({'records':saved,'savedRequests':8,'expectedRevokedRequests':2,'parentReportRetained':True,'singleScheduledRunRetained':True,'originalHashesRetained':True,'checked':True})
except Exception as error:e['error']=str(error)
finally:
 stopped=subprocess.run(['supabase','stop'],capture_output=True,text=True,timeout=120);e['qaServicesStopped']=stopped.returncode==0;e['success']=bool(e.get('checked') and e['qaServicesStopped']);(out/'evidence.json').write_text(json.dumps(e,indent=2))
print(json.dumps({'success':e['success'],'savedRequests':e.get('savedRequests'),'parentReportRetained':e.get('parentReportRetained'),'singleScheduledRunRetained':e.get('singleScheduledRunRetained'),'error':e.get('error')}));sys.exit(0 if e['success'] else 1)
