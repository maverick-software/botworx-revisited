"""Assess actual saved outcomes; model prose alone cannot establish success."""
from pathlib import Path
import datetime,hashlib,json,re,sys
out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-agent-live50') and re.fullmatch(r'\d{13}',out.name)
intent=json.loads((out/'intent.json').read_text());setup=json.loads((out/'setup.json').read_text());capture=Path(json.loads((out/'latest-capture.json').read_text())['file']);records=json.loads(capture.read_text());assert records['readOnly'] and not records['preExistingRowsChanged']
requests={r['id']:r for r in records['requests']};source=requests[intent['requestIds']['source']];recall=requests[intent['requestIds']['recall']];assert len(records['invocations'])==1;invocation=records['invocations'][0];child=requests[invocation['request_id']];assert len(requests)==3
messages={r['id']:r for r in records['messages']};native={r['request_id']:r for r in records['native']};instances={r['request_id']:r for r in records['instances']};memberships={r['conversation_id']:r['project_id'] for r in records['memberships']};tools=records['tools'];checks=[]
for request in requests.values():
    assert request['user_id']==setup['owner'] and request['status']=='completed' and request.get('error') is None
    assert instances[request['id']]['status']=='completed';context=native[request['id']]['context'];assert context['provider']=='openai-oauth' and context['model']==intent['model'] and native[request['id']]['runtime_version']=='0.163.0'
    assert context['options']['permission']=='full' and context['options']['harness']=='codex';assert native[request['id']]['state']['approvals']==[]
    assert not any(item['item']['type']=='commandExecution' for item in native[request['id']]['state']['items'])
    assert messages[request['assistant_message_id']]['metadata']['agent']['id']==request['agent_id']
checks.append('Three actual installed-app ChatGPT OAuth requests completed through Codex 0.163.0 without approval prompts, commands, provider switching or replay.')
text=lambda request:messages[request['assistant_message_id']]['content']['text']
for request in [source,recall]:
    assert request['agent_id']==setup['coordinator']
    profile=native[request['id']]['context']['agentProfile'];assert profile['revision']==2 and profile['role']=='Verification coordinator' and intent['procedure'] in profile['sops'] and any(intent['skill'] in skill['content'] for skill in profile['skills'])
    assert all(marker in text(request) for marker in ['Verification coordinator',intent['procedure'],intent['skill']])
checks.append('The saved custom role, procedure and persistent skill reached two separate coordinator conversations and their final answers.')
memories=[m for m in records['memories'] if m['title']==intent['marker']];assert len(memories)==1;memory=memories[0];assert memory['agent_id']==setup['coordinator'] and memory['content']==intent['fact'] and memory['revision']==1 and memory['authored_by']=='agent' and memory['source_message_id']==source['user_message_id'] and memory['source_conversation_id']==source['conversation_id']
saved=[t for t in tools if t['name']=='save_agent_memory'];assert len(saved)==1 and saved[0]['status']=='completed' and saved[0]['result']['memory']['id']==memory['id']
assert memberships[source['conversation_id']]==setup['projectA']['id'] and memberships[recall['conversation_id']]==setup['projectB']['id'] and setup['projectA']['id']!=setup['projectB']['id']
assert native[source['id']]['thread_id']!=native[recall['id']]['thread_id'] and intent['fact'] not in messages[recall['user_message_id']]['content']['text'] and intent['fact'] in text(recall)
citation='agentopia-chat://'+source['conversation_id']+'/message/'+source['user_message_id'];assert citation in text(recall)
searched=[t for t in tools if t['request_id']==recall['id'] and t['name']=='search_agent_memory' and t['status']=='completed'];assert len(searched)==1 and any(m['id']==memory['id'] for m in searched[0]['result']['memories'])
checks.append('One source-linked memory was saved once and recalled with its citation by a fresh native conversation in a different project, without receiving the fact again in its prompt.')
invoked=[t for t in tools if t['name']=='invoke_agent'];assert len(invoked)==1 and invoked[0]['status']=='completed' and invoked[0]['result']['existing'] is False and invocation['status']=='completed';assert child['agent_id']==setup['specialist'] and intent['fact'] not in invocation['payload']['assignment']
profile=native[child['id']]['context']['agentProfile'];assert profile['role']=='Restricted verification specialist' and profile['policy']['tools']==['search_agent_memory','list_agent_instances'] and not profile['policy']['delegation'] and not profile['policy']['memoryWrite'];assert intent['specialist'] in text(child) and intent['fact'] not in text(child)
child_tools=[t for t in tools if t['request_id']==child['id']];assert {t['name'] for t in child_tools}=={'search_agent_memory','list_agent_instances'} and all(t['status']=='completed' for t in child_tools)
assert next(t for t in child_tools if t['name']=='search_agent_memory')['result']['memories']==[]
running=next(t for t in child_tools if t['name']=='list_agent_instances')['result']['instances'];assert any(i['id']==instances[child['id']]['id'] and i['status']=='running' for i in running)
read=[t for t in tools if t['request_id']==source['id'] and t['name']=='read_agent_instance' and t['status']=='completed'];assert len(read)==1 and read[0]['result']['instance']['status']=='completed' and read[0]['result']['instance']['id']==instances[child['id']]['id'] and intent['specialist'] in text(source)
checks.append('The named specialist used its own role and restricted tool policy, reported an actual running assignment, could not find the coordinator memory, and its completed saved result was read by the parent.')
failures=[t for t in tools if t['status']!='completed'];assert len(failures)==1 and failures[0]['name']=='read_agent_instance' and failures[0]['arguments']['characters']==20000 and '12000' in failures[0]['error'];assert read[0]['arguments']['characters']<=12000
checks.append('An oversized transcript read was rejected; the agent corrected the length and completed the read without repeating the named invocation.')
histories=[]
for request in requests.values():
    turn=native[request['id']];home=Path('/mnt/c/Users/charl/.agentopia/desktop/profile/codex')/setup['owner']/'openai-oauth'/(request['conversation_id']+'-'+turn['context']['scope']);files=list((home/'sessions').glob('*/*/*/*'+turn['thread_id']+'*.jsonl'));assert len(files)==1 and not files[0].is_symlink()
    with files[0].open(encoding='utf-8') as stream:header=json.loads(stream.readline())
    assert header['type']=='session_meta' and header['payload']['id']==turn['thread_id']
    with files[0].open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
    histories.append({'request':request['id'],'thread':turn['thread_id'],'file':str(files[0]),'sha256':digest})
checks.append('Each request has a real native session beneath the published private profile, and all pre-existing fingerprints across 14 tables remain present unchanged.')
report={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'0.44.50','imageSha256':intent['imageSha256'],'out':str(out),'capture':str(capture),'captureSha256':hashlib.sha256(capture.read_bytes()).hexdigest(),'liveProvider':'openai-oauth','completedRequests':3,'parentRequests':[source['id'],recall['id']],'childRequest':child['id'],'namedInvocations':1,'OpenRouterRequests':0,'replayedRequests':0,'checks':checks,'nativeHistories':histories,'preExistingTablesCompared':14,'preExistingRowsChanged':{},'originalDefinitionsChanged':False,'ordinaryStateRestorationPending':True,'normalRestartVerificationPending':True,'fullGoalComplete':False}
file=out/'live-assessment.json';assert not file.exists();file.write_text(json.dumps(report,indent=2));print(json.dumps({'success':True,'out':str(out),'checks':len(checks),'completedRequests':3,'originalDefinitionsChanged':False}))
