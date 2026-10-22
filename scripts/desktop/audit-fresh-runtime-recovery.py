"""Private, read-only data/key audit inside the owned restored WSL runtime."""
import glob
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
from urllib.parse import urlparse, unquote

os.chdir('/home/agentopia/app')
out = Path(sys.argv[1]).resolve()
assert out.parent == Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-fresh-recovery')
config = json.loads((out / 'intent.json').read_text())
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == config['instanceId']
assert Path('/opt/agentopia/runtime-identity').read_text().strip() == 'local.agentopia.desktop-runtime.v1'
source = json.loads((out / 'private-snapshot-fingerprints.json').read_text())
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
assert state['runtime'] == 'native'
url = urlparse(state['env']['DB_URL'])
assert url.port == config['ports']['database']
binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0])
env = dict(os.environ, PGPASSWORD=unquote(url.password or ''),
    PGOPTIONS='-c default_transaction_read_only=on', PGAPPNAME='agentopia_fresh_recovery_audit')

def sql(statement, readonly=True):
    query_env = dict(env)
    if not readonly:
        query_env.pop('PGOPTIONS', None)
    result = subprocess.run([str(binary), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1',
        '-p', str(url.port), '-U', 'supabase_admin', '-d', 'postgres'],
        input=statement + '\n', env=query_env, text=True, capture_output=True)
    if result.returncode:
        (out / 'private-audit-error.log').write_text(result.stderr)
        raise RuntimeError('The restored database audit failed; private diagnostics are retained.')
    return result.stdout.strip()

def quote(value):
    return '"' + value.replace('"', '""') + '"'

mode = sys.argv[2] if len(sys.argv) > 2 else 'audit'
assert mode in ('audit', 'probe-create', 'probe-check-and-remove')
if mode != 'audit':
    identifier = str(uuid.UUID(config['instanceId']))
    name = 'agentopia-recovery-probe-' + identifier
    value = 'RECOVERY-' + identifier
    if mode == 'probe-create':
        assert sql("SELECT count(*) FROM vault.secrets WHERE name='" + name + "'") == '0'
        secret = str(uuid.UUID(sql("SELECT vault.create_secret('" + value + "','" + name + "')", False)))
        (out / 'private-canary.json').write_text(json.dumps({'id': secret}))
    else:
        secret = str(uuid.UUID(json.loads((out / 'private-canary.json').read_text())['id']))
    assert sql("SELECT decrypted_secret='" + value + "' FROM vault.decrypted_secrets WHERE id='" + secret + "'") == 't'
    if mode == 'probe-check-and-remove':
        sql("DELETE FROM vault.secrets WHERE id='" + secret + "' AND name='" + name + "'", False)
        assert sql("SELECT count(*) FROM vault.secrets WHERE id='" + secret + "'") == '0'
    print(json.dumps({'success': True, 'mode': mode, 'decryptionVerified': True,
        'probeRemoved': mode == 'probe-check-and-remove'}))
    sys.exit(0)

queries = []
for item in source['tables']:
    label = item['schema'] + '.' + item['table']
    name = quote(item['schema']) + '.' + quote(item['table'])
    columns = ','.join(map(quote, item['columns']))
    queries.append("SELECT json_build_object('table','" + label + "','rows',count(*),'digest',"
        "md5(coalesce(string_agg(to_jsonb(q)::text,E'\\n' ORDER BY to_jsonb(q)::text),'')))::text "
        'FROM (SELECT ' + columns + ' FROM ' + name + ') q')
observed = [json.loads(row) for row in sql('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ' + '; '.join(queries) + '; COMMIT').splitlines() if row]
differences = [a['table'] for a, b in zip(observed, source['fingerprints']) if a != b]
assert len(observed) == len(source['fingerprints']) and not differences, 'Existing rows differ in: ' + ', '.join(differences)
root = (out / 'profile/migration-input/pgsodium_root.key').read_text().strip()
assert hashlib.sha256(root.encode()).hexdigest() == config['rootKeySha256']
roots = list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'))
states = list(Path('/home/agentopia/.supabase/stacks').glob('*/state.json'))
assert len(roots) == len(states) == 1
assert roots[0].read_text().strip() == root
assert json.loads(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').read_text())['root_key'] == root
assert json.loads(states[0].read_text())['credentials']['postgresRootKey'] == root
import tomllib
assert tomllib.loads(Path('supabase/config.toml').read_text())['db']['root_key'] == root
versions = json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations'))
files = sorted(Path('/opt/agentopia/database').glob('*.sql'))
assert len(versions) == len(files) == 56
assert all(versions[file.name] == hashlib.sha256(file.read_bytes()).hexdigest() for file in files)
counts = json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),"
    "'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2))"))
readable_vault_rows = int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'))
assert readable_vault_rows == next(item['rows'] for item in source['fingerprints'] if item['table'] == 'vault.secrets')
print(json.dumps({'success': True, 'counts': counts, 'schema': 56, 'existingTablesCompared': len(observed),
    'readableExistingVaultRows': readable_vault_rows,
    'existingRowsCompared': sum(item['rows'] for item in observed), 'rootRestoredInAllBindings': True,
    'services': [{key: service[key] for key in ('service', 'state', 'health')} for service in state['services']]}))
