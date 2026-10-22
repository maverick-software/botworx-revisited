"""Inspect the single UI-submitted live workflow; never enqueue or replay work."""
from pathlib import Path
import datetime,glob,hashlib,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote
root=Path('/mnt/d/Users/charl/software/Agentopia');pointer=json.loads((root/'.supabase/desktop-profile-location/ordinary-agent-live47-current.json').read_text());out=Path(pointer['out'].replace('C:\\','/mnt/c/').replace('\\','/'));intent=json.loads((out/'intent.json').read_text());marker=intent['marker'];mode=sys.argv[1]
assert mode in ('baseline','capture') and re.fullmatch('PROFILE47-[a-f0-9]{12}',marker) and out.parent==Path('/mnt/c/Users/charl/AgentopiaQA/profile-agent-live47')
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL']);binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_profile_agent_live47_audit')
def sql(query):
 p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',env=env,text=True,capture_output=True)
 if p.returncode:raise RuntimeError('Read-only live-agent inspection failed: '+p.stderr[:500])
 return json.loads(p.stdout)
owner=sql("SELECT to_json(id) FROM auth.users WHERE email='admin@agentopia.local'");assert re.fullmatch('[a-f0-9-]{36}',owner)
core=sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'chats',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'requests',(SELECT count(*) FROM public.desktop_requests),'passwordFingerprint',(SELECT md5(string_agg(id::text||coalesce(encrypted_password,''),'|' ORDER BY id)) FROM auth.users),'runningRequests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'runningGoals',(SELECT count(*) FROM public.desktop_goals WHERE status='running'))")
agents=sql("SELECT coalesce(json_agg(json_build_object('id',a.id,'name',a.name,'definitionSha256',md5(to_jsonb(a)::text),'handle',p.handle,'revision',p.revision,'policy',p.policy,'neutralProfile',p.role='' AND p.sops='' AND p.guardrails='' AND p.skills='[]'::jsonb,'profileSha256',md5((to_jsonb(p)-'memory_revision'-'updated_at')::text)) ORDER BY a.id),'[]') FROM public.agents a LEFT JOIN public.desktop_agent_profiles p ON p.agent_id=a.id WHERE a.user_id='"+owner+"'")
parents=sql("SELECT coalesce(json_agg(to_jsonb(r)||jsonb_build_object('userContent',u.content,'reply',a.content,'native',to_jsonb(n)) ORDER BY r.created_at),'[]') FROM public.desktop_requests r JOIN public.chat_messages_v2 u ON u.id=r.user_message_id JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id LEFT JOIN public.desktop_codex_turns n ON n.request_id=r.id WHERE r.user_id='"+owner+"' AND u.content->>'text' LIKE '"+marker+"%'")
assert len(parents)<=1,'Inspect the saved request; do not replay this verification'
record={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'marker':marker,'owner':owner,'core':core,'agents':agents,'parents':parents,'instances':[],'tools':[],'memories':[],'conversationMessages':[]}
if mode=='baseline':
 assert not parents and core['runningRequests']==core['runningGoals']==0
 file=out/'baseline.json';assert not file.exists()
else:
 baseline=json.loads((out/'baseline.json').read_text());assert core['accounts']==baseline['core']['accounts'] and core['passwordFingerprint']==baseline['core']['passwordFingerprint'];assert len(agents)==len(baseline['agents'])
 for old,current in zip(baseline['agents'],agents):
  for key in ('id','name','definitionSha256'):assert current[key]==old[key],'An existing agent definition changed'
  if old['revision'] is not None:
   for key in ('handle','revision','policy','profileSha256'):assert current[key]==old[key],'An existing saved agent profile changed'
  elif current['revision'] is not None:
   assert current['revision']==1 and current['neutralProfile'] and current['handle']=='agent-'+current['id'].replace('-','') and current['policy']=={'tools':None,'delegation':True,'delegateAgents':None,'memory':True,'memoryWrite':True,'maxDepth':2,'maxTurns':10},'First-use profile materialization differs from defaults'
 if parents:
  parent=parents[0];instance=parent.get('agent_instance_id');assert re.fullmatch('[a-f0-9-]{36}',instance or '')
  record['instances']=sql("SELECT coalesce(json_agg(to_jsonb(i)||jsonb_build_object('request',to_jsonb(r),'native',to_jsonb(n),'reply',a.content) ORDER BY i.depth,i.created_at),'[]') FROM public.desktop_agent_instances i LEFT JOIN public.desktop_requests r ON r.id=i.request_id LEFT JOIN public.desktop_codex_turns n ON n.request_id=r.id LEFT JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id WHERE i.user_id='"+owner+"' AND (i.id='"+instance+"' OR i.parent_instance_id='"+instance+"')")
  ids=[row['request_id'] for row in record['instances'] if row.get('request_id')];assert all(re.fullmatch('[a-f0-9-]{36}',value) for value in ids)
  if ids:record['tools']=sql("SELECT coalesce(json_agg(to_jsonb(t) ORDER BY t.created_at),'[]') FROM public.desktop_tool_calls t WHERE t.request_id IN ("+','.join("'"+value+"'" for value in ids)+")")
  record['conversationMessages']=sql("SELECT coalesce(json_agg(json_build_object('id',id,'role',role,'content',content,'metadata',metadata) ORDER BY created_at),'[]') FROM public.chat_messages_v2 WHERE conversation_id='"+parent['conversation_id']+"'")
 record['memories']=sql("SELECT coalesce(json_agg(to_jsonb(m)),'[]') FROM public.desktop_agent_memories m WHERE user_id='"+owner+"' AND title='"+marker+"'")
 file=out/('capture-'+str(__import__('time').time_ns()//1000000)+'.json')
with file.open('x') as f:json.dump(record,f,indent=2)
if mode=='capture':(out/'latest-capture.json').write_text(json.dumps({'file':str(file)}))
print(json.dumps({'readOnly':True,'core':{k:v for k,v in core.items() if k!='passwordFingerprint'},'agents':agents,'parents':[{'id':p['id'],'status':p['status'],'error':p['error'],'reply':str(p['reply'])[:1800]} for p in parents],'instances':[{'id':i['id'],'agentId':i['agent_id'],'status':i['status'],'depth':i['depth'],'requestId':i['request_id']} for i in record['instances']],'tools':[{'name':t['name'],'status':t['status'],'error':t['error']} for t in record['tools']],'memories':len(record['memories']),'out':str(out)}))
