"""Read saved SQL archives without starting a database or restoring data."""
from pathlib import Path
import datetime,glob,hashlib,json,re,subprocess,sys
from native_index_reader import frozen_native_index

out=Path(sys.argv[1]);assert len(sys.argv)==2 and out.parent==Path('/mnt/c/Users/charl/AgentopiaRecovery/private-profile-current') and re.fullmatch(r'\d{13}',out.name)
evidence=json.loads((out/'evidence.json').read_text());composite=json.loads((out/'ui-recovery.json').read_text()) if (out/'ui-recovery.json').exists() else None
if composite:assert composite['success'] and composite['retainedColdImageHashVerified'] and composite['currentDatabaseArchiveHashesVerified'] and composite['currentProfileHashesVerified']
else:assert evidence['success'] and evidence['phase']=='complete' and evidence['knownProfileAndColdDiskCaptured']
assert 'postgres' not in subprocess.check_output(['ps','-eo','comm='],text=True).splitlines()
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==evidence['scope']['instanceId']
previous=Path('/mnt/c/Users/charl/AgentopiaQA/profile-agent-live47/1792457767914');last=json.loads((previous/'latest-capture.json').read_text());before=json.loads(Path(last['file']).read_text())
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/pg_restore')[0]
def unescape(value):
    escapes={'n':'\n','r':'\r','t':'\t','b':'\b','f':'\f','v':'\v','\\':'\\'}
    return re.sub(r'\\([0-7]{1,3}|.)',lambda m:chr(int(m[1],8)) if re.fullmatch('[0-7]{1,3}',m[1]) else escapes.get(m[1],m[1]),value)
def table(name,schema='public',archive='application.dump'):
    text=subprocess.check_output([binary,'--data-only','--schema',schema,'--table',name,'--file=-',str(out/'current-database-backup'/archive)],text=True)
    match=re.search(r'^COPY '+re.escape(schema+'.'+name)+r' \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n',text,re.M|re.S);assert match,name
    names=[c.strip().strip('"') for c in match[1].split(',')]
    return [dict(zip(names,[None if c=='\\N' else unescape(c) for c in row.split('\t')])) for row in match[2].splitlines()]
users=table('users','auth','auth.dump');passwords='|'.join(u['id']+(u['encrypted_password'] or '') for u in sorted(users,key=lambda u:u['id']))
assert hashlib.md5(passwords.encode()).hexdigest()==before['core']['passwordFingerprint']
chats=table('conversation_sessions');messages=table('chat_messages_v2');requests=table('desktop_requests');native=table('desktop_codex_turns');instances=table('desktop_agent_instances');memories=table('desktop_agent_memories')
counts={'accounts':len(users),'chats':len(chats),'messages':len(messages),'requests':len(requests),'runningRequests':sum(r['status']=='running' for r in requests),'runningGoals':sum(r['status']=='running' for r in table('desktop_goals'))}
assert counts=={k:v for k,v in before['core'].items() if k!='passwordFingerprint'}
for old in before['instances']:
    saved=[r for r in requests if r['id']==old['request_id']];assert len(saved)==1 and saved[0]['status']=='completed' and saved[0]['error'] is None
    assignment=[r for r in instances if r['id']==old['id']];assert len(assignment)==1 and assignment[0]['status']=='completed'
    history=[r for r in native if r['request_id']==old['request_id']];assert len(history)==1
    assert json.loads(history[0]['state'])==old['native']['state']
for old in before['memories']:
    saved=[r for r in memories if r['id']==old['id']];assert len(saved)==1 and saved[0]['content']==old['content'] and saved[0]['source_message_id']==old['source_message_id']
homes=threads=0
for file in (out/'active-profile/codex').glob('*/*/*/state_5.sqlite'):
    with frozen_native_index(file) as connection:
        assert connection.execute('PRAGMA integrity_check').fetchone()==('ok',);threads+=connection.execute('SELECT count(*) FROM threads').fetchone()[0]
    homes+=1
assert homes==117 and threads==149
receipt={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'out':str(out),'counts':counts,'accountPasswordFingerprintPreserved':True,'completedLiveRequestsAndNativeStatesPreserved':3,'savedAgentMemoryAndCitationPreserved':True,'nativeHomes':homes,'nativeThreads':threads,'currentColdImageCaptured':composite is None,'retainedColdBaseVerified':composite is not None,'databaseServicesStarted':0,'providerRequests':0,'cleanMachineRestorationTested':False,'fullGoalComplete':False}
with (out/'offline-acceptance.json').open('x') as stream:json.dump(receipt,stream,indent=2)
print(json.dumps(receipt))
