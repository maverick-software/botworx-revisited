"""Qualify migration 64 in a disposable restored database, with independent clients.

The installed database is queried read-only except for creating/dropping the
uniquely named scratch database. No model calls or app restarts are performed.
"""
import datetime,glob,hashlib,json,os,re,subprocess,sys,traceback,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
root=Path('/mnt/d/Users/charl/software/Agentopia');out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-scheduler' and re.fullmatch(r'native-\d+',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
out.mkdir(exist_ok=False)
backup=root/'.supabase/desktop-goal-queue/upgrade-backup-1792341034014/current-database-backup'
manifest=json.loads((backup/'manifest.json').read_text())
for entry in manifest['files']:
 with (backup/entry['name']).open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==entry['sha256']
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_scheduler_native_qualification',PGOPTIONS='-c statement_timeout=20000 -c lock_timeout=10000')
base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin'];database='agentopia_schedule_'+uuid.uuid4().hex[:16]
assert re.fullmatch(r'agentopia_schedule_[a-f0-9]{16}',database)
evidence={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'database':database,'checks':[],'productionMigrations':0,'providerRequests':0,'scope':'Native Supabase PostgreSQL scratch restore and SQL concurrency; no broker, renderer or live inference.'};created=False
def sql(statement,target=None,fail=False):
 target=target or database;query_env=dict(env)
 if target=='postgres' and statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):query_env['PGOPTIONS']+=' -c default_transaction_read_only=on'
 result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*base,'-d',target],input=statement+'\n',text=True,env=query_env,capture_output=True,timeout=35)
 if fail:
  assert result.returncode!=0,'Forbidden database operation succeeded';return result.stderr
 if result.returncode:raise RuntimeError(result.stderr)
 return result.stdout.strip()
def lit(value):return 'NULL' if value is None else "'"+str(value).replace("'","''")+"'"
def uid():return str(uuid.uuid4())
def obj(value):return json.dumps(value,ensure_ascii=False)
def rpc(name,*args,fail=False):return sql('SELECT '+name+'('+','.join(lit(v) for v in args)+')',fail=fail)
def call(name,*args):
 value=rpc(name,*args)
 if value in ('t','f'):return value=='t'
 return json.loads(value) if value else None
def check(label):evidence['checks'].append(label);print('PASS: '+label,flush=True)
def production():
 result={}
 for table in ['auth.users','profiles','user_roles','agents','conversation_sessions','chat_messages_v2','agentopia_desktop.migrations']:
  result[table]=json.loads(sql("SELECT json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''))) FROM "+table+' t','postgres'))
 return result
def fingerprints():
 rows=json.loads(sql("SELECT json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN('auth','public','vault')"));result={}
 for row in rows:
  name='"'+row['schema']+'"."'+row['table']+'"';value="to_jsonb(t)-'scheduled_run_id'" if name=='"public"."desktop_requests"' else 'to_jsonb(t)'
  result[name]=json.loads(sql("SELECT json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(("+value+")::text,E'\\n' ORDER BY ("+value+")::text),''))) FROM "+name+' t'))
 return result
