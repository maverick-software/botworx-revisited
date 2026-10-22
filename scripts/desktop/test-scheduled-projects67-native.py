"""Apply only migration70 to a full scratch restore; independent SQL clients.

Production is queried read-only. Cluster writes are restricted to creation and
removal of this invocation's uniquely named scratch database. No model calls.
"""
import datetime,glob,hashlib,json,os,re,subprocess,sys,traceback,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
root=Path('/mnt/f/Agentopia');out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-scheduled-workspaces67' and re.fullmatch(r'native-\d+',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
assert out.is_dir() and not (out/'evidence.json').exists()
intent=json.loads((out/'intent.json').read_text());migration=root/'desktop/database/0070-scheduled-project-workspaces.sql'
assert hashlib.sha256(migration.read_bytes()).hexdigest()==intent['migrationSha256']
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);binaries=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql');assert len(binaries)==1
binary=Path(binaries[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_scheduled_projects67_scratch',PGOPTIONS='-c statement_timeout=25000 -c lock_timeout=10000')
base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin'];database='agentopia_schedule67_'+uuid.uuid4().hex[:16]
assert re.fullmatch(r'agentopia_schedule67_[a-f0-9]{16}',database)
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'database':database,'checks':[],'productionMigrations':0,'providerRequests':0,'installed':False,'migrationSha256':intent['migrationSha256'],'scope':'Full Supabase database restored into a scratch database on actual native PostgreSQL. Independent-client concurrency and SQL receipts; no Git preparation, broker/UI dispatch or live provider calls.'};created=False
def lit(value):return 'NULL' if value is None else "'"+str(value).replace("'","''")+"'"
def obj(value):return json.dumps(value,ensure_ascii=False)
def uid():return str(uuid.uuid4())
def when(seconds):return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)).isoformat()
def sql(statement,target=None,fail=False):
 target=target or database;query_env=dict(env)
 if target=='postgres' and statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):query_env['PGOPTIONS']+=' -c default_transaction_read_only=on'
 result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*base,'-d',target],input=statement+'\n',text=True,env=query_env,capture_output=True,timeout=40)
 if fail:
  assert result.returncode!=0,'Forbidden SQL action succeeded';return result.stderr
 if result.returncode:raise RuntimeError(result.stderr)
 return result.stdout.strip()
def call(name,*args):
 text=sql('SELECT '+name+'('+','.join(lit(v) for v in args)+')')
 return (text=='t') if text in ('t','f') else json.loads(text) if text else None
def denied(name,*args):return sql('SELECT '+name+'('+','.join(lit(v) for v in args)+')',fail=True)
def check(label):evidence['checks'].append(label);print('PASS: '+label,flush=True)
def fingerprints(target,after=False):
 rows=json.loads(sql("SELECT json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN('auth','public','vault','agentopia_desktop')",target));result={}
 for row in rows:
  name='"'+row['schema']+'"."'+row['table']+'"';value="to_jsonb(t)-'target_key'-'workspace_started_at'" if after and name=='"public"."desktop_scheduled_runs"' else 'to_jsonb(t)'
  result[name]=json.loads(sql("SELECT json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(("+value+")::text,E'\\n' ORDER BY ("+value+")::text),''))) FROM "+name+' t',target))
 return result
