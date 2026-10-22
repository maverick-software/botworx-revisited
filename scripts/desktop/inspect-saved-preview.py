"""Read saved preview execution facts; do not run or regenerate the model work."""
import glob,json,os,re,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
ROOT=Path('/mnt/d/Users/charl/software/Agentopia');out=Path(sys.argv[1]).resolve()
assert out.parent==ROOT/'.supabase/desktop-preview-investigation' and re.fullmatch(r'\d{13}',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_saved_preview_investigation')
query="""SELECT coalesce(json_agg(json_build_object('requestId',r.id,'status',r.status,'createdAt',r.created_at,'updatedAt',r.updated_at,'prompt',u.content->>'text','reply',a.content->>'text','options',n.context->'options','nativeState',n.state,'tools',a.metadata->'tools') ORDER BY r.created_at),'[]') FROM public.desktop_requests r JOIN public.chat_messages_v2 u ON u.id=r.user_message_id JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id LEFT JOIN public.desktop_codex_turns n ON n.request_id=r.id WHERE r.user_id='9bf808b8-96a9-441d-b63c-eb835eb784c4' AND r.conversation_id='4d752d56-3037-4f5f-b7b6-5752add39e22'"""
p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,capture_output=True,env=env)
if p.returncode:raise RuntimeError('Read-only preview inspection query failed')
rows=json.loads(p.stdout);result=[]
def safe(text):
 text=re.sub(r'(?:sk-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]{30,}|[A-Za-z0-9+/=_-]{120,})','[long value omitted]',str(text))
 return text[:2500]
for row in rows:
 reply=row['reply'] or '';focus=bool(re.search(r'landscap|preview|website|4176',row['prompt']+' '+reply,re.I))
 value={k:row[k] for k in ('requestId','status','createdAt','updatedAt','prompt')};value['reply']=safe(reply) if focus else reply[:120]
 options=row['options'] or {};value['options']={k:options.get(k) for k in ('harness','provider','model','permission','mode','files')}
 items=(row['nativeState'] or {}).get('items',[]);value['nativeItemTypes']=[x.get('item',{}).get('type') for x in items];value['nativeServerEvidence']=[]
 if focus:
  for entry in items:
   item=entry.get('item',{});payload=json.dumps(item)
   if re.search(r'4176|http.server|Start-Process|listen\(|createServer|server\.m?js|slonski',payload,re.I):
    details={k:safe(item[k]) for k in ('command','cwd','status','processId','exitCode') if k in item}
    for k in ('aggregatedOutput','output','arguments','input'):
     if k in item:
      lines=[line for line in str(item[k]).splitlines() if re.search(r'4176|http.server|Start-Process|listen\(|createServer|server\.m?js|slonski|session ID|Process exited',line,re.I)]
      if lines:details[k]=[safe(line) for line in lines[:8]]
    value['nativeServerEvidence'].append({'type':item.get('type'),'keys':list(item),'completed':entry.get('completed'),'details':details})
  value['toolSummaries']=[{'name':t.get('name'),'status':t.get('status'),'argumentKeys':list((t.get('arguments') or {})),'error':safe(t.get('error',''))} for t in row['tools'] or []]
 result.append(value)
record={'readOnly':True,'conversation':'4d752d56-3037-4f5f-b7b6-5752add39e22','requests':result}
with (out/'saved-preview-facts.json').open('x') as stream:json.dump(record,stream,indent=2)
print(json.dumps(record))
