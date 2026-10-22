"""Read exact saved browser receipts, with no browser or provider side effects."""
import glob,json,os,re,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse,unquote
root=Path('/mnt/d/Users/charl/software/Agentopia');out=Path(sys.argv[1]).resolve()
assert out.parent==root/'.supabase/desktop-preview-investigation' and re.fullmatch(r'browser-\d{13}',out.name)
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);out.mkdir();os.chdir('/home/agentopia/app')
stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL'])
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_saved_browser_inspection')
def sql(query):
 p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query+'\n',text=True,capture_output=True,env=env)
 if p.returncode:raise RuntimeError('Exact read-only browser receipt query failed')
 return json.loads(p.stdout)
scope="user_id='9bf808b8-96a9-441d-b63c-eb835eb784c4' AND conversation_id='4d752d56-3037-4f5f-b7b6-5752add39e22' AND request_id='c3bd534e-d54b-4545-b274-ebfcd062a0ad'"
rows=sql("SELECT coalesce(json_agg(t),'[]') FROM (SELECT id,native_thread_id,request_id,name,label,status,arguments,approval,result,error,created_at,updated_at FROM public.desktop_tool_calls WHERE "+scope+" AND name LIKE 'browser_%' ORDER BY created_at) t")
state=sql("SELECT n.state FROM public.desktop_codex_turns n JOIN public.desktop_requests r ON r.id=n.request_id WHERE r.id='c3bd534e-d54b-4545-b274-ebfcd062a0ad' AND r.user_id='9bf808b8-96a9-441d-b63c-eb835eb784c4' AND r.conversation_id='4d752d56-3037-4f5f-b7b6-5752add39e22'")
items=[]
for row in rows:
 result=row.pop('result') or {};row['resultKeys']=list(result) if isinstance(result,dict) else []
 if isinstance(result,dict):row['resultFacts']={key:result[key] for key in ('tab_id','url','title','error','denied','closed','status') if key in result}
for entry in state.get('items',[]):
 item=entry.get('item',{})
 if item.get('type')=='mcpToolCall' and str(item.get('tool','')).startswith('browser_'):
  items.append({'threadId':entry.get('threadId'),'turnId':entry.get('turnId'),'completed':entry.get('completed'),**{key:item[key] for key in ('id','tool','server','status','arguments','error','durationMs') if key in item},'resultKeys':list(item.get('result') or {})})
record={'readOnly':True,'productionModified':False,'providerRequests':0,'requestId':'c3bd534e-d54b-4545-b274-ebfcd062a0ad','toolReceipts':rows,'nativeCalls':items}
(out/'evidence.json').write_text(json.dumps(record,indent=2));print(json.dumps(record))
