"""Read-only saved-agent audit. Never invoke, recover, enqueue or replay work."""
from pathlib import Path
import collections,datetime,glob,hashlib,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote

out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-agent-health61') and re.fullmatch(r'\d{13}',out.name)
assert out.is_dir() and out.resolve()==out
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_agent_health51_readonly')
def sql(query):
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n',env=env,text=True,capture_output=True)
    if result.returncode:
        (out/'private-query-error.txt').write_text(result.stderr)
        raise RuntimeError('Read-only agent audit query failed; private diagnostic retained')
    return json.loads(result.stdout)
names=['agents','desktop_agent_profiles','desktop_agent_definition_revisions','desktop_agent_instances','desktop_agent_invocations','desktop_agent_memories','desktop_agent_memory_revisions','conversation_sessions','chat_messages_v2','desktop_requests','desktop_projects','desktop_project_chats']
omit={'agents':"-'system_instructions'-'assistant_instructions'-'description'",'desktop_agent_instances':"-'assignment'-'checkpoint'",'desktop_agent_invocations':"-'payload'-'error'",'desktop_agent_memories':"-'content'",'desktop_agent_memory_revisions':"-'content'",'chat_messages_v2':"-'content'-'metadata'",'desktop_requests':"-'error'-'input'-'options'"}
data=sql('SELECT jsonb_build_object('+','.join("'"+name+"',(SELECT coalesce(jsonb_agg(to_jsonb(t)"+omit.get(name,'')+"),'[]') FROM public."+name+' t)' for name in names)+",'owners',(SELECT jsonb_agg(id) FROM auth.users));")
agents={r['id']:r for r in data['agents']};profiles={r['agent_id']:r for r in data['desktop_agent_profiles']};instances={r['id']:r for r in data['desktop_agent_instances']};chats={r['conversation_id']:r for r in data['conversation_sessions']};messages={r['id']:r for r in data['chat_messages_v2']};requests={r['id']:r for r in data['desktop_requests']};projects={r['id']:r for r in data['desktop_projects']};memories={r['id']:r for r in data['desktop_agent_memories']}
revisions={(r['agent_id'],r['revision']):r for r in data['desktop_agent_definition_revisions']};memory_revisions={(r['memory_id'],r['revision']) for r in data['desktop_agent_memory_revisions']}
problems=[];observations=[]
def require(condition,kind,record):
    if not condition:problems.append({'kind':kind,'record':record})
def owned(rows,key,user):return key in rows and rows[key].get('user_id')==user
for row in profiles.values():
    aid=row['agent_id'];owner=row['user_id'];require(owned(agents,aid,owner),'profile-owner',aid)
    require((aid,row['revision']) in revisions,'current-definition-revision',aid)
    for skill in row['skills']:require(hashlib.sha256(skill['content'].encode()).hexdigest()==skill.get('sha256'),'saved-skill-hash',aid)
    policy=row['policy'];require(isinstance(policy.get('maxDepth'),int) and 0<=policy['maxDepth']<=4 and isinstance(policy.get('maxTurns'),int) and 1<=policy['maxTurns']<=50,'policy-bounds',aid)
    for target in policy.get('delegateAgents') or []:require(owned(agents,target,owner),'delegation-target-owner',aid)
for row in instances.values():
    iid=row['id'];owner=row['user_id'];require(owned(agents,row['agent_id'],owner),'instance-agent-owner',iid);require(owned(chats,row['conversation_id'],owner),'instance-chat-owner',iid)
    require((row['agent_id'],row['agent_revision']) in revisions,'instance-definition-revision',iid)
    if row['project_id']:require(owned(projects,row['project_id'],owner),'instance-project-owner',iid)
    if row['parent_instance_id']:
        parent=instances.get(row['parent_instance_id']);require(parent is not None and parent['user_id']==owner and row['depth']==parent['depth']+1,'instance-parent-lineage',iid)
    rid=row.get('request_id')
    if rid:
        request=requests.get(rid);require(request is not None and request['user_id']==owner and request.get('agent_instance_id')==iid and request['conversation_id']==row['conversation_id'],'instance-request-binding',iid)
        if row['status'] in ('running','awaiting_approval'):require(request is not None and request['status']=='running','active-instance-request-status',iid)
    for grant in row.get('authority_chain') or []:require(owned(agents,grant['agent_id'],owner) and owned(instances,grant['instance_id'],owner),'authority-chain-owner',iid)