try:
 evidence['productionBefore']=fingerprints('postgres');assert sql("SELECT count(*) FROM agentopia_desktop.migrations",'postgres')=='69'
 assert not sql('SELECT 1 FROM pg_database WHERE datname='+lit(database),'postgres')
 dump=out/'private-database.dump';dump_env=dict(env,PGOPTIONS=env['PGOPTIONS']+' -c default_transaction_read_only=on')
 capture=subprocess.run([str(binary/'pg_dump'),'--format=custom','--file',str(dump),*base,'-d','postgres'],env=dump_env,text=True,capture_output=True,timeout=90)
 (out/'private-dump.log').write_text(capture.stderr);assert capture.returncode==0,'Inspect protected dump log'
 with dump.open('rb') as stream:evidence['sourceDumpSha256']=hashlib.file_digest(stream,'sha256').hexdigest()
 sql('CREATE DATABASE '+database+' TEMPLATE template0','postgres');created=True
 toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(dump)],text=True)
 retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)]
 listing=out/'private-restore.list';listing.write_text('\n'.join(retained)+'\n')
 restore=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*base,'-d',database,str(dump)],env=env,text=True,capture_output=True,timeout=120)
 (out/'private-restore.log').write_text(restore.stdout+'\n'+restore.stderr);assert restore.returncode==0,'Inspect protected restore log'
 evidence['engine']=sql('SELECT version()');before=fingerprints(database)
 assert before==evidence['productionBefore'],'The restored database differs from the read-only source inventory'
 sql('BEGIN;'+migration.read_text()+'\nCOMMIT;')
 after=fingerprints(database,True);assert before==after
 evidence['preservedTables']=len(before);evidence['preservedRows']=sum(r['rows'] for r in before.values());check('Migration70 applies to the full restored Supabase schema and preserves every prior application, account, vault and schedule row.')
 identity=json.loads(sql("SELECT json_build_object('user',a.user_id,'agent',a.id,'revision',p.revision) FROM agents a JOIN desktop_agent_profiles p ON p.agent_id=a.id AND p.user_id=a.user_id WHERE a.active ORDER BY a.id LIMIT 1"));owner,agent=identity['user'],identity['agent'];foreign=sql('SELECT id FROM auth.users WHERE id<>'+lit(owner)+' LIMIT 1');assert foreign
 project_a,project_b,root_a,root_b,nested_id,shared_id=[uid() for _ in range(6)]
 shared={'id':shared_id,'path':'F:\\Scheduled67\\shared.md','kind':'file'};folder_a={'id':root_a,'path':'F:\\Scheduled67\\source-a','kind':'folder'};folder_b={'id':root_b,'path':'F:\\Scheduled67\\source-b','kind':'folder'};nested={'id':nested_id,'path':folder_a['path']+'\\readme.md','kind':'file'}
 for project,folder in [(project_a,folder_a),(project_b,folder_b)]:sql('INSERT INTO desktop_projects(id,user_id,name,reference_id,file_ids) VALUES('+','.join(map(lit,[project,owner,'Generated schedule67 '+project[:8],folder['id']]))+',ARRAY['+lit(folder['id'])+']::uuid[])')
 options={'provider':'openai-oauth','model':'controlled-sql-only','harness':'codex','permission':'ask','mode':'chat','thinking':'default','files':[shared_id]}
 snapshot={'name':'Generated multi-project SQL check','instructions':'Generated database receipt; no inference or filesystem access','agentId':agent,'agentRevision':identity['revision'],'projectId':None,'projectRevision':None,'conversationId':None,'options':options,'files':[shared],'notifications':'all','targets':[{'projectId':project_a,'projectRevision':1,'files':[folder_a,nested,shared]},{'projectId':project_b,'projectRevision':1,'files':[folder_b,shared]}]}
 def create(value=None,once=False,status='active'):
  value=value or snapshot;return call('desktop_save_schedule',owner,uid(),None,obj({'cadence':{'kind':'once','at':when(-30)} if once else {'kind':'interval','minutes':1},'anchor':when(-90),'missed':'latest','snapshot':value}),status,when(-30))
 def stage(task,next_at=None):return call('desktop_stage_schedule_run',owner,task['id'],task['revision'],task['nextAt'],next_at or (None if task['cadence']['kind']=='once' else when(60)),'false')
 def rows(task):return json.loads(sql('SELECT coalesce(json_agg(row_to_json(r) ORDER BY r.id),\'[]\') FROM desktop_scheduled_runs r WHERE task_id='+lit(task['id'])))
 def row(run):return json.loads(sql('SELECT row_to_json(r) FROM desktop_scheduled_runs r WHERE id='+lit(run['id'])))
 def status(task):return sql('SELECT status FROM desktop_scheduled_tasks WHERE id='+lit(task['id']))
 def claim(run):return call('desktop_claim_schedule_run',owner,run['id'])
 def control(task,action,run=None):return call('desktop_control_schedule',owner,task['id'],task['revision'],action,when(60),run)
 def begin_request(run):
  s=run['snapshot'];req=call('desktop_begin_agent_chat',owner,run.get('request_id',run.get('requestId')),agent,None,s['instructions'],obj(s['options']),'[]',s['projectId'],s['projectRevision'],None,None,s['agentRevision'],None)
  call('desktop_activate_scheduled_request',owner,run['id']);return req
 def complete(run):
  req=begin_request(run);call('desktop_checkpoint_chat',owner,req['id'],'Generated completed SQL receipt','completed',None);call('desktop_finish_schedule_run',owner,run['id'],'completed',req['conversation_id'],None);return req
 task=create();next_at=when(60)
 with ThreadPoolExecutor(max_workers=8) as pool:staged=list(pool.map(lambda _:stage(task,next_at),range(8)))
 assert sum(r is not None for r in staged)==1;all_runs=rows(task);assert len(all_runs)==2 and len({r['request_id'] for r in all_runs})==2
 assert sql('SELECT next_at='+lit(next_at)+'::timestamptz FROM desktop_scheduled_tasks WHERE id='+lit(task['id']))=='t'
 for run in all_runs:
  target=next(t for t in snapshot['targets'] if t['projectId']==run['target_key']);assert run['snapshot']['files']==target['files'] and 'targets' not in run['snapshot']
 check('Eight independent clients stage exactly one two-project occurrence, with separate requests/scopes and one next-time advance.')
 with ThreadPoolExecutor(max_workers=8) as pool:claimed=list(pool.map(lambda _:claim(all_runs[0]),range(8)))
 assert sum(r is not None for r in claimed)==1;check('Eight concurrent claimants produce one execution reservation for the project run.')
 task=create(status='paused');manual_id=uid()
 with ThreadPoolExecutor(max_workers=6) as pool:manuals=list(pool.map(lambda _:control(task,'manual',manual_id),range(6)))
 assert len(rows(task))==2 and all(v['run']['id']==manual_id for v in manuals)
 check('Six simultaneous manual retries reuse one project group and its original first-run identifier.')
 task=create(once=True);stage(task);a,b=rows(task);claim(a);req=complete(a);assert status(task)=='active';claim(b);complete(b);assert status(task)=='completed'
 assert call('desktop_validate_scheduled_request',owner,req['id'])[0]['projectId']==a['snapshot']['projectId']
 check('Actual chat/checkpoint/activation functions preserve each project assignment; a one-time task completes only after both saved responses.')
 task=create(once=True);stage(task);a,b=rows(task);claim(a);req=begin_request(a);call('desktop_checkpoint_chat',owner,req['id'],'Saved before simulated scheduler close','completed',None);call('desktop_recover_schedule_runs');assert row(a)['status']=='completed' and row(b)['status']=='pending' and status(task)=='active'
 claim(b);req=begin_request(b);call('desktop_checkpoint_chat',owner,req['id'],'Saved second before close','completed',None);call('desktop_recover_schedule_runs');assert status(task)=='completed'
 check('Fresh database clients recover a partial occurrence without completing its remaining project early or replaying its saved result.')
 workspace={'mode':'worktree','source':folder_a,'sourceFiles':[folder_a,nested,shared],'commonDirectory':folder_a['path']+'\\.git','ref':'refs/heads/main'}
 work=dict(snapshot,projectId=project_a,projectRevision=1,files=workspace['sourceFiles'],workspace=workspace,options=dict(options,files=[root_a,nested_id,shared_id]));del work['targets']
 task=create(work);run=stage(task);claim(run)
 def begin_workspace():
  try:return {'result':call('desktop_begin_schedule_workspace',owner,run['id'])}
  except RuntimeError as failure:return {'error':str(failure)}
 with ThreadPoolExecutor(max_workers=6) as pool:starts=list(pool.map(lambda _:begin_workspace(),range(6)))
 assert sum('result' in v for v in starts)==1 and sum('already started' in v.get('error','') for v in starts)==5
 assert next(v['result'] for v in starts if 'result' in v)['workspaceStartedAt']
 assert call('desktop_defer_schedule_run',owner,run['id']) is False
 checkout='F:\\Scheduled67\\worktrees\\'+run['id'];resolution={'files':[{'id':uid(),'path':checkout,'kind':'folder'},{'id':uid(),'path':checkout+'\\readme.md','kind':'file'},shared],'resolved':{'runId':run['id'],'path':checkout,'commit':'a'*40}}
 assert 'changed' in denied('desktop_resolve_schedule_workspace',foreign,run['id'],obj(resolution))
 ready=call('desktop_resolve_schedule_workspace',owner,run['id'],obj(resolution));assert call('desktop_resolve_schedule_workspace',owner,run['id'],obj(resolution))['snapshot']==ready['snapshot']
 assert ready['snapshot']['files']==resolution['files'] and ready['snapshot']['workspace']['sourceFiles']==workspace['sourceFiles']
 assert ready['snapshot']['options']['files']==[f['id'] for f in resolution['files']]
 assert 'unresolved' in denied('desktop_save_schedule',owner,uid(),None,obj({'cadence':{'kind':'interval','minutes':1},'anchor':when(0),'missed':'latest','snapshot':ready['snapshot']}),'active',when(60))
 req=complete(ready);assert call('desktop_validate_scheduled_request',owner,req['id'])[0]['workspace']['resolved']==resolution['resolved']
 assert json.loads(sql('SELECT metadata->\'project\'->\'file_ids\' FROM chat_messages_v2 WHERE id='+lit(req['user_message_id'])))==[]
 assert json.loads(sql('SELECT metadata->\'options\'->\'files\' FROM chat_messages_v2 WHERE id='+lit(req['user_message_id'])))==[f['id'] for f in resolution['files']]
 assert 'submitted' in denied('desktop_resolve_schedule_workspace',owner,run['id'],obj(resolution))
 check('Only one client can begin workspace mutation; resolved grants replace the source, identical resolution retries remain stable, and activation binds the prepared scope.')
 task=create(work);run=stage(task);claim(run);call('desktop_begin_schedule_workspace',owner,run['id']);call('desktop_recover_schedule_runs');assert row(run)['status']=='held' and status(task)=='paused' and claim(run) is None
 check('An interrupted checkout with no provider request is held across independent clients and never requeued.')
 task=create();run=stage(task);a,b=rows(task)
 with ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(claim,a),pool.submit(control,task,'delete')];[f.result() for f in futures]
 assert all(r['status']=='cancelled' for r in rows(task))
 assert 'stopped' in denied('desktop_activate_scheduled_request',owner,a['id'])
 check('Concurrent task deletion and project claiming leaves all scopes cancelled and prevents activation.')
 task=create();run=stage(task);a,b=rows(task);claim(a);call('desktop_finish_schedule_run',owner,a['id'],'failed',None,'Generated failure');assert row(b)['status']=='cancelled' and status(task)=='paused'
 control(task,'resume');call('desktop_recover_schedule_runs');assert status(task)=='active'
 check('A failed project cancels unstarted siblings; an explicit later resume is preserved during recovery.')
 bad=dict(snapshot,targets=[snapshot['targets'][0],snapshot['targets'][0]])
 assert 'duplicated' in denied('desktop_save_schedule',owner,uid(),None,obj({'cadence':{'kind':'interval','minutes':1},'anchor':when(0),'missed':'latest','snapshot':bad}),'active',when(60))
 assert sql("SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE '%schedule%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))")=='0'
 assert sql("SELECT has_table_privilege('authenticated','desktop_scheduled_runs','SELECT,INSERT,UPDATE,DELETE')")=='f'
 check('Duplicate project definitions are rejected atomically; ordinary client roles retain no scheduler storage/function privileges.')
 # Migration receipt history in the scratch database remains the exact original69.
 assert sql('SELECT count(*) FROM agentopia_desktop.migrations')=='69';evidence['checksPassed']=True
except Exception as failure:
 evidence['error']=repr(failure);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
 if created:
  try:sql('DROP DATABASE '+database,'postgres');evidence['scratchDatabaseRemoved']=True
  except Exception as failure:evidence['cleanupError']=repr(failure)
 try:
  evidence['productionAfter']=fingerprints('postgres');evidence['productionInventoryUnchanged']=evidence['productionAfter']==evidence.get('productionBefore')
 except Exception as failure:evidence['inventoryError']=repr(failure)
 evidence['success']=bool(evidence.get('checksPassed') and evidence.get('scratchDatabaseRemoved') and evidence.get('productionInventoryUnchanged'))
 (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps({k:evidence.get(k) for k in ['success','database','scratchDatabaseRemoved','productionInventoryUnchanged','preservedTables','preservedRows','error','cleanupError']},indent=2));sys.exit(0 if evidence['success'] else 1)
