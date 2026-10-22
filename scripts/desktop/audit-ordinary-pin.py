"""Read-only evidence for native UI pin/unpin and ordinary cold reopening."""
import glob, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse, unquote
root=Path('/mnt/d/Users/charl/software/Agentopia')
out=Path(sys.argv[1]).resolve(); phase=sys.argv[2]
assert out.parent==root/'.supabase/desktop-chat-pins' and re.fullmatch(r'ordinary-\d{13}',out.name)
assert phase in ('baseline','pinned','reopened','unpinned','final')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077); out.mkdir(parents=True,exist_ok=True); os.chdir('/home/agentopia/app')
stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True)); db=urlparse(stack['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_pin_audit')
def sql(query):
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,capture_output=True,env=env)
    if result.returncode: raise RuntimeError('Read-only pin evidence query failed')
    return json.loads(result.stdout)
chat='4d752d56-3037-4f5f-b7b6-5752add39e22'; owner='9bf808b8-96a9-441d-b63c-eb835eb784c4'
state=sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'chats',(SELECT count(*) FROM conversation_sessions),'messages',(SELECT count(*) FROM chat_messages_v2),'requests',(SELECT count(*) FROM desktop_requests),'activeRequests',(SELECT count(*) FROM desktop_requests WHERE status='running'),'activeGoals',(SELECT count(*) FROM desktop_goals WHERE status='running'),'pinned',(SELECT coalesce(session_state->>'desktop_pinned','false')='true' FROM conversation_sessions WHERE conversation_id='"+chat+"' AND user_id='"+owner+"'),'otherRows',(SELECT md5(coalesce(string_agg((to_jsonb(c)-'session_state'||jsonb_build_object('session_state',coalesce(c.session_state,'{}')-'desktop_pinned'))::text,'|' ORDER BY c.id),'')) FROM conversation_sessions c),'messageRows',(SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'|' ORDER BY m.id),'')) FROM chat_messages_v2 m),'accountPasswords',(SELECT md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'|' ORDER BY id),'')) FROM auth.users),'otherPins',(SELECT coalesce(json_object_agg(conversation_id,coalesce(session_state->>'desktop_pinned','false')),'{}') FROM conversation_sessions WHERE conversation_id<>'"+chat+"'))")
assert state['activeRequests']==state['activeGoals']==0, 'An active assignment must finish before maintenance.'
if phase=='baseline':
    assert not state['pinned'], 'Do not change a pre-existing user pin.'
else:
    baseline=json.loads((out/'baseline.json').read_text())['state']
    assert {k:v for k,v in state.items() if k!='pinned'}=={k:v for k,v in baseline.items() if k!='pinned'}, 'Unrelated records or request counts changed.'
    assert state['pinned']==(phase in ('pinned','reopened'))
record={'success':True,'at':time.time(),'phase':phase,'readOnly':True,'chat':chat,'state':state,'providerRequests':0}
(out/(phase+'.json')).write_text(json.dumps(record,indent=2))
print(json.dumps({k:record[k] for k in ('success','phase','readOnly','providerRequests')}|{k:state[k] for k in ('accounts','chats','messages','requests','pinned')}))
