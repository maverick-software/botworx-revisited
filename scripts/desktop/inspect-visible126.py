"""Read-only diagnosis of the user's reported computer-use conversation."""
from pathlib import Path
import datetime,glob,json,os,re,subprocess,sys
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-visible126') and re.fullmatch(r'\d{13}',out.name)
assert out.is_dir() and out.resolve()==out
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077);os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(state['env']['DB_URL']);assert db.port==57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_visible126_readonly')
query="""WITH chosen AS (SELECT conversation_id,title FROM conversation_sessions WHERE title ILIKE '%control%computer%' ORDER BY last_active DESC LIMIT 3)
SELECT jsonb_build_object('at',now(),'chats',(SELECT jsonb_agg(to_jsonb(c)) FROM chosen c),'requests',(SELECT jsonb_agg(to_jsonb(r)) FROM desktop_requests r JOIN chosen c USING(conversation_id)),'turns',(SELECT jsonb_agg(to_jsonb(t)) FROM desktop_codex_turns t JOIN desktop_requests r ON t.request_id=r.id JOIN chosen c ON c.conversation_id=r.conversation_id),'tools',(SELECT jsonb_agg(to_jsonb(t)) FROM desktop_tool_calls t JOIN chosen c ON c.conversation_id=t.conversation_id),'runningRequests',(SELECT count(*) FROM desktop_requests WHERE status='running'));"""
r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n',env=env,text=True,capture_output=True)
if r.returncode:(out/'private-error.txt').write_text(r.stderr);raise RuntimeError('Read-only query failed; diagnostic retained')
data=json.loads(r.stdout);(out/'private-records.json').write_text(json.dumps(data,indent=2))
summary={'success':True,'at':data['at'],'chats':data['chats'],'runningRequests':data['runningRequests'],'requests':[{'id':r['id'],'status':r['status'],'options':r.get('options'),'input':str(r.get('input',''))[:300]} for r in data.get('requests') or []],'tools':[{'request':t['request_id'],'name':t['name'],'status':t['status']} for t in data.get('tools') or []],'native':[]}
for t in data.get('turns') or []:
    state=t.get('state') or {};items=[]
    for entry in state.get('items',[]):
        item=entry.get('item') or {};kind=item.get('type');value=item.get('input',item.get('command',item.get('arguments',item.get('text',''))))
        items.append({'type':kind,'name':item.get('name'),'phase':item.get('phase'),'value':str(value)[:2500]})
    summary['native'].append({'request':t['request_id'],'items':items})
(out/'diagnosis.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='native'}))
