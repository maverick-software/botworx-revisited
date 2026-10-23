"""Read-only preservation checks before and after the ordinary73-to74 update."""
import json
import os
import re
import sys
import uuid
from pathlib import Path

os.umask(0o077)
source = Path(sys.argv[1])
mode = sys.argv[2]
assert mode in ['before', 'after']
assert source.parent == Path('/mnt/f/Agentopia/.supabase/desktop-production-logical') and re.fullmatch(r'\d{13}', source.name)
saved = json.loads((source / 'evidence.json').read_text())
assert saved['success'] and saved['distribution'] == 'AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'
from audit_logical_snapshot71 import audit
out = source / ('maintenance74-' + mode + '-' + uuid.uuid4().hex)
out.mkdir()
try:
    result = audit(source / 'current-database-backup', out, 'a91a4800-e08f-4440-a4ec-588762d01bfd', 57322)
    assert result['tablesCompared'] == 128
    assert result['schemaMigrations'] == 72
except Exception as error:
    result = {'success': False, 'error': str(error), 'databaseReadOnly': True, 'providerRequests': 0}
result.update({'evidence': str(out / 'evidence.json'), 'mode': mode})
(out / 'evidence.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result), flush=True)
sys.exit(0 if result['success'] else 1)
