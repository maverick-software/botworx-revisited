"""Independently verify saved live outcomes and preservation, without inference."""
from pathlib import Path
import contextlib,datetime,hashlib,io,json,os,re,runpy,subprocess,sys
root=Path('/mnt/d/Users/charl/software/Agentopia');original=sys.argv;sys.argv=['inspect-profile-agent-live47.py','capture']
try:
 with contextlib.redirect_stdout(io.StringIO()):audit=runpy.run_path(str(root/'scripts/desktop/inspect-profile-agent-live47.py'))
finally:sys.argv=original
out=audit['out'];intent=audit['intent'];record=audit['record'];baseline=json.loads((out/'baseline.json').read_text());ui=json.loads((out/'ui-observations.json').read_text());assert ui['success'] and ui['generatedJsonPreviewVerified'] and ui['completedSteeringRetainedInExpandedActivity'] and ui['queuedCard']['count']==1
assert len(record['parents'])==1;parent=record['parents'][0];assert parent['status']=='completed' and parent['error'] is None and parent['userContent']['text']==intent['prompt']
instances=record['instances'];assert len(instances)==3 and all(i['status']=='completed' and i['request']['status']=='completed' and i['request']['error'] is None for i in instances)
children=[i for i in instances if i['depth']==1];assert len(children)==2
own=[i for i in children if i['agent_id']==parent['agent_id']];other=[i for i in children if i['agent_id']!=parent['agent_id']];assert len(own)==len(other)==1
assert other[0]['agent_id']=='cb61520c-dd18-4e8f-88b6-d7f8ae2389c3';assert record['core']['requests']==baseline['core']['requests']+3 and record['core']['chats']==baseline['core']['chats']+3 and record['core']['runningRequests']==0
profile=Path('/mnt/c/Users/charl/.agentopia/desktop/profile');native_files=[]
for instance in instances:
 native=instance['native'];context=native['context'];options=context['options'];assert context['provider']=='openai-oauth' and options['provider']=='openai-oauth' and options['harness']=='codex' and options['model']=='gpt-6.1-sol' and options['permission']=='full' and options['mode']=='chat' and native['runtime_version']=='0.163.0'
 assert native['state']['approvals']==[]
 home=profile/'codex'/record['owner']/'openai-oauth'/(instance['conversation_id']+'-'+context['scope']);assert home.is_dir() and not home.is_symlink()
 files=list((home/'sessions').glob('*/*/*/*'+native['thread_id']+'*.jsonl'));assert len(files)==1 and not files[0].is_symlink()
 with files[0].open(encoding='utf-8') as stream:header=json.loads(stream.readline())
 assert header['type']=='session_meta' and header['payload']['id']==native['thread_id']
 with files[0].open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
 native_files.append({'request':instance['request_id'],'nativeThread':native['thread_id'],'home':str(home),'rollout':str(files[0]),'rolloutSha256':digest})
tools=record['tools'];assert len(tools)==8 and all(t['status']=='completed' and t['error'] is None and t.get('approval') is None for t in tools)
invocations=[t for t in tools if t['name']=='invoke_agent'];assert len(invocations)==2 and all(t['request_id']==parent['id'] and t['result']['existing'] is False and intent['fact'] not in t['arguments']['assignment'] for t in invocations)
assert len(record['memories'])==1;memory=record['memories'][0];assert memory['title']==intent['marker'] and intent['fact'] in memory['content'] and memory['agent_id']==parent['agent_id'] and memory['source_message_id']==parent['user_message_id'] and memory['source_conversation_id']==parent['conversation_id'] and memory['authored_by']=='agent' and memory['revision']==1
for child in children:
 childtools=[t for t in tools if t['request_id']==child['request_id']];assert len(childtools)==1 and childtools[0]['name']=='search_agent_memory';found=childtools[0]['result']['memories']
 assert not any(i['item']['type']=='commandExecution' for i in child['native']['state']['items'])
 if child is own[0]:assert len(found)==1 and found[0]['id']==memory['id'] and intent['fact'] in child['reply']['text'] and parent['conversation_id'] in child['reply']['text']
 else:assert found==[] and intent['fact'] not in child['reply']['text']
