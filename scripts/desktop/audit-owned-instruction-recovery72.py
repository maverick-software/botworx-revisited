"""Read-only comparison of a restored schema72 runtime with its complete backup."""
import json
import os
import sys
import uuid
from pathlib import Path
from audit_logical_snapshot71 import audit

os.umask(0o077)
out, intent, bundle = map(Path, sys.argv[1:4])
cfg = json.loads(intent.read_text())
instance = str(uuid.UUID(cfg['instance']))
assert cfg['role'] == 'restored'
assert cfg['distribution'] == 'AgentopiaRuntime-' + instance
assert instance != 'a91a4800-e08f-4440-a4ec-588762d01bfd'
assert intent.is_relative_to('/mnt/f/Agentopia/.supabase/desktop-instruction-apps72-real')
assert out.is_relative_to(intent.parent) and out.name == 'complete-database-audit'
assert bundle.is_relative_to('/mnt/f/Agentopia-Acceptance')
descriptor = json.loads((bundle / 'desktop-recovery.json').read_text())
assert descriptor['requiresDesktopRecoveryFormat'] == 12
assert 59000 <= cfg['portBase'] <= 61499
out.mkdir()
try:
    result = audit(bundle / 'current-database-backup', out, instance, cfg['portBase'] + 2)
    tables = json.loads((out / 'archive-table-fingerprints.json').read_text())
    assert result['schemaMigrations'] == 72 and result['tablesCompared'] == 128
    assert tables['public.agent_mcp_connections']['rows'] == 3
    assert tables['public.agents']['rows'] == 2
    assert tables['public.desktop_requests']['rows'] == 5
    assert result['accounts'] == 2 and result['encryptionRootBindingsVerified'] == 4
    result.update({'savedConnectionsCompared': 3, 'savedRequestsCompared': 5,
                   'completeSnapshotComparedBeforeContinuation': True})
except Exception as error:
    result = {'success': False, 'error': str(error), 'databaseReadOnly': True, 'providerRequests': 0}
(out / 'evidence.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result), flush=True)
sys.exit(0 if result['success'] else 1)
