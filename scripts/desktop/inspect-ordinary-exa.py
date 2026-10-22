"""Read-only audit of the one ordinary, UI-driven Exa search verification."""
import glob,json,os,re,subprocess,sys,time
from pathlib import Path
from urllib.parse import urlparse,unquote
root=Path('/mnt/d/Users/charl/software/Agentopia');out=Path(sys.argv[1]).resolve();mode=sys.argv[2]
assert out.parent==root/'.supabase/desktop-native-search' and re.fullmatch(r'ordinary-\d{13}',out.name)
assert mode in ('baseline','capture') and Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_ordinary_exa_verification')
def sql(query):
 p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,capture_output=True,env=env)
 if p.returncode:raise RuntimeError('Read-only Exa verification query failed')
 return json.loads(p.stdout)
owner='9bf808b8-96a9-441d-b63c-eb835eb784c4'
core=sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'passwordFingerprint',(SELECT md5(coalesce(string_agg(id::text||coalesce(encrypted_password,''),'|' ORDER BY id),'')) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2))")
plugin=sql("SELECT json_agg(json_build_object('name',p.name,'version',p.package->'manifest'->>'version','digest',p.digest,'enabled',p.enabled,'agent',a.name,'agentId',a.id,'assigned',g.enabled,'connectionId',c.connection_id,'serverName',c.server_name,'endpoint',p.package->'mcp'->'mcpServers'->'exa'->>'url')) FROM public.desktop_plugins p JOIN public.desktop_agent_plugins g ON g.user_id=p.user_id AND g.plugin_name=p.name JOIN public.agents a ON a.id=g.agent_id JOIN public.desktop_plugin_connections c ON c.user_id=p.user_id AND c.plugin_name=p.name AND c.agent_id=a.id WHERE p.user_id='"+owner+"' AND p.name='exa-web-search'")
assert len(plugin or [])==1 and plugin[0]['agent']=='Native Codex Assistant' and plugin[0]['enabled'] and plugin[0]['assigned']
assert plugin[0]['digest']=='525a2e8bfc0fd31e67d99c44c05ac76583b0fbf48acf8d565f822b020f69feb2' and plugin[0]['endpoint']=='https://mcp.exa.ai/mcp'
intent=json.loads((out/'intent.json').read_text());marker=intent['marker'];assert re.fullmatch(r'EXA-AGENT-[a-f0-9]{12}',marker)
record={'at':time.time(),'readOnly':True,'core':core,'plugin':plugin,'marker':marker}
record['activeWork']=sql("SELECT json_build_object('requests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'goals',(SELECT count(*) FROM public.desktop_goals WHERE status='running'))")
if mode=='baseline':
 assert not (out/'baseline.json').exists();(out/'baseline.json').write_text(json.dumps(record,indent=2))
else:
 baseline=json.loads((out/'baseline.json').read_text());assert core['accounts']==baseline['core']['accounts'] and core['passwordFingerprint']==baseline['core']['passwordFingerprint']
 query="SELECT coalesce(json_agg(json_build_object('id',r.id,'conversationId',r.conversation_id,'agentId',r.agent_id,'status',r.status,'error',r.error,'createdAt',r.created_at,'updatedAt',r.updated_at,'options',n.context->'options','provider',n.context->>'provider','runtimeVersion',n.runtime_version,'state',n.state,'reply',a.content->>'text','userContent',u.content) ORDER BY r.created_at),'[]') FROM public.desktop_requests r JOIN public.chat_messages_v2 u ON u.id=r.user_message_id JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id LEFT JOIN public.desktop_codex_turns n ON n.request_id=r.id WHERE r.user_id='"+owner+"' AND u.content->>'text' LIKE '"+marker+"%'"
 record['requests']=sql(query);assert len(record['requests'])<=1,'Do not replay the recorded ordinary request'
 if record['requests']:
  request=record['requests'][0]
  record['tools']=sql("SELECT coalesce(json_agg(json_build_object('id',id,'requestId',request_id,'conversation_id',conversation_id,'assistant_message_id',assistant_message_id,'label',label,'name',name,'status',status,'arguments',arguments,'approval',approval,'result',result,'error',error,'nativeThreadId',native_thread_id,'createdAt',created_at) ORDER BY created_at),'[]') FROM public.desktop_tool_calls WHERE user_id='"+owner+"' AND request_id='"+request['id']+"'")
 name='capture-'+str(int(time.time()*1000))+'.json';(out/name).write_text(json.dumps(record,indent=2));(out/'latest-capture.json').write_text(json.dumps({'file':name}))
print(json.dumps({'readOnly':True,'core':{k:v for k,v in core.items() if k!='passwordFingerprint'},'activeWork':record['activeWork'],'plugin':plugin,'requests':[{'id':r['id'],'status':r['status'],'error':r['error'],'provider':r['provider'],'reply':r['reply'][:2000]} for r in record.get('requests',[])],'toolStatuses':[{'name':t['name'],'status':t['status'],'error':t['error']} for t in record.get('tools',[])]}))
