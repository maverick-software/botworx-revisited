"""Observe the one live native-child test; never starts or replays model work."""
import glob, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlparse, unquote
root=Path('/mnt/d/Users/charl/software/Agentopia'); out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-native-independent' and re.fullmatch(r'ordinary-\d{13}',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
intent=json.loads((out/'intent.json').read_text()); marker=intent['marker']; assert re.fullmatch(r'NATIVE31-\d{13}',marker)
os.umask(0o077); os.chdir('/home/agentopia/app')
stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True)); db=urlparse(stack['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_independent_live_audit')
def sql(query):
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,capture_output=True,env=env)
    if result.returncode: raise RuntimeError('Read-only native-child evidence query failed')
    return json.loads(result.stdout)
core=sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM conversation_sessions),'messages',(SELECT count(*) FROM chat_messages_v2),'requests',(SELECT count(*) FROM desktop_requests),'passwordFingerprint',(SELECT md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'|' ORDER BY id),'')) FROM auth.users),'activeRequests',(SELECT count(*) FROM desktop_requests WHERE status='running'),'activeGoals',(SELECT count(*) FROM desktop_goals WHERE status='running'))")
requests=sql("SELECT coalesce(json_agg(json_build_object('id',r.id,'conversationId',r.conversation_id,'status',r.status,'error',r.error,'createdAt',r.created_at,'updatedAt',r.updated_at,'reply',a.content->>'text','provider',n.context->>'provider','options',n.context->'options','runtimeVersion',n.runtime_version,'state',n.state) ORDER BY r.created_at),'[]') FROM desktop_requests r JOIN chat_messages_v2 u ON u.id=r.user_message_id JOIN chat_messages_v2 a ON a.id=r.assistant_message_id LEFT JOIN desktop_codex_turns n ON n.request_id=r.id WHERE r.user_id='9bf808b8-96a9-441d-b63c-eb835eb784c4' AND u.content->>'text' LIKE '"+marker+"%'")
assert len(requests)<=1,'Do not replay the recorded ordinary request.'
if len(sys.argv)>2 and sys.argv[2]=='baseline':
    assert not requests and core['activeRequests']==0 and not (out/'baseline.json').exists()
    state=sql("SELECT json_build_object('chats',(SELECT count(*) FROM conversation_sessions),'messages',(SELECT count(*) FROM chat_messages_v2),'requests',(SELECT count(*) FROM desktop_requests),'activeGoals',(SELECT count(*) FROM desktop_goals WHERE status='running'),'otherRows',(SELECT md5(coalesce(string_agg((to_jsonb(c)-'session_state'||jsonb_build_object('session_state',coalesce(c.session_state,'{}')-'desktop_pinned'))::text,'|' ORDER BY c.id),'')) FROM conversation_sessions c),'messageRows',(SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'|' ORDER BY m.id),'')) FROM chat_messages_v2 m))")
    assert state['activeGoals']==0
    state['accountPasswords']=core['passwordFingerprint']
    (out/'baseline.json').write_text(json.dumps({'state':state,'readOnly':True,'at':time.time()},indent=2))
    print(json.dumps({'baselineCreated':True,'chats':state['chats'],'messages':state['messages'],'requests':state['requests']}))
    sys.exit(0)
preserved=None
if requests:
    row=requests[0]; request=row['id']; conversation=row['conversationId']
    assert re.fullmatch(r'[0-9a-f-]{36}',request) and re.fullmatch(r'[0-9a-f-]{36}',conversation)
    baseline_path=out/'baseline.json'
    if not baseline_path.exists(): baseline_path=root/'.supabase/desktop-chat-pins/ordinary-1792389600000/baseline.json'
    baseline=json.loads(baseline_path.read_text())['state']
    old=sql("SELECT json_build_object('messages',(SELECT count(*) FROM chat_messages_v2 WHERE id NOT IN (SELECT user_message_id FROM desktop_requests WHERE id='"+request+"' UNION SELECT assistant_message_id FROM desktop_requests WHERE id='"+request+"')),'messageRows',(SELECT md5(coalesce(string_agg(to_jsonb(m)::text,'|' ORDER BY m.id),'')) FROM chat_messages_v2 m WHERE id NOT IN (SELECT user_message_id FROM desktop_requests WHERE id='"+request+"' UNION SELECT assistant_message_id FROM desktop_requests WHERE id='"+request+"')),'chats',(SELECT count(*) FROM conversation_sessions WHERE conversation_id<>'"+conversation+"'),'otherRows',(SELECT md5(coalesce(string_agg((to_jsonb(c)-'session_state'||jsonb_build_object('session_state',coalesce(c.session_state,'{}')-'desktop_pinned'))::text,'|' ORDER BY c.id),'')) FROM conversation_sessions c WHERE conversation_id<>'"+conversation+"'))")
    assert old['messages']==baseline['messages'] and old['messageRows']==baseline['messageRows']
    assert old['chats']==baseline['chats'] and old['otherRows']==baseline['otherRows']
    assert core['passwordFingerprint']==baseline['accountPasswords']
    preserved={'accountsAndPasswords':True,'originalChats':old['chats'],'originalMessages':old['messages'],'originalConversationAndMessageRowsMatched':True,'addedChats':core['conversations']-old['chats'],'addedMessages':core['messages']-old['messages'],'addedRequests':core['requests']-baseline['requests']}
record={'at':time.time(),'readOnly':True,'core':core,'marker':marker,'requests':requests,'preservedOriginal':preserved}
name='capture-'+str(int(time.time()*1000))+'.json'; (out/name).write_text(json.dumps(record,indent=2)); (out/'latest-capture.json').write_text(json.dumps({'file':name}))
summaries=[]
for row in requests:
    state=row.get('state') or {}
    summaries.append({k:row[k] for k in ('id','conversationId','status','error','provider','runtimeVersion')}|{'reply':(row.get('reply') or '')[:500],'children':[{k:c.get(k) for k in ('threadId','name','status','delivery','error','turnId')} for c in state.get('children',[])],'reports':[{k:r.get(k) for k in ('id','status','error')} for r in state.get('reports',[])],'items':[(i.get('item') or {}).get('type') for i in state.get('items',[])]})
print(json.dumps({'readOnly':True,'core':{k:v for k,v in core.items() if k!='passwordFingerprint'},'requests':summaries,'capture':name,'preservedOriginal':preserved}))
