"""Read-only schema71+ production audit; earlier release auditors stay immutable."""
import json
import os
import re
import sys
from pathlib import Path
from audit_logical_snapshot71 import audit

os.umask(0o077)
source = Path(sys.argv[1])
assert source.parent == Path('/mnt/f/Agentopia/.supabase/desktop-production-logical') and re.fullmatch(r'\d{13}', source.name)
evidence = json.loads((source / 'evidence.json').read_text())
assert evidence['success'] and evidence['distribution'] == 'AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd'
out = source / 'schema71-streaming-audit'
out.mkdir()
try:
    result = audit(source / 'current-database-backup', out, 'a91a4800-e08f-4440-a4ec-588762d01bfd', 57322)
except Exception as error:
    result = {'success': False, 'error': str(error), 'databaseReadOnly': True, 'providerRequests': 0}
(out / 'evidence.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result), flush=True)
sys.exit(0 if result['success'] else 1)