def when(seconds):return (datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=seconds)).isoformat()
try:
 evidence['productionBefore']=production();assert evidence['productionBefore']['agentopia_desktop.migrations']['rows']==59
 assert not sql('SELECT 1 FROM pg_database WHERE datname='+lit(database),'postgres')
 sql('CREATE DATABASE '+database+' TEMPLATE template0','postgres');created=True
 toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(backup/'database.dump')],text=True)
 retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)]
 listing=out/'private-restore.list';listing.write_text('\n'.join(retained)+'\n')
 restore=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*base,'-d',database,str(backup/'database.dump')],env=env,text=True,capture_output=True,timeout=120)
 (out/'private-restore.log').write_text(restore.stdout+'\n'+restore.stderr);assert restore.returncode==0,'Inspect private-restore.log'
 evidence['engine']=sql('SELECT version()');evidence['restoredVaultRecords']=int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'));assert evidence['restoredVaultRecords']==190
 applied={};baseline=None
 for file in sorted((root/'desktop/database').glob('*.sql')):
  digest=hashlib.sha256(file.read_bytes()).hexdigest();existing=sql('SELECT checksum FROM agentopia_desktop.migrations WHERE version='+lit(file.name))
  if existing:assert existing==digest,'Historical migration changed: '+file.name;continue
  if file.name=='0064-scheduled-tasks.sql':baseline=fingerprints()
  sql('BEGIN; '+file.read_text()+"\nINSERT INTO agentopia_desktop.migrations(version,checksum) VALUES("+lit(file.name)+','+lit(digest)+'); COMMIT;');applied[file.name]=digest
 assert sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('desktop_chat_delivery_snapshot','desktop_validate_chat_delivery','desktop_validate_chat_delivery_request') AND provolatile='v'")=='3'
 assert baseline is not None;after=fingerprints();assert all(after[name]==value for name,value in baseline.items())
 assert set(after)-set(baseline)=={'"public"."desktop_scheduled_tasks"','"public"."desktop_scheduled_runs"'}
 evidence['applied']=applied;evidence['preservedTables']=len(baseline);check('Migration 64 binds against the restored Supabase schema and preserves every prior application/auth/vault row, with the new nullable request column excluded from row comparison.')
 identity=json.loads(sql("SELECT json_build_object('user',user_id,'agent',id) FROM agents WHERE active ORDER BY id LIMIT 1"));user,agent=identity['user'],identity['agent'];foreign=sql('SELECT id FROM auth.users WHERE id<>'+lit(user)+' LIMIT 1')
 profile=call('desktop_agent_profile',user,agent);options={'harness':'codex','provider':'openai-oauth','model':'controlled-native-fixture','thinking':'default','permission':'chat','mode':'chat','files':[]}
 snapshot={'name':'Native scheduler qualification','instructions':'Generated scheduler verification; no inference','agentId':agent,'agentRevision':profile['revision'],'projectId':None,'projectRevision':None,'conversationId':None,'options':options,'files':[],'notifications':'all'}
 def create(missed='latest',once=False):
  cadence={'kind':'once','at':when(-30)} if once else {'kind':'interval','minutes':1};return call('desktop_save_schedule',user,uid(),None,obj({'cadence':cadence,'anchor':when(-120),'missed':missed,'snapshot':snapshot}),'active',when(-30))
 def stage(task):return call('desktop_stage_schedule_run',user,task['id'],task['revision'],task['nextAt'],None if task['cadence']['kind']=='once' else when(60),'false')
 def control(task,action,run=None,owner=None):return call('desktop_control_schedule',owner or user,task['id'],task['revision'],action,when(60),run)
 def row(run):return json.loads(sql('SELECT row_to_json(r) FROM desktop_scheduled_runs r WHERE id='+lit(run['id'])))
 def claim(run):return call('desktop_claim_schedule_run',user,run['id'])
 def begin(run,complete=False,parent=None):
  request=call('desktop_begin_agent_chat',user,run['requestId'],agent,None,snapshot['instructions'],obj(options),'[]',None,None,None,None,profile['revision'],parent)
  if complete:rpc('desktop_checkpoint_chat',user,request['id'],'Saved controlled receipt','completed',None)
  return request
 task=create()
 assert task['snapshot']['notifications']=='all'
 with ThreadPoolExecutor(max_workers=8) as pool:staged=list(pool.map(lambda _:stage(task),range(8)))
 assert sum(value is not None for value in staged)==1;run=next(value for value in staged if value)
 with ThreadPoolExecutor(max_workers=8) as pool:claimed=list(pool.map(lambda _:claim(run),range(8)))
 assert sum(value is not None for value in claimed)==1;assert row(run)['status']=='starting';assert row(run)['snapshot']['notifications']=='all'
 check('Saved task and independently claimed run preserve the notification preference in their authoritative snapshots.')
 check('Eight independent PostgreSQL clients stage one due occurrence and only one of eight claimants wins its stable request ID.')
 assert 'completion receipt' in rpc('desktop_finish_schedule_run',user,run['id'],'completed',None,None,fail=True)
 req=begin(run);rpc('desktop_activate_scheduled_request',user,run['id']);assert row(run)['request_created_at']
 metadata=json.loads(sql('SELECT metadata FROM chat_messages_v2 WHERE id='+lit(req['user_message_id'])));assert metadata['scheduled_task']['run_id']==run['id']
 child_id=uid();assignment='Inspect the scheduled findings as a child assignment'
 ceiling=call('desktop_intersect_agent_policy',obj(profile['policy']),obj(profile['policy']))
 named=call('desktop_reserve_agent_invocation',user,req['id'],None,'schedule-child',agent,assignment,obj(options),obj(ceiling),profile['revision'],child_id)
 assert call('desktop_claim_agent_invocation',user,child_id)['claimed']
 child_chat=sql('SELECT conversation_id FROM desktop_agent_instances WHERE id='+lit(named['child_instance_id']))
 child=call('desktop_begin_agent_chat',user,child_id,agent,child_chat,assignment,obj(options),'[]',None,None,None,None,profile['revision'],req['agent_instance_id'])
 rpc('desktop_checkpoint_chat',user,req['id'],'Saved controlled completion','completed',None);rpc('desktop_finish_schedule_run',user,run['id'],'completed',req['conversation_id'],None)
 assert row(run)['status']=='completed';check('Actual chat-creation and checkpoint functions establish provenance, activation and saved completion; a missing completion receipt is refused.')
 assert len(call('desktop_validate_scheduled_request',user,child['id']))==1
 ids=call('desktop_schedule_request_ids',user,task['id'],run['id']);assert child['id'] in ids and req['id'] in ids
 control(task,'delete');assert 'revoked' in rpc('desktop_validate_scheduled_request',user,child['id'],fail=True)
 check('A real child assignment inherits its schedule scope; deleting the schedule revokes both root and child authority.')
 task=create();run=stage(task);assert call('desktop_claim_schedule_run',foreign,run['id']) is None
 assert 'unavailable' in rpc('desktop_control_schedule',foreign,task['id'],task['revision'],'delete',None,None,fail=True)
 for table in ['desktop_scheduled_tasks','desktop_scheduled_runs']:
  assert sql("SELECT has_table_privilege('authenticated',"+lit(table)+",'SELECT,INSERT,UPDATE,DELETE')")=='f'
 assert sql("SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE '%schedule%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))")=='0'
 check('Foreign owners cannot claim/control tasks; anonymous and authenticated roles cannot access schedule storage or service-only functions.')
 control(task,'pause');assert row(run)['status']=='cancelled';manual_id=uid()
 with ThreadPoolExecutor(max_workers=6) as pool:manuals=list(pool.map(lambda _:control(task,'manual',manual_id),range(6)))
 assert all(value['run']['id']==manual_id for value in manuals);assert sql('SELECT count(*) FROM desktop_scheduled_runs WHERE id='+lit(manual_id))=='1'
 check('Pause cancels pending work; simultaneous manual-run retries produce one persisted run.')
 task=create();run=stage(task);claim(run);assert call('desktop_defer_schedule_run',user,run['id']) is True;claim(run);begin(run);assert call('desktop_defer_schedule_run',user,run['id']) is False
 check('Only a provably never-submitted reservation can be deferred; an existing chat request prevents retry.')
 done_task=create(once=True);done=stage(done_task);claim(done);done_req=begin(done,complete=True)
 uncertain_task=create();uncertain=stage(uncertain_task);claim(uncertain);begin(uncertain);rpc('desktop_activate_scheduled_request',user,uncertain['id'])
 missing_task=create();missing=stage(missing_task);claim(missing);missing_req=begin(missing);rpc('desktop_activate_scheduled_request',user,missing['id']);sql('DELETE FROM desktop_requests WHERE id='+lit(missing_req['id']))
 skip_task=create(missed='skip');skip=stage(skip_task);claim(skip)
 latest_task=create();latest=stage(latest_task);claim(latest)
 rpc('desktop_recover_schedule_runs')
 assert row(done)['status']=='completed' and row(done)['conversation_id']==done_req['conversation_id']
 for value in [uncertain,missing]:assert row(value)['status']=='held' and claim(value) is None
 assert row(skip)['status']=='skipped' and row(latest)['status']=='pending'
 assert 'interrupted run' in rpc('desktop_control_schedule',user,uncertain_task['id'],uncertain_task['revision'],'resume',when(60),None,fail=True)
 check('Fresh connections recover saved completions, hold uncertain or deleted activated requests without replay, and distinguish skipped from safely pending work.')
 task=create();run=stage(task)
 with ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(claim,run),pool.submit(control,task,'delete')];[future.result() for future in futures]
 assert row(run)['status']=='cancelled';assert 'stopped' in rpc('desktop_activate_scheduled_request',user,run['id'],fail=True)
 check('A concurrent claim/delete leaves the run cancelled and cannot activate a deleted assignment.')
 legacy_id=uid()
 legacy=json.loads(sql("WITH saved AS (INSERT INTO agent_tasks(id,user_id,agent_id,created_by,name,instructions,cron_expression,timezone,status) VALUES("+','.join(map(lit,[legacy_id,user,agent,user,'Earlier paused fixture','Generated legacy instructions','0 9 * * 1-5','America/Los_Angeles','paused']))+") RETURNING *) SELECT row_to_json(saved) FROM saved"))
 import_value={'cadence':{'kind':'cron','expression':legacy['cron_expression'],'timezone':legacy['timezone']},'anchor':when(0),'missed':'skip','snapshot':dict(snapshot,name=legacy['name'],instructions=legacy['instructions'])}
 assert 'changed' in rpc('desktop_import_legacy_schedule',user,legacy_id,when(-3600),obj(import_value),when(60),fail=True)
 assert 'unavailable' in rpc('desktop_import_legacy_schedule',foreign,legacy_id,legacy['updated_at'],obj(import_value),when(60),fail=True)
 def import_legacy():return call('desktop_import_legacy_schedule',user,legacy_id,legacy['updated_at'],obj(import_value),when(60))
 with ThreadPoolExecutor(max_workers=6) as pool:imports=list(pool.map(lambda _:import_legacy(),range(6)))
 imported=imports[0];assert len({value['id'] for value in imports})==1 and all(value['status']=='paused' for value in imports)
 assert imported['legacyTaskId']==legacy_id and not sql('SELECT 1 FROM desktop_scheduled_runs WHERE task_id='+lit(imported['id']))
 assert json.loads(sql('SELECT row_to_json(t) FROM agent_tasks t WHERE id='+lit(legacy_id)))==legacy
 control(imported,'delete');assert 'already imported' in rpc('desktop_import_legacy_schedule',user,legacy_id,legacy['updated_at'],obj(import_value),when(60),fail=True)
 check('Explicit legacy import preserves the original definition, creates one paused task across six simultaneous retries, refuses stale/foreign sources and never revives a deleted import.')
 reviewed_id=uid();reviewed_value=dict(import_value,snapshot=snapshot)
 reviewed=call('desktop_save_reviewed_schedule',user,reviewed_id,None,None,obj(reviewed_value),'paused',when(60))
 assert 'already has a task' in rpc('desktop_save_reviewed_schedule',user,reviewed_id,None,None,obj(reviewed_value),'active',when(60),fail=True)
 previous={'status':reviewed['status'],'nextAt':reviewed['nextAt']}
 resumed=call('desktop_control_reviewed_schedule',user,reviewed_id,reviewed['revision'],obj(previous),'resume',when(120),None)['task']
 assert resumed['status']=='active'
 assert 'changed after review' in rpc('desktop_save_reviewed_schedule',user,reviewed_id,reviewed['revision'],obj(previous),obj(reviewed_value),'active',when(180),fail=True)
 assert 'changed after review' in rpc('desktop_control_reviewed_schedule',user,reviewed_id,reviewed['revision'],obj(previous),'delete',None,None,fail=True)
 fresh={'status':resumed['status'],'nextAt':resumed['nextAt']}
 changed=call('desktop_save_reviewed_schedule',user,reviewed_id,resumed['revision'],obj(fresh),obj(reviewed_value),'paused',when(180));assert changed['revision']==resumed['revision']+1
 check('Reviewed saves and controls compare status and next occurrence under their row lock; a changed schedule requires fresh review, and a repeated creation cannot create another task.')
 def tool_receipt(thread,name='save_scheduled_task'):
  return 'INSERT INTO desktop_tool_calls(id,user_id,request_id,conversation_id,assistant_message_id,native_thread_id,name,label,status,arguments) VALUES('+','.join(map(lit,[uid(),user,req['id'],req['conversation_id'],req['assistant_message_id'],thread,name,'Controlled schedule review','awaiting_approval',obj({'provider_call_id':'schedule-native-id'})]))+')'
 sql(tool_receipt(None));assert 'duplicate key' in sql(tool_receipt(None,'control_scheduled_task'),fail=True)
 sql(tool_receipt('independent-child'))
 check('Native tool-call receipts reject duplicate mutation reviews while allowing the same call identifier in an independent child thread.')
 evidence['checksPassed']=True
except Exception as error:
 evidence['error']=repr(error);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
 if created:sql('DROP DATABASE '+database,'postgres');evidence['disposableDatabaseRemoved']=True
 evidence['productionAfter']=production();evidence['productionInventoryUnchanged']=evidence['productionBefore']==evidence['productionAfter']
 evidence['success']=bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionInventoryUnchanged'])
 (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps({'success':evidence['success'],'checks':len(evidence['checks']),'databaseRemoved':evidence.get('disposableDatabaseRemoved'),'productionInventoryUnchanged':evidence['productionInventoryUnchanged'],'providerRequests':0,'error':evidence.get('error')},indent=2));sys.exit(0 if evidence['success'] else 1)
