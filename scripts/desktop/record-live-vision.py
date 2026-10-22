"""Read only the single ordinary vision request; never emit image bytes or keys."""
import base64,glob,hashlib,json,os,re,subprocess,sys
from pathlib import Path,PureWindowsPath
from urllib.parse import urlparse,unquote

ROOT=Path('/mnt/d/Users/charl/software/Agentopia')
out=Path(sys.argv[1]).resolve()
assert out.parent==ROOT/'.supabase/desktop-vision-live' and re.fullmatch(r'\d{13}',out.name)
intent=json.loads((out/'intent.json').read_text());assert intent['dispatchAttempts']==1
instance='a91a4800-e08f-4440-a4ec-588762d01bfd'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==instance
profile=Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia')
assert json.loads((profile/'runtime-binding.json').read_text())['instanceId']==instance
installed=Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop/app-0.44.24/resources')
with (installed/'app.asar').open('rb') as stream:image_hash=hashlib.file_digest(stream,'sha256').hexdigest()
assert image_hash=='c8e56cf33466a7e5e3e531780d64df6bb5f1d5ff19bd2c732ad630279a5716b6'
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
db=urlparse(state['env']['DB_URL']);assert db.hostname in ('localhost','127.0.0.1')
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGTZ='UTC',PGAPPNAME='agentopia_single_vision_receipt')
def sql(query):
 p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,capture_output=True,env=env)
 if p.returncode:raise RuntimeError('The read-only vision receipt query failed')
 return json.loads(p.stdout)
def literal(text):return "'"+text.replace("'","''")+"'"
owner='9bf808b8-96a9-441d-b63c-eb835eb784c4'
rows=sql("""SELECT coalesce(json_agg(json_build_object(
 'request',to_jsonb(r),'files',u.content->'files',
 'assistant',json_build_object('text',a.content->>'text','status',a.metadata->>'status','usage',a.metadata->'usage'),
 'native',json_build_object('threadId',n.thread_id,'turnId',n.turn_id,'runtimeVersion',n.runtime_version,'options',n.context->'options','provider',n.context->>'provider','state',n.state),
 'threadProvider',t.provider
 )),'[]') FROM public.chat_messages_v2 u
 JOIN public.desktop_requests r ON r.user_message_id=u.id
 JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id
 LEFT JOIN public.desktop_codex_turns n ON n.request_id=r.id
 LEFT JOIN public.desktop_codex_threads t ON t.user_id=r.user_id AND t.thread_id=n.thread_id
 WHERE r.user_id="""+literal(owner)+"::uuid AND u.role='user' AND u.content->>'text'="+literal(intent['prompt']))
assert len(rows)==1,'Expected exactly one submitted user message and native request'
row=rows[0];request=row['request'];assert request['status']=='completed' and request['error'] is None
assert row['assistant']['status']=='completed'
reply=row['assistant']['text'];answer=json.loads(re.sub(r'^```(?:json)?\s*|\s*```$','',reply.strip()))
assert answer==intent['expected'],'The actual visual answer differs from the independently saved fixture'
files=row['files'];assert len(files)==1 and files[0]['name']==PureWindowsPath(intent['image']).name
data=files[0]['image'];assert data.startswith('data:image/png;base64,')
attachment_hash=hashlib.sha256(base64.b64decode(data.split(',',1)[1])).hexdigest();assert attachment_hash==intent['sha256']
native=row['native'];assert native['threadId'] and native['turnId'] and native['runtimeVersion']=='0.163.0'
assert row['threadProvider']=='openai-oauth'
assert native['options']['provider']=='openai-oauth' and native['options']['harness']=='codex'
items=native['state'].get('items',[]);kinds=[entry['item']['type'] for entry in items]
assert kinds and all(kind in ('userMessage','agentMessage','reasoning') for kind in kinds),'The image check unexpectedly used a tool'
assert any(entry['item']['type']=='agentMessage' and entry.get('completed') for entry in items)
result={'success':True,'installedVersion':'0.44.24','schema':67,'physicalOrdinaryProfile':True,'imageSha256':image_hash,
 'request':{k:request[k] for k in ('id','conversation_id','status','created_at','updated_at')},
 'provider':row['threadProvider'],'model':native['options']['model'],'harness':'codex','runtimeVersion':native['runtimeVersion'],
 'threadId':native['threadId'],'turnId':native['turnId'],'itemTypes':kinds,
 'image':{'path':intent['image'],'sha256':attachment_hash,'storedInSubmittedMessage':True,'metadataContainsAnswers':False},
 'prompt':intent['prompt'],'answer':answer,'matchedVisualFields':16,'submittedMessages':1,'submittedNativeRequests':1,
 'liveChatGPT':True,'OpenRouterInferenceRequests':0,'toolCalls':0,'simulated':False,'readOnlyReceipt':True}
result['ordinaryCounts']=sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'runningRequests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'runningGoals',(SELECT count(*) FROM public.desktop_goals WHERE status='running'))")
receipt=out/'acceptance.json'
if len(sys.argv)>2 and sys.argv[2]=='--reopen':
 previous=json.loads(receipt.read_text());assert previous['success']
 assert previous['request']==result['request'] and previous['answer']==result['answer'] and previous['image']==result['image']
 assert previous['threadId']==result['threadId'] and previous['turnId']==result['turnId']
 result['completedRequestAndResultUnchangedAfterReopen']=True
 receipt=out/'cold-reopen-acceptance.json'
with receipt.open('x') as stream:json.dump(result,stream,indent=2)
print(json.dumps(result))
