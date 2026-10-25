"""Read the two generated installed-app requests; never dispatch or recover work."""
from pathlib import Path
import datetime, glob, json, os, re, subprocess, sys
from urllib.parse import urlparse, unquote

out = Path(sys.argv[1])
assert out.parent == Path('/mnt/f/Agentopia/.supabase/desktop-computer-retry102')
assert re.fullmatch(r'\d{13}', out.name) and out.is_dir() and out.resolve() == out
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077)
os.chdir('/home/agentopia/app')
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
db = urlparse(state['env']['DB_URL'])
assert db.port == 57322
binary = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on', PGAPPNAME='agentopia_computer_retry102_readonly')
query = """
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'conversationId',r.conversation_id,'status',r.status,'error',r.error,
 'instance',(SELECT jsonb_build_object('id',i.id,'status',i.status,'owned',i.user_id=r.user_id AND i.agent_id=r.agent_id AND i.conversation_id=r.conversation_id) FROM public.desktop_agent_instances i WHERE i.id=r.agent_instance_id),
 'createdAt',r.created_at,'updatedAt',r.updated_at,'options',u.metadata->'options',
 'prompt',u.content->>'text','reply',a.content->>'text',
 'nativeVersion',a.metadata#>>'{native,version}',
 'tools',(SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id',t.id,'name',t.name,'status',t.status,'error',t.error,
   'sent',t.result->'sent','snapshot',t.result->>'snapshot_id',
   'observationSnapshot',t.result#>>'{observation,snapshot_id}',
   'observationError',t.result->>'observation_error',
   'createdAt',t.created_at,'updatedAt',t.updated_at
 ) ORDER BY t.created_at),'[]') FROM public.desktop_tool_calls t WHERE t.request_id=r.id)
) ORDER BY r.created_at),'[]')
FROM public.desktop_requests r
JOIN public.chat_messages_v2 u ON u.id=r.user_message_id
JOIN public.chat_messages_v2 a ON a.id=r.assistant_message_id
WHERE u.content->>'text' LIKE 'CU102% fresh %installed Computer Use check.%';
"""
result = subprocess.run([binary, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres'], input='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+query+'\nCOMMIT;\n', env=env, text=True, capture_output=True)
if result.returncode:
    (out/'private-query-error.txt').write_text(result.stderr)
    raise RuntimeError('Read-only request inspection failed; private diagnostic retained')
rows = json.loads(result.stdout)
receipt = {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'requests':rows}
(out/'provider-evidence.json').write_text(json.dumps(receipt, ensure_ascii=True, indent=2))
print(json.dumps({'readOnly':True,'requests':[{'id':r['id'],'status':r['status'],'provider':r['options'].get('provider'),'model':r['options'].get('model'),'nativeVersion':r['nativeVersion'],'tools':[{k:t[k] for k in ['name','status','sent','error']} for t in r['tools']]} for r in rows]}))
