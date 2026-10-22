"""Test the durable outbox in a restored scratch database. No inference or production migration."""
import glob,hashlib,http.server,json,os,re,secrets,subprocess,sys,threading,traceback,uuid
from concurrent.futures import ThreadPoolExecutor
from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
root=Path('/mnt/d/Users/charl/software/Agentopia')
out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-chat-delivery' and out.name.startswith('storage-')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
out.mkdir(exist_ok=False)
backup=root/'.supabase/desktop-goal-queue/upgrade-backup-1792341034014/current-database-backup'
manifest=json.loads((backup/'manifest.json').read_text())
for file in manifest['files']:
    with (backup/file['name']).open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==file['sha256']
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL'])
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGAPPNAME='agentopia_chat_delivery_qualification')
base=['-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin']
database='agentopia_delivery_'+uuid.uuid4().hex[:16]
assert re.fullmatch(r'agentopia_delivery_[a-f0-9]{16}',database)
evidence={'database':database,'checks':[],'productionMigrations':0,'providerRequests':0,'actualPostgREST':True};created=False;rest=None
def sql(statement,target=None,fail=False):
    target=target or database;query_env=dict(env)
    if target=='postgres' and statement not in ('CREATE DATABASE '+database+' TEMPLATE template0','DROP DATABASE '+database):query_env['PGOPTIONS']='-c default_transaction_read_only=on'
    result=subprocess.run([str(binary/'psql'),'-XqAt','-v','ON_ERROR_STOP=1',*base,'-d',target],input=statement+'\n',text=True,env=query_env,capture_output=True)
    if fail:
        assert result.returncode!=0,'A forbidden operation succeeded'
        return result.stderr
    if result.returncode:
        (out/'private-error.log').write_text(result.stderr)
        raise RuntimeError('Database qualification failed; inspect private-error.log')
    return result.stdout.strip()
def lit(value):return 'NULL' if value is None else "'"+str(value).replace("'","''")+"'"
def uid():return str(uuid.uuid4())
def obj(value):return json.dumps(value,ensure_ascii=False)
def rpc(name,*args,fail=False):return rest.call(name,args,fail) if rest else sql('SELECT '+name+'('+','.join(lit(v) for v in args)+')',fail=fail)
def call(name,*args):return json.loads(rpc(name,*args))
def check(label):evidence['checks'].append(label);print('PASS: '+label,flush=True)
def inventory():return json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'chats',(SELECT count(*) FROM conversation_sessions),'messages',(SELECT count(*) FROM chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'deliveryFunctions',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE '%chat_deliver%'))",'postgres'))
def fingerprints():
    rows=json.loads(sql("SELECT json_agg(json_build_object('schema',schemaname,'table',tablename) ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname IN('auth','public','vault')"));result={}
    for row in rows:
        name='"'+row['schema']+'"."'+row['table']+'"'
        value="to_jsonb(t)-'scheduled_run_id'" if name=='\"public\".\"desktop_requests\"' else 'to_jsonb(t)'
        result[name]=json.loads(sql("SELECT json_build_object('rows',count(*),'hash',md5(coalesce(string_agg(("+value+")::text,E'\\n' ORDER BY ("+value+")::text),''))) FROM "+name+' t'))
    return result
