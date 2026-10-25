"""Read-only preservation checks before and after the ordinary74-to75 update."""
import json
import os
import re
import sys
import uuid
from pathlib import Path

os.umask(0o077)
source = Path(sys.argv[1])
mode = sys.argv[2]
target=sys.argv[3] if len(sys.argv)>3 else '0.44.75'
assert target in ['0.44.75','0.44.76']
assert mode in ['before', 'after']
assert source.parent == Path('/mnt/f/Agentopia/.supabase/desktop-production-logical') and re.fullmatch(r'\d{13}', source.name)
saved = json.loads((source / 'evidence.json').read_text())
assert saved['success'] and saved['distribution'] == 'AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'
from audit_logical_snapshot71 import audit
out = source / ('maintenance75-' + mode + '-' + uuid.uuid4().hex)
out.mkdir()
try:
    added=['desktop_preview_sessions','desktop_preview_requests','desktop_preview_codex_threads','desktop_preview_codex_turns','desktop_preview_tool_calls','desktop_creation_tool_scopes','desktop_creation_retirements','desktop_creation_authorizations','desktop_creation_connection_handoffs'] if target=='0.44.76' and mode=='after' else []
    result = audit(source / 'current-database-backup', out, 'a91a4800-e08f-4440-a4ec-588762d01bfd', 57322,added)
    assert result['tablesCompared'] == 128
    assert result['schemaMigrations'] == ((73 if mode=='before' else 82) if target=='0.44.76' else (72 if mode == 'before' else 73))
except Exception as error:
    result = {'success': False, 'error': str(error), 'databaseReadOnly': True, 'providerRequests': 0}
result.update({'evidence': str(out / 'evidence.json'), 'mode': mode})
(out / 'evidence.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result), flush=True)
sys.exit(0 if result['success'] else 1)
