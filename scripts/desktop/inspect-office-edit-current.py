"""Read-only inspection of the single UI-submitted Office edit request."""
from pathlib import Path
import datetime, glob, json, os, re, subprocess
from urllib.parse import urlparse, unquote

root=Path('/mnt/d/Users/charl/software/Agentopia')
pointer=json.loads((root/'.supabase/desktop-chat-details/office-edit-current.json').read_text())
value=pointer['out'];out=Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
assert out.parent==Path('/mnt/d/Users/charl/AgentopiaQA/office-edit-live')
intent = json.loads((out / 'intent.json').read_text())
marker = intent['marker']
assert re.fullmatch(r'OFFICE-\d{13}', marker)
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077)
os.chdir('/home/agentopia/app')
stack = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
db = urlparse(stack['env']['DB_URL'])
binary = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on', PGAPPNAME='agentopia_office_edit_live_audit')

def sql(query):
    p = subprocess.run([binary, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres'], input=query + '\n', env=env, text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError('Read-only Office inspection failed: ' + p.stderr[:500])
    return json.loads(p.stdout)

parents = sql("SELECT coalesce(json_agg(to_jsonb(r)||jsonb_build_object('reply',a.content,'native',to_jsonb(n)) ORDER BY r.created_at),'[]') FROM public.desktop_requests r JOIN public.chat_messages_v2 u ON u.id=r.user_message_id JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id LEFT JOIN public.desktop_codex_turns n ON n.request_id=r.id WHERE u.content->>'text' LIKE 'QA " + marker + "%'")
assert len(parents) <= 1, 'Multiple requests found; never replay this test'
tools = []
if parents:
    request_id = parents[0]['id']
    assert re.fullmatch('[a-f0-9-]{36}', request_id)
    tools = sql("SELECT coalesce(json_agg(json_build_object('id',id,'name',name,'status',status,'error',error) ORDER BY created_at),'[]') FROM public.desktop_tool_calls WHERE request_id='" + request_id + "'")
core = sql("SELECT json_build_object('accounts',(SELECT count(*) FROM auth.users),'chats',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'requests',(SELECT count(*) FROM public.desktop_requests),'runningRequests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'))")
record = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'readOnly': True, 'marker': marker, 'core': core, 'parents': parents, 'tools': tools}
file = out / ('capture-' + str(__import__('time').time_ns() // 1000000) + '.json')
with file.open('x') as f:
    json.dump(record, f, indent=2)
(out / 'latest-capture.json').write_text(json.dumps({'file': str(file)}))
print(json.dumps({'at': record['at'], 'core': core, 'requests': [{'id': p['id'], 'conversationId': p['conversation_id'], 'status': p['status'], 'error': p['error'], 'reply': p['reply']} for p in parents], 'tools': tools, 'nativeCommands': [{'id':row['item'].get('id'),'type':row['item']['type'],'completed':row['completed'],'status':row['item'].get('status')} for p in parents for row in (p.get('native') or {}).get('state',{}).get('items',[]) if row['item']['type']!='userMessage'], 'capture': str(file)}))
