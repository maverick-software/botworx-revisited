"""Restore only the QA timestamp changed by the negative agent-row probe."""
import glob
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from audit_logical_snapshot71 import audit

os.umask(0o077)
out, intent, before = map(Path, sys.argv[1:4])
cfg = json.loads(intent.read_text())
assert cfg['instance'] == '7d87fd24-b2da-41ea-81a9-e9a764327845' and cfg['role'] == 'restored'
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == cfg['instance']
assert before == Path('/mnt/f/Agentopia/.supabase/desktop-logical-transition72/1792754195660/before-database')
assert out.parent == before.parent and out.name.startswith('repair-')
out.mkdir()
os.chdir('/home/agentopia/app')
e = {'success': False, 'productionAccess': False, 'providerRequests': 0}
try:
    r = subprocess.run(['supabase', 'start', '--runtime', 'native', '--eager', '--exclude', 'analytics,pooler,studio'], capture_output=True, timeout=300)
    assert r.returncode == 0
    state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json']))
    url = urlparse(state['env']['DB_URL'])
    assert url.port == cfg['portBase'] + 2 != 57322
    binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
    env = dict(os.environ, PGPASSWORD=unquote(url.password or ''))
    def sql(text):
        r = subprocess.run([str(binary / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(url.port), '-U', 'supabase_admin', '-d', 'postgres'], input=text.encode(), env=env, capture_output=True)
        assert r.returncode == 0, 'Owned repair query failed.'
        return r.stdout
    assert sql('SELECT count(*) FROM agentopia_desktop.migrations;').strip() == b'71'
    decoded = subprocess.check_output([str(binary / 'pg_restore'), '--data-only', '--table=agents', '--file=-', str(before / 'application.dump')])
    columns, original, active = None, [], False
    for line in decoded.splitlines(keepends=True):
        if active:
            if line == b'\\.\n':
                active = False
            else:
                original.append(line)
        else:
            match = re.fullmatch(rb'COPY public\.agents \((.*?)\) FROM stdin;\n', line)
            if match:
                assert columns is None
                columns = match[1].decode().split(', ')
                active = True
    assert columns and original and not active and all(re.fullmatch('[a-z_]+', name) for name in columns)
    names = ','.join(columns)
    current = sql('COPY (SELECT ' + names + ' FROM public.agents ORDER BY id) TO STDOUT;').splitlines(keepends=True)
    key = columns.index('id')
    rows = lambda values: {row.rstrip(b'\n').split(b'\t')[key]: row.rstrip(b'\n').split(b'\t') for row in values}
    old, live = rows(original), rows(current)
    assert old.keys() == live.keys()
    changed = [(identity, [columns[n] for n, (a, b) in enumerate(zip(old[identity], live[identity])) if a != b]) for identity in old if old[identity] != live[identity]]
    assert len(changed) == 1 and changed[0][1] == ['updated_at'], 'Only the known timestamp may be repaired.'
    assert sql("SELECT bool_and(tgenabled='O') FROM pg_trigger WHERE tgrelid='public.agents'::regclass AND NOT tgisinternal;").strip() == b't'
    command = 'BEGIN; CREATE TEMP TABLE transition_original_agents (LIKE public.agents); COPY transition_original_agents (' + names + ') FROM STDIN;\n'
    command += b''.join(original).decode() + '\\.\nALTER TABLE public.agents DISABLE TRIGGER USER;\n'
    command += 'UPDATE public.agents a SET updated_at=t.updated_at FROM transition_original_agents t WHERE a.id=t.id; ALTER TABLE public.agents ENABLE TRIGGER USER; COMMIT;'
    sql(command)
    compared = out / 'strict-comparison'
    compared.mkdir()
    result = audit(before, compared, cfg['instance'], cfg['portBase'] + 2)
    e.update({'checked': result['success'], 'changedColumnsBeforeRepair': ['updated_at'], 'repairedRows': 1, 'savedRowsCompared': result['savedRowsCompared'], 'tablesCompared': result['tablesCompared']})
except Exception as error:
    e['error'] = str(error)
finally:
    stopped = subprocess.run(['supabase', 'stop'], capture_output=True, timeout=120)
    e['qaServicesStopped'] = stopped.returncode == 0
    e['success'] = bool(e.get('checked') and e['qaServicesStopped'])
    (out / 'evidence.json').write_text(json.dumps(e, indent=2))
print(json.dumps(e))
sys.exit(0 if e['success'] else 1)