try:
    evidence['productionBefore']=inventory();assert evidence['productionBefore']['migrations']==59
    assert not sql('SELECT 1 FROM pg_database WHERE datname='+lit(database),'postgres')
    sql('CREATE DATABASE '+database+' TEMPLATE template0','postgres');created=True
    toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(backup/'database.dump')],text=True)
    retained=[line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )',line)]
    listing=out/'private-restore.list';listing.write_text('\n'.join(retained)+'\n')
    restore=subprocess.run([str(binary/'pg_restore'),'--exit-on-error','--single-transaction','--no-owner','--use-list',str(listing),*base,'-d',database,str(backup/'database.dump')],env=env,text=True,capture_output=True)
    (out/'private-restore.log').write_text(restore.stdout+'\n'+restore.stderr);assert restore.returncode==0,'Inspect private-restore.log'
    evidence['snapshotSchema']=int(sql('SELECT count(*) FROM agentopia_desktop.migrations'));baseline=None;applied={}
    for file in sorted((root/'desktop/database').glob('*.sql')):
        digest=hashlib.sha256(file.read_bytes()).hexdigest();existing=sql('SELECT checksum FROM agentopia_desktop.migrations WHERE version='+lit(file.name))
        if existing:assert existing==digest,'Historical migration changed: '+file.name;continue
        if file.name=='0061-chat-delivery.sql':
            assert int(sql('SELECT count(*) FROM agentopia_desktop.migrations'))==60;baseline=fingerprints()
        sql('BEGIN; '+file.read_text()+"\nINSERT INTO agentopia_desktop.migrations(version,checksum) VALUES("+lit(file.name)+','+lit(digest)+'); COMMIT;');applied[file.name]=digest
    assert baseline is not None;migrated=fingerprints()
    assert all(migrated[name]==value for name,value in baseline.items() if name!='"public"."desktop_agent_profiles"')
    # No lazy profile reads occurred during migration; all old tables must match.
    assert all(migrated[name]==value for name,value in baseline.items())
    assert set(migrated)-set(baseline)=={'"public"."desktop_chat_deliveries"','"public"."desktop_chat_delivery_grants"','"public"."desktop_scheduled_tasks"','"public"."desktop_scheduled_runs"'}
    evidence['applied']=applied;assert sql('SELECT count(*) FROM desktop_requests WHERE scheduled_run_id IS NOT NULL')=='0'
    check('Delivery and schedule migrations preserve every prior row; old request rows have null schedule provenance.')
    fixture=root/'scripts/desktop/native-postgrest-fixture.py';spec=spec_from_file_location('native_postgrest_fixture',fixture);module=module_from_spec(spec);spec.loader.exec_module(module);rest=module.NativePostgrest(state['env']['DB_URL'],database,out/'private-postgrest.log',sql)
    assert sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('desktop_chat_delivery_snapshot','desktop_validate_chat_delivery','desktop_validate_chat_delivery_request') AND provolatile='v'")=='3'
    check('A real isolated PostgREST server exercises RPC transaction access modes; the three profile-locking validators use writable POST transactions.')
    functions=sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('desktop_chat_delivery_snapshot','desktop_prepare_chat_delivery','desktop_authorize_chat_delivery','desktop_claim_chat_delivery','desktop_finish_chat_delivery','desktop_recover_chat_deliveries','desktop_revoke_chat_delivery_grant','desktop_change_chat_delivery','desktop_validate_chat_delivery')")
    assert functions=='9'
    assert sql("SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname LIKE '%chat_deliver%' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))")=='0'
    for table in ['desktop_chat_deliveries','desktop_chat_delivery_grants']:
        assert sql("SELECT relrowsecurity FROM pg_class WHERE oid="+lit('public.'+table)+'::regclass')=='t'
        assert sql("SELECT has_table_privilege('authenticated',"+lit('public.'+table)+",'SELECT,INSERT,UPDATE,DELETE')")=='f'
    check('All nine delivery functions and both row-secured tables exclude public/anonymous/authenticated database access.')
    identity=json.loads(sql("SELECT json_build_object('user',user_id,'agent',id) FROM agents WHERE active ORDER BY id LIMIT 1"));user,agent=identity['user'],identity['agent']
    foreign=sql('SELECT id FROM auth.users WHERE id<>'+lit(user)+' ORDER BY id LIMIT 1')
    other_agent=rpc('desktop_save_agent',foreign,None,'Foreign delivery agent','','','openai-oauth','fixture-model')
    options={'provider':'openai-oauth','model':'fixture-model','thinking':'default','permission':'ask','mode':'chat','files':[]}
    def begin(title,chat=None,owner=user,actor=agent,complete=False,opts=None,project=None):
        profile=call('desktop_agent_profile',owner,actor)
        row=call('desktop_begin_agent_chat',owner,uid(),actor,chat,title,obj(opts or options),'[]',project,1 if project else None,None,None,profile['revision'],None)
        if complete:rpc('desktop_checkpoint_chat',owner,row['id'],'Saved fixture result','completed',None)
        return row
    def prepare(source,target,text='Review the draft',key=None,thread=None,mode='queue',project=None):return call('desktop_prepare_chat_delivery',user,source['id'],project,thread,key or uid(),target['conversation_id'],text,mode)
    target=begin('Delivery target',complete=True);source=begin('Delivery source')
    key=uid();row=prepare(source,target,key=key)
    assert row['status']=='awaiting_authorization' and row['delivery']=='queue'
    assert not call('desktop_claim_chat_delivery',user,row['id'])['claimed']
    assert prepare(source,target,key=key)['id']==row['id']
    assert 'another message' in rpc('desktop_prepare_chat_delivery',user,source['id'],None,None,key,target['conversation_id'],'Changed text','queue',fail=True)
    check('Preparation cannot dispatch without human authorization; exact duplicate calls return the same persisted message and changed reuse is rejected.')
    row=call('desktop_authorize_chat_delivery',user,row['id'],'once');assert row['status']=='queued' and row['authorized_once']
    rpc('desktop_checkpoint_chat',user,source['id'],'Source finished','completed',None)
    claimed=call('desktop_claim_chat_delivery',user,row['id']);assert claimed['claimed'] and claimed['dispatch_started_at']
    assert not call('desktop_claim_chat_delivery',user,row['id'])['claimed']
    assert 'actual receiving request' in rpc('desktop_finish_chat_delivery',user,row['id'],'delivered',source['id'],'{}',None,fail=True)
    receiving=begin('Automated fixture message',chat=target['conversation_id'])
    delivered=call('desktop_finish_chat_delivery',user,row['id'],'delivered',receiving['id'],obj({'accepted':True}),None)
    assert delivered['target_request']==receiving['id'];rpc('desktop_checkpoint_chat',user,receiving['id'],'Receiving task finished','completed',None)
    rpc('desktop_validate_chat_delivery',user,row['id'])
    check('A completed sender can leave authorized work; one claimant wins, and delivery requires an actual request in the intended receiving chat.')
    source2=begin('Pair source');pair=prepare(source2,target);pair=call('desktop_authorize_chat_delivery',user,pair['id'],'pair');grant=pair['grant_id'];assert grant
    automatic=prepare(source2,target);assert automatic['status']=='queued' and automatic['grant_id']==grant
    assert call('desktop_claim_chat_delivery',user,pair['id'])['claimed']
    reverse=begin('Reverse sender',chat=target['conversation_id']);reply=prepare(reverse,source2);assert reply['status']=='queued' and reply['grant_id']==grant
    rpc('desktop_revoke_chat_delivery_grant',user,grant)
    assert sql('SELECT status FROM desktop_chat_deliveries WHERE id='+lit(automatic['id']))=='held'
    assert 'revoked' in rpc('desktop_validate_chat_delivery',user,pair['id'],fail=True)
    assert 'fresh chat coordination' in rpc('desktop_change_chat_delivery',user,automatic['id'],'resume',fail=True)
    rpc('desktop_finish_chat_delivery',user,pair['id'],'held',None,None,'Permission revoked before dispatch')
    rpc('desktop_checkpoint_chat',user,reverse['id'],'Done','completed',None)
    check('Explicit pair authorization permits both directions; revocation holds queued messages and invalidates an already claimed execution.')
    restart_source=begin('Restart source');restart_target=begin('Restart target',complete=True)
    queued=prepare(restart_source,restart_target);call('desktop_authorize_chat_delivery',user,queued['id'],'once')
    pending=prepare(restart_source,restart_target);uncertain_target=begin('Uncertain target',complete=True);uncertain=prepare(restart_source,uncertain_target);call('desktop_authorize_chat_delivery',user,uncertain['id'],'once');assert call('desktop_claim_chat_delivery',user,uncertain['id'])['claimed']
    assert int(rpc('desktop_recover_chat_deliveries',user))>=3
    for item in [queued,pending,uncertain]:assert sql('SELECT status FROM desktop_chat_deliveries WHERE id='+lit(item['id']))=='held'
    assert call('desktop_change_chat_delivery',user,queued['id'],'resume')['status']=='queued'
    assert 'needs fresh' in rpc('desktop_change_chat_delivery',user,pending['id'],'resume',fail=True)
    assert 'uncertain send' in rpc('desktop_change_chat_delivery',user,uncertain['id'],'resume',fail=True)
    assert 'uncertain send' in rpc('desktop_change_chat_delivery',user,uncertain['id'],'review',fail=True)
    assert not call('desktop_claim_chat_delivery',user,uncertain['id'])['claimed']
    rpc('desktop_checkpoint_chat',user,restart_source['id'],'Sender finished','completed',None)
    assert call('desktop_change_chat_delivery',user,pending['id'],'review')['status']=='awaiting_authorization'
    assert call('desktop_authorize_chat_delivery',user,pending['id'],'once')['status']=='queued'
    check('Recovery holds unauthorized, queued and uncertain dispatches; only never-dispatched authorized work can be explicitly resumed.')
    order_source=begin('Ordering source');order_target=begin('Ordering target',complete=True)
    first=prepare(order_source,order_target);second=prepare(order_source,order_target)
    for item in [first,second]:call('desktop_authorize_chat_delivery',user,item['id'],'once')
    assert not call('desktop_claim_chat_delivery',user,second['id'])['claimed']
    assert call('desktop_change_chat_delivery',user,first['id'],'cancel')['status']=='cancelled'
    assert call('desktop_claim_chat_delivery',user,second['id'])['claimed']
    call('desktop_finish_chat_delivery',user,second['id'],'held',None,None,'Controlled stop')
    check('Queued deliveries preserve order; explicit cancellation removes the earlier blocker without dispatching it.')
    security_source=begin('Security source');security_target=begin('Security target',complete=True);foreign_target=begin('Foreign target',owner=foreign,actor=other_agent,complete=True)
    assert 'unavailable' in rpc('desktop_prepare_chat_delivery',user,security_source['id'],None,None,uid(),foreign_target['conversation_id'],'Task','queue',fail=True)
    assert 'unavailable' in rpc('desktop_claim_chat_delivery',foreign,row['id'],fail=True)
    sql("UPDATE conversation_sessions SET session_state=session_state||'{\"desktop_archived\":true}'::jsonb WHERE conversation_id="+lit(security_target['conversation_id']))
    assert 'unavailable' in rpc('desktop_prepare_chat_delivery',user,security_source['id'],None,None,uid(),security_target['conversation_id'],'Task','queue',fail=True)
    sql("UPDATE conversation_sessions SET session_state=session_state||'{\"desktop_archived\":false}'::jsonb WHERE conversation_id="+lit(security_target['conversation_id']))
    changed=prepare(security_source,security_target)
    sql("UPDATE chat_messages_v2 SET metadata=jsonb_set(metadata,'{options,model}','\"changed-model\"') WHERE id="+lit(security_target['user_message_id']))
    assert 'changed' in rpc('desktop_authorize_chat_delivery',user,changed['id'],'once',fail=True)
    check('Foreign accounts/chats and archived targets are inaccessible; changing the receiving model invalidates the earlier review.')
    project=uid();sql('INSERT INTO desktop_projects(id,user_id,name,agent_memory_isolated) VALUES('+lit(project)+','+lit(user)+",'Delivery isolated project',true)")
    isolated=begin('Isolated target',complete=True,project=project)
    assert 'unavailable' in rpc('desktop_prepare_chat_delivery',user,security_source['id'],None,None,uid(),isolated['conversation_id'],'Task','queue',fail=True)
    stopped=begin('Stopped sender');stopped_row=prepare(stopped,order_target);call('desktop_authorize_chat_delivery',user,stopped_row['id'],'once');rpc('desktop_checkpoint_chat',user,stopped['id'],'','cancelled',None)
    assert 'sending task stopped' in rpc('desktop_claim_chat_delivery',user,stopped_row['id'],fail=True)
    planned=begin('Plan sender',opts=dict(options,mode='plan'))
    assert 'task mode' in rpc('desktop_prepare_chat_delivery',user,planned['id'],None,None,uid(),order_target['conversation_id'],'Task','queue',fail=True)
    check('Project isolation, a cancelled sender and Plan mode prevent new delegated work.')
    child_source=begin('Native child source');thread=uid()
    sql('INSERT INTO desktop_codex_turns(request_id,user_id,thread_id,runtime_version,state) VALUES('+','.join(map(lit,[child_source['id'],user,uid(),'0.163.0']))+','+lit(obj({'children':[{'threadId':thread,'status':'running'}]}))+'::jsonb)')
    rpc('desktop_checkpoint_chat',user,child_source['id'],'Parent done','completed',None)
    child_target=begin('Native child target',complete=True)
    child_row=prepare(child_source,child_target,thread=thread);call('desktop_authorize_chat_delivery',user,child_row['id'],'once')
    assert call('desktop_claim_chat_delivery',user,child_row['id'])['claimed']
    assert 'no longer active' in rpc('desktop_prepare_chat_delivery',user,child_source['id'],None,uid(),uid(),order_target['conversation_id'],'Task','queue',fail=True)
    check('An owned active native child can prepare work after its parent finishes; an unknown thread cannot.')
    race_source=begin('Concurrent delivery source');race_target=begin('Concurrent delivery target',complete=True);race=prepare(race_source,race_target);call('desktop_authorize_chat_delivery',user,race['id'],'once')
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims=list(pool.map(lambda _:call('desktop_claim_chat_delivery',user,race['id']),range(2)))
    assert sum(result['claimed'] for result in claims)==1
    assert 'not being dispatched' in rpc('desktop_finish_chat_delivery',user,row['id'],'delivered',receiving['id'],'{}',None,fail=True)
    check('Two concurrent database claimants produce one dispatch, and a completed receipt cannot be overwritten as another delivery.')
    steer_source=begin('Concurrent steering source');steer_target=begin('Concurrent steering target')
    steers=[prepare(steer_source,steer_target,mode='steer') for _ in range(2)]
    for item in steers:call('desktop_authorize_chat_delivery',user,item['id'],'once')
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims=list(pool.map(lambda item:call('desktop_claim_chat_delivery',user,item['id']),steers))
    assert sum(result['claimed'] for result in claims)==1
    check('Different simultaneous steering messages to one chat are serialized to one active dispatch.')
    policy_source=begin('Policy source');policy_target=begin('Policy target',complete=True)
    original_policy=json.loads(sql('SELECT policy FROM desktop_agent_profiles WHERE agent_id='+lit(agent)+' AND user_id='+lit(user)))
    for patch in [{'memory':False},{'delegation':False},{'tools':['read_chat']},{'delegateAgents':[]},{'maxDepth':0}]:
        sql('UPDATE desktop_agent_profiles SET policy='+lit(obj(dict(original_policy,**patch)))+'::jsonb WHERE agent_id='+lit(agent)+' AND user_id='+lit(user))
        error=rpc('desktop_prepare_chat_delivery',user,policy_source['id'],None,None,uid(),policy_target['conversation_id'],'Task','queue',fail=True)
        assert 'policy' in error or 'depth' in error
    sql('UPDATE desktop_agent_profiles SET policy='+lit(obj(original_policy))+'::jsonb WHERE agent_id='+lit(agent)+' AND user_id='+lit(user))
    for permission in ['chat','files']:
        limited=begin('Limited sender '+permission,opts=dict(options,permission=permission))
        assert 'task mode' in rpc('desktop_prepare_chat_delivery',user,limited['id'],None,None,uid(),policy_target['conversation_id'],'Task','queue',fail=True)
    goal=uid();sql('INSERT INTO desktop_goals(id,user_id,agent_id,objective,status,max_turns) VALUES('+','.join(map(lit,[goal,user,agent,'Controlled goal','running']))+',NULL)')
    goal_source=begin('Goal sender',opts=dict(options,goalId=goal));goal_message=prepare(goal_source,policy_target);call('desktop_authorize_chat_delivery',user,goal_message['id'],'once')
    sql("UPDATE desktop_goals SET status='paused' WHERE id="+lit(goal))
    assert 'sending goal stopped' in rpc('desktop_claim_chat_delivery',user,goal_message['id'],fail=True)
    check('Memory/tool/delegation allowlists, depth, Chat only/Selected files and paused source goals all block unauthorized delivery.')
    atomic_source=begin('Atomic delivery source');atomic_target=begin('Atomic delivery target',complete=True,opts=dict(options,permission='full'))
    original_instance=sql('SELECT agent_instance_id FROM desktop_requests WHERE id='+lit(atomic_target['id']))
    source_instance=sql('SELECT agent_instance_id FROM desktop_requests WHERE id='+lit(atomic_source['id']))
    ceiling=dict(original_policy,memoryWrite=False)
    sql('UPDATE desktop_agent_instances SET policy_ceiling='+lit(obj(ceiling))+'::jsonb WHERE id='+lit(source_instance))
    atomic=prepare(atomic_source,atomic_target,text='Prepare a scoped receiving turn');atomic=call('desktop_authorize_chat_delivery',user,atomic['id'],'pair');assert call('desktop_claim_chat_delivery',user,atomic['id'])['claimed']
    receiving_options=dict(options,harness='codex',skills=[],windows=[])
    assert 'permission must match' in rpc('desktop_begin_delivered_chat',user,atomic['id'],obj(dict(receiving_options,permission='full')),'[]',None,None,fail=True)
    assert sql('SELECT count(*) FROM desktop_requests WHERE id='+lit(atomic['id']))=='0'
    assert 'reviewed connection' in rpc('desktop_begin_delivered_chat',user,atomic['id'],obj(dict(receiving_options,provider='openrouter')),'[]',None,None,fail=True)
    assert 'workspace access' in rpc('desktop_begin_delivered_chat',user,atomic['id'],obj(dict(receiving_options,files=[uid()])),'[]',None,None,fail=True)
    prepared=call('desktop_begin_delivered_chat',user,atomic['id'],obj(receiving_options),'[]',None,None)
    assert prepared['id']==atomic['id'] and prepared['chat_delivery']['sourceConversationId']==atomic_source['conversation_id']
    composer=json.loads(sql("SELECT session_state->'desktop_composer' FROM conversation_sessions WHERE conversation_id="+lit(atomic_target['conversation_id'])))
    assert composer==atomic['snapshot']['target_options'] and composer['permission']=='full'
    receiving_instance=prepared['agent_instance_id'];instance=json.loads(sql('SELECT to_jsonb(i) FROM desktop_agent_instances i WHERE id='+lit(receiving_instance)))
    assert instance['parent_instance_id']==source_instance and instance['policy_ceiling']['memoryWrite']==False and instance['authority_chain'][-1]['delivery_id']==atomic['id']
    assert receiving_instance!=original_instance
    assert sql('SELECT policy_ceiling IS NULL AND authority_chain=\'[]\'::jsonb FROM desktop_agent_instances WHERE id='+lit(original_instance))=='t'
    assert call('desktop_begin_delivered_chat',user,atomic['id'],obj(receiving_options),'[]',None,None)['existing']
    assert sql('SELECT count(*) FROM chat_messages_v2 WHERE conversation_id='+lit(atomic_target['conversation_id']))=='4'
    rpc('desktop_validate_chat_delivery_request',user,prepared['id'])
    assert 'unavailable' in rpc('desktop_validate_chat_delivery_request',foreign,prepared['id'],fail=True)
    scope=call('desktop_chat_delivery_snapshot',user,atomic_source['id'],None,None,atomic_target['conversation_id'],'false')
    assert scope['target_options']['permission']=='full'
    call('desktop_finish_chat_delivery',user,atomic['id'],'delivered',prepared['id'],obj({'accepted':True}),None)
    check('Receiving preparation atomically binds provenance and a separate inherited agent instance, rejects broader options, preserves human defaults and returns the same request on replay.')
    nested_request=uid();nested=call('desktop_reserve_agent_invocation',user,prepared['id'],None,'dependent-fixture',agent,'Produce a dependent report',obj(receiving_options),obj(ceiling),instance['agent_revision'],nested_request)
    nested_instance=json.loads(sql('SELECT to_jsonb(i) FROM desktop_agent_instances i WHERE id='+lit(nested['child_instance_id'])))
    assert call('desktop_claim_agent_invocation',user,nested_request)['claimed']
    nested_started=call('desktop_begin_agent_chat',user,nested_request,agent,nested_instance['conversation_id'],'Produce a dependent report',obj(receiving_options),'[]',None,None,None,None,instance['agent_revision'],receiving_instance)
    rpc('desktop_validate_chat_delivery_request',user,nested_started['id'])
    rpc('desktop_revoke_chat_delivery_grant',user,atomic['grant_id'])
    for request_id in [prepared['id'],nested_started['id']]:assert 'revoked' in rpc('desktop_validate_chat_delivery_request',user,request_id,fail=True)
    rpc('desktop_checkpoint_chat',user,prepared['id'],'Controlled receiving result','completed',None)
    human=begin('Fresh human message',chat=atomic_target['conversation_id'],opts=dict(options,permission='full'));assert human['agent_instance_id']==original_instance;rpc('desktop_validate_chat_delivery_request',user,human['id']);rpc('desktop_checkpoint_chat',user,human['id'],'Human result','completed',None)
    fresh=prepare(atomic_source,atomic_target,text='A freshly authorized scoped assignment');fresh=call('desktop_authorize_chat_delivery',user,fresh['id'],'pair');assert call('desktop_claim_chat_delivery',user,fresh['id'])['claimed']
    new_receiving=call('desktop_begin_delivered_chat',user,fresh['id'],obj(receiving_options),'[]',None,None);rpc('desktop_validate_chat_delivery_request',user,new_receiving['id'])
    assert new_receiving['agent_instance_id']==receiving_instance
    check('Revocation reaches the receiving turn and named descendants; a fresh human turn and newly authorized handoff remain usable even when an instance is reused.')
    for signature in ['desktop_begin_delivered_chat(uuid,uuid,jsonb,jsonb,uuid,bigint)','desktop_validate_chat_delivery_request(uuid,uuid)','desktop_claim_chat_delivery_steering(uuid,uuid,uuid)','desktop_chat_delivery_dependents(uuid,uuid)']:
        for role in ['anon','authenticated']:assert sql('SELECT has_function_privilege('+lit(role)+','+lit(signature)+",'EXECUTE')")=='f'
        assert sql("SELECT has_function_privilege('service_role',"+lit(signature)+",'EXECUTE')")=='t'
    file_source_project,file_target_project,shared,private_file=uid(),uid(),uid(),uid()
    for project_id,title,files in [(file_source_project,'File source project',[shared]),(file_target_project,'File target project',[shared,private_file])]:
        sql('INSERT INTO desktop_projects(id,user_id,name,agent_memory_isolated,file_ids) VALUES('+','.join(map(lit,[project_id,user,title]))+",false,ARRAY["+','.join(lit(value)+'::uuid' for value in files)+'])')
    file_source=begin('File scope source',project=file_source_project);file_target=begin('File scope target',project=file_target_project,complete=True)
    file_delivery=prepare(file_source,file_target,project=file_source_project);call('desktop_authorize_chat_delivery',user,file_delivery['id'],'once');assert call('desktop_claim_chat_delivery',user,file_delivery['id'])['claimed']
    file_receiving=call('desktop_begin_delivered_chat',user,file_delivery['id'],obj(dict(receiving_options,files=[shared])),'[]',None,None)
    assert file_receiving['project']['file_ids']==[shared]
    follow_target=begin('File relay target',project=file_target_project,complete=True)
    relay_scope=call('desktop_chat_delivery_snapshot',user,file_receiving['id'],file_target_project,None,follow_target['conversation_id'])
    assert relay_scope['source_project']['file_ids']==[shared] and private_file not in relay_scope['source_options']['files']
    check('Receiving project context and subsequent coordination retain only shared file IDs; target project attachments cannot silently reappear during a relay.')
    race_sender=begin('Stop before receiving preparation');race_receiver=begin('Stop race destination',complete=True)
    stopped_preparation=prepare(race_sender,race_receiver);call('desktop_authorize_chat_delivery',user,stopped_preparation['id'],'once');assert call('desktop_claim_chat_delivery',user,stopped_preparation['id'])['claimed']
    rpc('desktop_checkpoint_chat',user,race_sender['id'],'','cancelled',None)
    assert 'sending task stopped' in rpc('desktop_begin_delivered_chat',user,stopped_preparation['id'],obj(receiving_options),'[]',None,None,fail=True)
    assert sql('SELECT count(*) FROM desktop_requests WHERE id='+lit(stopped_preparation['id']))=='0'
    revoked_sender=begin('Revoke before receiving preparation');revoked_receiver=begin('Revoke race destination',complete=True)
    revoked_preparation=prepare(revoked_sender,revoked_receiver);revoked_preparation=call('desktop_authorize_chat_delivery',user,revoked_preparation['id'],'pair');assert call('desktop_claim_chat_delivery',user,revoked_preparation['id'])['claimed']
    rpc('desktop_revoke_chat_delivery_grant',user,revoked_preparation['grant_id'])
    assert 'revoked' in rpc('desktop_begin_delivered_chat',user,revoked_preparation['id'],obj(receiving_options),'[]',None,None,fail=True)
    assert sql('SELECT count(*) FROM desktop_requests WHERE id='+lit(revoked_preparation['id']))=='0'
    check('Cancellation or revocation committed after claim but before preparation prevents creation of the receiving request.')
    # Actual database steering claims against two live native request records.
    # No app-server inference is involved in these storage tests.
    def native_begin(title,opts=None):
        item=begin(title,opts=opts)
        sql('INSERT INTO desktop_codex_turns(request_id,user_id,thread_id,runtime_version,state) VALUES('+','.join(map(lit,[item['id'],user,uid(),'0.163.0']))+",'{}'::jsonb)")
        return item
    def steer_claim(source,target,text,authorize=False):
        item=prepare(source,target,text=text)
        if authorize:item=call('desktop_authorize_chat_delivery',user,item['id'],'pair')
        assert item['status']=='queued'
        saved=call('desktop_claim_chat_delivery_steering',user,item['id'],target['id']);assert saved['claimed'] and saved['target_request']==target['id']
        call('desktop_finish_chat_delivery',user,item['id'],'delivered',target['id'],obj({'accepted':True,'delivery':'steer'}),None)
        return item
    left=native_begin('Bidirectional sender');right=native_begin('Bidirectional receiver')
    forward=steer_claim(left,right,'First incoming message',True)
    reply=steer_claim(right,left,'Reply to the first message')
    again=steer_claim(left,right,'Continue with the latest findings')
    assert forward['snapshot']['delivery_dependencies']==[]
    assert reply['snapshot']['delivery_dependencies']==[forward['id']]
    assert again['snapshot']['delivery_dependencies']==[reply['id']]
    for item in [left,right]:rpc('desktop_validate_chat_delivery_request',user,item['id'])
    assert not call('desktop_claim_chat_delivery_steering',user,forward['id'],right['id'])['claimed']
    check('Two running native chats can exchange successive steering messages without recursive dependency cycles; each saved receipt binds its actual receiving request.')
    pending_steer=prepare(left,right,text='Queued message selected for steering')
    assert call('desktop_claim_chat_delivery_steering',user,pending_steer['id'],right['id'])['claimed']
    assert 'Claim a queued' in rpc('desktop_begin_delivered_chat',user,pending_steer['id'],obj(receiving_options),'[]',None,None,fail=True)
    call('desktop_finish_chat_delivery',user,pending_steer['id'],'delivered',right['id'],obj({'delivery':'steer'}),None)
    check('A claimed steering message cannot also create a separate queued receiving turn.')
    relay_target=begin('Dependent relay destination',complete=True)
    relay=prepare(left,relay_target,text='Use the coordinated findings in this assignment');relay=call('desktop_authorize_chat_delivery',user,relay['id'],'pair')
    assert call('desktop_claim_chat_delivery',user,relay['id'])['claimed']
    relay_request=call('desktop_begin_delivered_chat',user,relay['id'],obj(receiving_options),'[]',None,None)
    call('desktop_finish_chat_delivery',user,relay['id'],'delivered',relay_request['id'],obj({'accepted':True}),None)
    relay_chain=json.loads(sql('SELECT authority_chain FROM desktop_agent_instances WHERE id='+lit(relay_request['agent_instance_id'])))
    assert reply['id'] in [entry.get('delivery_id') for entry in relay_chain]
    named_id=uid();named=call('desktop_reserve_agent_invocation',user,right['id'],None,'steering-dependent-specialist',agent,'Inspect the coordinated findings',obj(options),obj(original_policy),call('desktop_agent_profile',user,agent)['revision'],named_id)
    named_chain=json.loads(sql('SELECT authority_chain FROM desktop_agent_instances WHERE id='+lit(named['child_instance_id'])))
    assert {forward['id'],again['id'],pending_steer['id']} <= {entry.get('delivery_id') for entry in named_chain}
    dependent_ids=call('desktop_chat_delivery_dependents',user,forward['grant_id'])
    assert {left['id'],right['id'],relay_request['id'],named_id} <= set(dependent_ids)
    rpc('desktop_revoke_chat_delivery_grant',user,forward['grant_id'])
    for item in [left,right,relay_request]:assert 'revoked' in rpc('desktop_validate_chat_delivery_request',user,item['id'],fail=True)
    new_human=begin('Unrelated human request');rpc('desktop_validate_chat_delivery_request',user,new_human['id'])
    assert new_human['id'] not in call('desktop_chat_delivery_dependents',user,forward['grant_id'])
    check('Revocation follows steering into relay requests and pending named assignments, while unrelated human requests retain their own authority.')
    for title,extra,needle in [('Full permission',{'permission':'full'},'broader file'),('Extra file',{'files':[uid()]},'workspace access'),('Extra window',{'windows':[uid()]},'context selection'),('Extra skill',{'skills':['fixture-skill']},'context selection'),('Unrestricted tools',{},'tool selection')]:
        narrow=native_begin('Narrow source '+title,opts=dict(options,tools=[]))
        broad=native_begin('Broader destination '+title,opts=dict(options,**extra))
        item=prepare(narrow,broad);call('desktop_authorize_chat_delivery',user,item['id'],'once')
        assert needle in rpc('desktop_claim_chat_delivery_steering',user,item['id'],broad['id'],fail=True)
        assert sql('SELECT status FROM desktop_chat_deliveries WHERE id='+lit(item['id']))=='queued'
    check('Steering refuses broader command, file, window, skill and tool scopes before the message is claimed.')
    live_parent=native_begin('Parent remains active');stopped_thread=uid()
    sql("UPDATE desktop_codex_turns SET state="+lit(obj({'children':[{'threadId':stopped_thread,'status':'running'}]}))+'::jsonb WHERE request_id='+lit(live_parent['id']))
    stopped_child=prepare(live_parent,relay_target,thread=stopped_thread);call('desktop_authorize_chat_delivery',user,stopped_child['id'],'once')
    sql("UPDATE desktop_codex_turns SET state="+lit(obj({'children':[{'threadId':stopped_thread,'status':'cancelled'}]}))+'::jsonb WHERE request_id='+lit(live_parent['id']))
    assert 'sending task stopped' in rpc('desktop_claim_chat_delivery',user,stopped_child['id'],fail=True)
    check('Stopping a native child prevents its previously authorized handoff even while the parent request remains running.')
    # Actual Codex transport and ToolService, with explicit controlled decisions.
    # The receiving queue callback is inspected; no model endpoint is available.
    native_source=begin('Native delivery transport source');native_target=begin('Native delivery transport target',complete=True)
    token=secrets.token_urlsafe(32)
    def bridge_value(value):return lit(obj(value))+'::jsonb' if isinstance(value,(dict,list)) else lit(value)
    class Bridge(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            if self.headers.get('Authorization')!='Bearer '+token:self.send_error(403);return
            self.send_response(200);self.send_header('Content-Length','5');self.end_headers();self.wfile.write(b'ready')
        def do_POST(self):
            if self.headers.get('Authorization')!='Bearer '+token:self.send_error(403);return
            try:
                length=int(self.headers.get('Content-Length','0'));assert 0<length<200000
                body=json.loads(self.rfile.read(length));kind=body['kind']
                if kind=='rpc':
                    signatures={
                     'desktop_agent_request_scope':{'p_user','p_request','p_thread'},
                     'desktop_validate_chat_delivery_request':{'p_user','p_request'},
                     'desktop_prepare_chat_delivery':{'p_user','p_request','p_project','p_thread','p_call','p_target','p_text','p_delivery'},
                     'desktop_authorize_chat_delivery':{'p_user','p_id','p_decision'},
                     'desktop_change_chat_delivery':{'p_user','p_id','p_action'}}
                    assert body['name'] in signatures and set(body['args'])==signatures[body['name']]
                    assert body['args']['p_user']==user
                    if 'p_request' in body['args']:assert body['args']['p_request']==native_source['id']
                    if 'p_target' in body['args']:assert body['args']['p_target']==native_target['conversation_id']
                    if 'p_id' in body['args']:assert sql('SELECT count(*) FROM desktop_chat_deliveries WHERE source_request='+lit(native_source['id'])+' AND user_id='+lit(user)+' AND id='+lit(body['args']['p_id']))=='1'
                    value=sql('SELECT '+body['name']+'('+','.join(key+'=>'+bridge_value(value) for key,value in body['args'].items())+')');data=json.loads(value) if value else None
                elif kind=='table':
                    table=body['table'];operation=body['operation'];filters=body['filters'];columns=body['columns']
                    assert table in ['conversation_sessions','desktop_tool_calls','desktop_chat_deliveries','desktop_plans']
                    assert operation=='select' or table=='desktop_tool_calls' and operation in ['insert','update']
                    assert columns=='*' or re.fullmatch(r'[a-z_,]+',columns)
                    conditions=[]
                    for key,value in filters:
                        assert re.fullmatch(r'[a-z_]+',key) or key=='arguments->>provider_call_id'
                        field="arguments->>'provider_call_id'" if key=='arguments->>provider_call_id' else '"'+key+'"'
                        conditions.append(field+(' IS NULL' if value is None else '='+lit(value)))
                    conditions.append('user_id='+lit(user))
                    if table=='conversation_sessions':conditions.append('conversation_id='+lit(native_source['conversation_id']))
                    if table=='desktop_tool_calls':conditions.append('request_id='+lit(native_source['id']))
                    if table=='desktop_chat_deliveries':conditions.append('source_request='+lit(native_source['id']))
                    condition=' AND '.join(conditions)
                    if operation=='select':statement="SELECT coalesce(json_agg(t),'[]') FROM (SELECT "+columns+' FROM '+table+' WHERE '+condition+') t'
                    else:
                        values=body['values'];assert all(re.fullmatch(r'[a-z_]+',key) for key in values)
                        if operation=='insert':
                            assert values['user_id']==user and values['request_id']==native_source['id'] and values['conversation_id']==native_source['conversation_id']
                            statement="WITH changed AS(INSERT INTO desktop_tool_calls("+','.join('"'+key+'"' for key in values)+') VALUES('+','.join(bridge_value(value) for value in values.values())+") RETURNING *) SELECT coalesce(json_agg(changed),'[]') FROM changed"
                        else:
                            assert set(values)<={'status','result','approval','label','updated_at','error','preview'}
                            statement='WITH changed AS(UPDATE desktop_tool_calls SET '+','.join('"'+key+'"='+bridge_value(value) for key,value in values.items())+' WHERE '+condition+" RETURNING *) SELECT coalesce(json_agg(changed),'[]') FROM changed"
                    items=json.loads(sql(statement));data=items[0] if body['single'] and items else None if body['single'] else items
                elif kind=='control':
                    if body['action']=='bind_root':
                        thread=str(uuid.UUID(body['thread']))
                        sql('INSERT INTO desktop_codex_turns(request_id,user_id,thread_id,runtime_version,state) VALUES('+','.join(map(lit,[native_source['id'],user,thread,'0.163.0']))+','+lit(obj({'threadId':thread}))+'::jsonb)')
                    elif body['action']=='revoke_pair':
                        grants=json.loads(sql("SELECT coalesce(json_agg(id),'[]') FROM desktop_chat_delivery_grants WHERE user_id="+lit(user)+' AND first_chat=least('+lit(native_source['conversation_id'])+'::uuid,'+lit(native_target['conversation_id'])+'::uuid) AND second_chat=greatest('+lit(native_source['conversation_id'])+'::uuid,'+lit(native_target['conversation_id'])+'::uuid)'))
                        assert len(grants)==1;rpc('desktop_revoke_chat_delivery_grant',user,grants[0])
                    else:raise ValueError('Unknown fixture control')
                    data=None
                else:raise ValueError('Unknown fixture operation')
                reply={'data':data,'error':None}
            except Exception as error:
                (out/'private-bridge-error.json').write_text(obj({'kind':body.get('kind'),'table':body.get('table'),'name':body.get('name'),'operation':body.get('operation'),'columns':body.get('columns'),'error':repr(error)}))
                message=str(error) or repr(error)
                if isinstance(error,RuntimeError) and (out/'private-error.log').exists():message=(out/'private-error.log').read_text().splitlines()[0]
                reply={'data':None,'error':{'message':message}}
            payload=json.dumps(reply,ensure_ascii=False).encode('utf-8');self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(payload)));self.end_headers();self.wfile.write(payload)
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Bridge);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    windows=lambda value:'D:'+str(value)[6:].replace('/','\\') if str(value).startswith('/mnt/d/') else 'C:'+str(value)[6:].replace('/','\\')
    native_config=out/'private-native-config.json';native_config.write_text(obj({'endpoint':'http://127.0.0.1:'+str(server.server_port),'token':token,'out':windows(out),'build':sys.argv[3],'resources':r'C:\Users\charl\AppData\Local\AgentopiaDesktop\app-0.44.17\resources\resources','user':user,'request':native_source,'target':native_target['conversation_id']}))
    try:
        native=subprocess.run([sys.argv[2],windows(root/'scripts/desktop/chat-delivery-native.cjs'),windows(native_config)],cwd=str(root),text=True,capture_output=True,timeout=90)
        (out/'private-native.log').write_text(native.stdout+'\n'+native.stderr);assert native.returncode==0,'Inspect private-native.log'
        native_evidence=json.loads(native.stdout.strip().splitlines()[-1]);assert native_evidence['success'] and native_evidence['liveInferenceRequests']==0
        evidence['native']=native_evidence
    finally:
        server.shutdown();server.server_close();thread.join(timeout=5);native_config.unlink()
    receipts=json.loads(sql("SELECT json_agg(json_build_object('status',status,'label',label)) FROM desktop_tool_calls WHERE request_id="+lit(native_source['id'])))
    assert sum(row['status']=='completed' for row in receipts)==3
    assert sum(row['status']=='interrupted' for row in receipts)==1
    assert sql("SELECT count(*) FROM desktop_chat_deliveries WHERE source_request="+lit(native_source['id'])+" AND status='cancelled'")=='1'
    check('Bundled Codex calls actual ToolService/PostgreSQL: once/pair decisions, duplicate receipt, cached grant, scope rejection and pending cancellation pass; receiving-queue handoffs are controlled and no inference runs.')
    evidence['checksPassed']=True
except Exception as error:
    evidence['error']=repr(error);(out/'private-traceback.log').write_text(traceback.format_exc())
finally:
    if rest:rest.close()
    if created:sql('DROP DATABASE '+database,'postgres');evidence['disposableDatabaseRemoved']=True
    evidence['productionAfter']=inventory();evidence['productionInventoryUnchanged']=evidence['productionBefore']==evidence['productionAfter']
    evidence['success']=bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionInventoryUnchanged'])
    (out/'evidence.json').write_text(json.dumps(evidence,indent=2))
print(json.dumps({'success':evidence['success'],'checks':len(evidence['checks']),'databaseRemoved':evidence.get('disposableDatabaseRemoved'),'productionInventoryUnchanged':evidence['productionInventoryUnchanged'],'providerRequests':0,'error':evidence.get('error')},indent=2));sys.exit(0 if evidence['success'] else 1)
