"""Read-only fingerprints of original-account data. Never emit row values."""
import collections
import decimal
import glob
import hashlib
import json
import subprocess
from urllib.parse import urlparse

state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
database = urlparse(state['env']['DB_URL'])
psql = glob.glob('/home/sylvana/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]


def sql(query):
    return subprocess.check_output([psql, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-h', '127.0.0.1', '-p', str(database.port), '-U', 'supabase_admin', '-d', 'postgres', '-c', query], text=True).strip()


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True, default=str)


owners = json.loads(sql("SELECT json_agg(id::text ORDER BY id) FROM auth.users WHERE email IN ('admin@sylvana.local','user@sylvana.local')"))
assert len(owners) == 2
owner_values = ','.join("'" + value + "'" for value in owners)
tables = json.loads(sql("SELECT json_agg(c.table_name ORDER BY c.table_name) FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name WHERE c.table_schema='public' AND c.column_name='user_id' AND c.data_type IN ('uuid','text','character varying') AND t.table_type='BASE TABLE'"))
assert len(tables) >= 10
fingerprints = {}
active_children = active_reports = 0
for table in tables:
    identifier = '"' + table.replace('"', '""') + '"'
    rows = [json.loads(line, parse_float=decimal.Decimal) for line in sql('SELECT row_to_json(t) FROM public.' + identifier + ' t WHERE user_id::text IN (' + owner_values + ')').splitlines() if line]
    serialized = sorted(encoded(row) for row in rows)
    fingerprints[table] = dict(rows=len(rows), sha256=hashlib.sha256('\n'.join(serialized).encode()).hexdigest())
    if table == 'desktop_codex_turns':
        for row in rows:
            native = row.get('state') or {}
            active_children += sum(child.get('status') == 'running' for child in native.get('children', []))
            active_reports += sum(report.get('status') == 'running' for report in native.get('reports', []))
print(json.dumps(dict(format=1, readOnly=True, ownerCount=len(owners), tables=fingerprints, activeChildren=active_children, activeReports=active_reports)))