for row in data['desktop_agent_invocations']:
    rid=row['request_id'];owner=row['user_id'];caller=instances.get(row['caller_instance_id']);child=instances.get(row['child_instance_id'])
    require(caller is not None and caller['user_id']==owner and child is not None and child['user_id']==owner and child['parent_instance_id']==caller['id'] and child['agent_id']==row['target_agent_id'] and child['request_id']==rid,'invocation-lineage',rid)
    if row['status'] in ('queued','starting','running'):observations.append({'kind':'pending-named-invocation','request':rid,'status':row['status'],'updatedAt':row['updated_at']})
for row in memories.values():
    mid=row['id'];owner=row['user_id'];require(owned(agents,row['agent_id'],owner),'memory-agent-owner',mid);require((mid,row['revision']) in memory_revisions,'memory-current-revision',mid)
    if row['project_id']:require(owned(projects,row['project_id'],owner),'memory-project-owner',mid)
    if row['instance_id']:require(owned(instances,row['instance_id'],owner) and instances[row['instance_id']]['agent_id']==row['agent_id'],'memory-instance-owner',mid)
    if row['source_message_id']:
        source=messages.get(row['source_message_id']);require(owned(chats,row['source_conversation_id'],owner) and source is not None and source['conversation_id']==row['source_conversation_id'],'memory-source-link',mid)
rls=[]
for owner in data['owners']:
    assert re.fullmatch('[a-f0-9-]{36}',owner)
    selected=['agents','desktop_agent_profiles','desktop_agent_instances','desktop_agent_memories','desktop_agent_invocations']
    query="SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='"+owner+"'; SELECT jsonb_build_object("+','.join("'"+table+"',(SELECT jsonb_build_object('visible',count(*),'foreign',count(*) FILTER(WHERE user_id<>'"+owner+"')) FROM public."+table+')' for table in selected)+');'
    seen=sql(query)
    for table,counts in seen.items():require(counts['foreign']==0,'authenticated-owner-row-policy',table)
    rls.append({'owner':owner,'tables':seen})
visibility=sql("SELECT coalesce(jsonb_agg(jsonb_build_object('memory',m.id,'visible',desktop_agent_memory_visible(m.user_id,m.project_id,m.id),'foreignIdentityMatches',(SELECT count(*) FROM agents a CROSS JOIN LATERAL jsonb_array_elements(desktop_search_agent_memory(m.user_id,a.id,m.project_id,m.title,30)) result(value) WHERE a.user_id=m.user_id AND a.id<>m.agent_id AND result.value->>'id'=m.id::text))),'[]') FROM desktop_agent_memories m;")
for row in visibility:require(row['foreignIdentityMatches']==0,'memory-identity-search-isolation',row['memory'])
program=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.61/resources/app.asar');image=hashlib.file_digest(program.open('rb'),'sha256').hexdigest();require(image=='9b484f7e69a426e4129491fb42e14e468ea3c2daee7242d410e213b6667054b4','installed-archive','0.44.61')
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'success':not problems,'version':'0.44.61','imageSha256':image,'databaseReadOnly':True,'providerRequests':0,'replayedRequests':0,'servicesStartedOrStopped':0,'counts':{name:len(rows) for name,rows in data.items()},'profiles':[{'agent':r['agent_id'],'name':agents[r['agent_id']]['name'],'handle':r['handle'],'revision':r['revision'],'roleConfigured':bool(r['role']),'proceduresConfigured':bool(r['sops']),'skills':len(r['skills']),'active':agents[r['agent_id']]['active']} for r in profiles.values()],'instanceStatuses':dict(collections.Counter(r['status'] for r in instances.values())),'requestStatuses':dict(collections.Counter(r['status'] for r in requests.values())),'rowPolicyChecks':rls,'memoryIdentityChecks':visibility,'problems':problems,'observations':observations}
(out/'evidence.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:report[k] for k in ('success','version','counts','profiles','instanceStatuses','requestStatuses','problems','observations')}));sys.exit(0 if report['success'] else 1)
