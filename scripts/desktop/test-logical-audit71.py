"""Read an owned restored QA database containing retained document originals."""
import json
import os
import subprocess
import sys
from pathlib import Path
from audit_logical_snapshot71 import audit

os.umask(0o077)
out, intent = map(Path, sys.argv[1:3])
cfg = json.loads(intent.read_text())
assert out.parent == Path('/mnt/f/Agentopia/.supabase/desktop-logical-audit71')
assert cfg['role'] == 'restored' and cfg['instance'] == '7d87fd24-b2da-41ea-81a9-e9a764327845'
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == cfg['instance']
assert cfg['portBase'] + 2 != 57322
os.chdir('/home/agentopia/app')
e = {'success': False, 'productionAccess': False, 'providerRequests': 0, 'databaseWrites': 0}
try:
    started = subprocess.run(['supabase', 'start', '--runtime', 'native', '--eager', '--exclude', 'analytics,pooler,studio'], capture_output=True, text=True, timeout=300)
    (out / 'private-start.log').write_text(started.stdout + '\n' + started.stderr)
    assert started.returncode == 0
    archive = out / 'qa-database-backup'
    backup = subprocess.run(['python3', '/opt/agentopia/manage.py', 'backup', str(archive)], capture_output=True, text=True, timeout=180)
    (out / 'private-backup.log').write_text(backup.stdout + '\n' + backup.stderr)
    assert backup.returncode == 0
    comparison = out / 'comparison'
    comparison.mkdir()
    report = audit(archive, comparison, cfg['instance'], cfg['portBase'] + 2)
    assert report['success'] and report['originalDocumentRowsCompared'] == 3 and report['tablesCompared'] == 127
    assert report['schemaMigrations'] == 71 and report['allApplicationTablesCovered']
    e.update(report)
except Exception as error:
    e['error'] = str(error)
finally:
    stopped = subprocess.run(['supabase', 'stop'], capture_output=True, text=True, timeout=120)
    (out / 'private-stop.log').write_text(stopped.stdout + '\n' + stopped.stderr)
    e['qaServicesStopped'] = stopped.returncode == 0
    e['success'] = bool(e['success'] and e['qaServicesStopped'])
    (out / 'evidence.json').write_text(json.dumps(e, indent=2))
print(json.dumps(e), flush=True)
sys.exit(0 if e['success'] else 1)
