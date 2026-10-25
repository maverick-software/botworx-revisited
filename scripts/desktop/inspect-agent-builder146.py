"""Read only the accepted generated builder's execution metadata."""
import glob, json, os, subprocess, sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from uuid import UUID

out = Path(sys.argv[1])
evidence = json.loads((out / 'evidence.json').read_text())
owner = str(UUID(evidence['owner']))
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'b521a8fe-d803-4031-af23-4bb51f4e1e56'
os.chdir('/home/agentopia/app')
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
db = urlparse(state['env']['DB_URL'])
assert db.port == 60750
binary = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on', PGAPPNAME='builder146_readonly')
query = "SELECT jsonb_build_object('requests',(SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'error',error,'created',created_at,'updated',updated_at)) FROM public.desktop_preview_requests WHERE user_id='" + owner + "'),'nativeTurns',(SELECT jsonb_agg(jsonb_build_object('request',request_id,'thread',state->>'threadId','turn',state->>'turnId','items',jsonb_array_length(state->'items'),'lastType',state->'items'->-1->'item'->>'type')) FROM public.desktop_preview_codex_turns WHERE user_id='" + owner + "'));"
result = subprocess.run([binary, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres'], input='BEGIN READ ONLY;\n'+query+'\nCOMMIT;\n', env=env, text=True, capture_output=True)
if result.returncode:
    (out / 'private-inspection-error.txt').write_text(result.stderr)
    raise RuntimeError('The read-only builder metadata query failed.')
metadata = json.loads(result.stdout)
(out / 'execution-inspection.json').write_text(json.dumps(metadata, indent=2))
print(json.dumps(metadata))
