"""Independently verify that the ordinary comparison covers every public table."""
from pathlib import Path
import datetime
import glob
import hashlib
import json
import os
import subprocess
from urllib.parse import urlparse, unquote

root = Path('/mnt/d/Users/charl/software/Agentopia')
out = root / '.supabase/desktop-platform-release/candidate-04440/ordinary-upgrade-audit'
before = out / 'before-0.44.31.json'
baseline = json.loads(before.read_text())
assert baseline['success'] and baseline['version'] == '0.44.31'
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == 'a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app')
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
db = urlparse(state['env']['DB_URL'])
binary = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on')
statement = "SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"
result = subprocess.run([binary, '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres', '-c', statement], text=True, capture_output=True, env=env)
assert result.returncode == 0, 'Read-only table inventory failed'
names = json.loads(result.stdout)
assert set(names) == {key[7:] for key in baseline['savedRowsMatched'] if key.startswith('public.')}
evidence = {'success': True, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'allPublicTablesCompared': True, 'publicTables': len(names), 'beforeReceiptSha256': hashlib.sha256(before.read_bytes()).hexdigest(), 'readOnly': True}
with (out / 'table-inventory.json').open('x') as stream:
    json.dump(evidence, stream, indent=2)
print(json.dumps(evidence))