reads=[t for t in tools if t['name']=='read_agent_instance'];assert len(reads)==2 and {t['result']['instance']['id'] for t in reads}=={i['id'] for i in children} and all(t['result']['instance']['status']=='completed' for t in reads)
state=parent['native']['state'];assert len(state['steering'])==1 and state['steering'][0]['text']==intent['steering'];commands=[i['item'] for i in state['items'] if i['item']['type']=='commandExecution'];assert len(commands)==1 and commands[0]['status']=='completed' and commands[0]['exitCode']==0
artifact=Path(intent['workspace'].replace('D:\\','/mnt/d/').replace('\\','/'))/'proof.json';assert json.loads(artifact.read_text(encoding='utf-8-sig'))=={'marker':intent['marker'],'operation':'native-command'}
preserved={};before=json.loads(Path('/mnt/c/Users/charl/AgentopiaQA/production-profile47/1792454964248/data-before.json').read_text());conversations={i['conversation_id'] for i in instances};requests={i['request_id'] for i in instances};assert all(re.fullmatch('[a-f0-9-]{36}',value) for value in conversations|requests)
quote=lambda values:','.join("'"+value+"'" for value in sorted(values))
for schema,name,column,exclude in [('public','conversation_sessions','conversation_id',conversations),('public','chat_messages_v2','conversation_id',conversations),('public','desktop_requests','id',requests),('public','desktop_codex_turns','request_id',requests),('public','desktop_codex_threads','conversation_id',conversations),('public','agents',None,None),('auth','users',None,None),('vault','secrets',None,None)]:
 expression="to_jsonb(t)-'last_sign_in_at'-'updated_at'" if schema=='auth' else 'to_jsonb(t)';where=' WHERE '+column+' NOT IN ('+quote(exclude)+')' if column else ''
 query=f'SELECT {expression} FROM {schema}."{name}" t'+where+f' ORDER BY ({expression})::text'
 args=[audit['binary'],'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(audit['db'].port),'-U','supabase_admin','-d','postgres'];env=dict(audit['env'],PGTZ='UTC');result=subprocess.run(args,input=query,env=env,text=True,capture_output=True,check=True);value={'rows':len(result.stdout.splitlines()),'sha256':hashlib.sha256(result.stdout.encode()).hexdigest()};assert value==before['tables'][schema+'.'+name],schema+'.'+name+' pre-existing rows changed';preserved[schema+'.'+name]=value['rows']
evidence={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.47','profile':str(profile),'marker':intent['marker'],'liveProvider':'openai-oauth','model':'gpt-6.1-sol','harness':'codex','runtimeVersion':'0.163.0','completedRequests':3,'parentRequestId':parent['id'],'parentInstanceId':parent['agent_instance_id'],'namedChildren':[{'instance':i['id'],'request':i['request_id'],'agent':i['agent_id'],'conversation':i['conversation_id']} for i in children],'sameIdentityRecallVerified':True,'otherIdentityOwnMemorySearchEmpty':True,'sourceLinkedMemorySavedExactlyOnce':True,'savedChildResultsReadByParent':True,'nativeCommandCompletedWithoutApproval':True,'steeringAcceptedExactlyOnceInSameTurn':True,'noRequestReplay':True,'OpenRouterRequests':0,'newNativeHistoriesAtPublishedProfile':native_files,'preExistingRowsPreserved':preserved,'existingAgentDefinitionsPreserved':True,'firstUseDefaultProfileMaterializedForChatGPTAssistant':True,'artifact':str(artifact),'artifactSha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),'generatedCodeLinkPreviewVerified':True,'coreCounts':{key:value for key,value in record['core'].items() if key!='passwordFingerprint'},'scope':'Three actual ChatGPT-backed requests in the adopted profile: one parent and two named instances. This does not establish general live concurrency/cancellation/reboot or custom role/SOP/skill acceptance.','fullGoalComplete':False}
with (out/'acceptance.json').open('x') as stream:json.dump(evidence,stream,indent=2)
print(json.dumps(evidence))
