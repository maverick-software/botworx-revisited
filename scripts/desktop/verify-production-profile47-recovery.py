"""Audit completed ordinary search and prior vision in a closed backup; never starts SQL."""
import base64,glob,hashlib,json,re,subprocess
from pathlib import Path
ROOT=Path('/mnt/d/Users/charl/software/Agentopia')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
assert 'postgres' not in subprocess.check_output(['ps','-eo','comm='],text=True).splitlines()
pointer=json.loads((ROOT/'.supabase/desktop-platform-release/candidate-04447/profile-migration-backup.json').read_text())
assert pointer['success'] and not pointer['installed']
backup=Path(pointer['out'].replace('C:\\','/mnt/c/').replace('\\','/'))
assert backup.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/before-private-profile-04447') and re.fullmatch(r'\d{13}',backup.name)
evidence=json.loads((backup/'evidence.json').read_text());assert evidence['success'] and evidence['includesOrdinary44VisionSearchAndChildPreview']
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0]
def decode(value):
    escape={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','\\':'\\'}
    return re.sub(r'\\([0-7]{1,3}|.)',lambda m:chr(int(m[1],8)) if re.fullmatch('[0-7]{1,3}',m[1]) else escape.get(m[1],m[1]),value)
def table(name,schema='public',archive='application.dump'):
    text=subprocess.check_output([binary,'--data-only','--schema',schema,'--table',name,'--file=-',str(backup/'current-database-backup'/archive)],text=True)
    match=re.search(r'^COPY '+re.escape(schema+'.'+name)+r' \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S);assert match
    columns=[c.strip().strip('"') for c in match[1].split(',')]
    return [dict(zip(columns,row.split('\t'))) for row in match[2].splitlines()]
def one(rows,key,value):
    found=[r for r in rows if r[key]==value];assert len(found)==1;return found[0]
def obj(row,key):return json.loads(decode(row[key]))
source=ROOT/'.supabase/desktop-native-search/ordinary-1792377323235'
accepted=json.loads((source/'evidence.json').read_text());intent=json.loads((source/'intent.json').read_text())
requests=table('desktop_requests');messages=table('chat_messages_v2');native=table('desktop_codex_turns')
request=one(requests,'id',accepted['requestId']);assert request['status']=='completed'
user=obj(one(messages,'id',request['user_message_id']),'content');answer=obj(one(messages,'id',request['assistant_message_id']),'content')
assert user['text']==intent['prompt'] and user['files']==[]
assert 'https://developers.openai.com/codex/config-advanced#custom-model-providers' in answer['text']
turn=one(native,'request_id',request['id']);assert turn['thread_id']==accepted['nativeThreadId'] and turn['turn_id']==accepted['nativeTurnId']
plugin=one(table('desktop_plugins'),'name','exa-web-search');assert plugin['digest']==accepted['plugin']['digest'] and plugin['enabled']=='t'
assigned=[r for r in table('desktop_agent_plugins') if r['plugin_name']=='exa-web-search' and r['enabled']=='t']
assert len(assigned)==1 and assigned[0]['agent_id']==request['agent_id']
current=json.loads((ROOT/'.supabase/desktop-native-independent/ordinary-1792391418897/outcome.json').read_text())['current']
assert len(messages)>=current['messages'] and len(table('conversation_sessions'))>=current['chats'] and len(requests)>=current['requests'];current={'messages':len(messages),'chats':len(table('conversation_sessions')),'requests':len(requests)}
users=table('users','auth','auth.dump');assert len(users)==accepted['accounts']
baseline=json.loads((source/'baseline.json').read_text())
passwords='|'.join(u['id']+('' if u['encrypted_password']=='\\N' else decode(u['encrypted_password'])) for u in sorted(users,key=lambda u:u['id']))
assert hashlib.md5(passwords.encode()).hexdigest()==baseline['core']['passwordFingerprint']
vision=ROOT/'.supabase/desktop-vision-live/1792371918104';vi=json.loads((vision/'intent.json').read_text());va=json.loads((vision/'acceptance.json').read_text())
vr=one(requests,'id',va['request']['id']);assert vr['status']=='completed'
vu=obj(one(messages,'id',vr['user_message_id']),'content');vv=obj(one(messages,'id',vr['assistant_message_id']),'content')
assert vu['text']==vi['prompt'] and json.loads(vv['text'])==vi['expected']
assert hashlib.sha256(base64.b64decode(vu['files'][0]['image'].split(',',1)[1])).hexdigest()==vi['sha256']
vn=one(native,'request_id',vr['id']);assert vn['thread_id']==va['threadId'] and vn['turn_id']==va['turnId']
children=[]
for request_id,child_id,stopped in [('e56a64d8-74a7-4f46-b467-f261683b9802','01a152c6-58b9-7091-864f-1b4419678883',False),('1049b4b0-9031-432f-b8aa-c7cd9077ebb1','01a152dc-1375-7202-a838-04898c9c6c1d',True)]:
    child_request=one(requests,'id',request_id);assert child_request['status']=='completed'
    saved=obj(one(native,'request_id',request_id),'state');assert len(saved['children'])==1
    child=saved['children'][0];assert child['threadId']==child_id and child['status']=='completed' and child['delivery']=='delivered'
    assert len(saved['reports'])==1 and saved['reports'][0]['status']=='completed'
    if stopped:assert any(i.get('background')=='stopped' and i.get('completed') and i['item'].get('processId')=='5243' for i in child['state']['items'])
    children.append({'request':request_id,'child':child_id,'resultAndAutomaticReportPreserved':True,'dedicatedStopPreserved':stopped})
result={'success':True,'at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'backup':str(backup),'requestId':request['id'],'completedSearchAndCitationPreserved':True,'pluginAndAssignmentPreserved':True,'nativeThreadAndTurnPreserved':True,'previousVisionAnswerAndImagePreserved':True,'passwordsPreserved':True,'children':children,'accounts':len(users),'conversations':current['chats'],'messages':len(messages),'ordinaryRequests':len(requests),'databaseServicesStarted':0,'providerRequests':0,'readOnly':True}
with (backup/'ordinary-recovery-acceptance.json').open('x') as stream:json.dump(result,stream,indent=2)
print(json.dumps(result))
