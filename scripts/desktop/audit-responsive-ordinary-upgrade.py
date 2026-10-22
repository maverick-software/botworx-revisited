"""Compare ordinary data to the checked40 recovery; never installs or sends requests."""
import collections
import datetime
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlparse, unquote
from audit_ordinary_process import ordinary_processes

ROOT = Path('/mnt/d/Users/charl/software/Agentopia')
CANDIDATE = ROOT / '.supabase/desktop-platform-release/candidate-04440'
assert sys.argv[1:] in (['--before'], ['--after'])
mode = sys.argv[1][2:]
expected_version = '0.44.31' if mode == 'before' else '0.44.40'
instance = 'a91a4800-e08f-4440-a4ec-588762d01bfd'
os.umask(0o077)
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == instance
profile = Path('/mnt/c/Users/charl/AppData/Roaming/Agentopia')
assert json.loads((profile / 'runtime-binding.json').read_text())['instanceId'] == instance
promotion = json.loads((CANDIDATE / 'promotion-status.json').read_text())
assert promotion['success'] and promotion['version'] == '0.44.40'
pointer = json.loads((CANDIDATE / 'upgrade-backup.json').read_text())
backup = Path(pointer['out'].replace('C:\\', '/mnt/c/').replace('\\', '/'))
assert backup.parent == Path('/mnt/c/Users/charl/AgentopiaRecovery/before-04440')
assert re.fullmatch(r'\d{13}', backup.name)
backup_evidence = json.loads((backup / 'evidence.json').read_text())
assert backup_evidence['success'] and backup_evidence['phase'] == 'complete'
release = json.loads((CANDIDATE / 'release-proof.json').read_text())
packaged = json.loads((CANDIDATE / 'package-proof.json').read_text())
assert release['installerVerified'] and release['imageSha256'] == pointer['imageSha256']
installed = Path('/mnt/c/Users/charl/AppData/Local/AgentopiaDesktop') / ('app-' + expected_version) / 'resources'

def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

expected_image = '69964ce0bf472ae74646ae111d8f9234ec968e46ea85558ac305f01d89933434' if mode == 'before' else release['imageSha256']
assert sha(installed / 'app.asar') == expected_image, 'The physical installed archive differs from the expected version'
version = json.loads((installed / 'resources/version.json').read_text())
assert version['version'] == expected_version and version['schema'] == 69
running = ordinary_processes(expected_version)
resources_checked = 0
if mode == 'after':
    for name, digest in packaged['resourceFiles'].items():
        assert sha(installed / 'resources' / name) == digest, 'Installed resource differs: ' + name
        resources_checked += 1
os.chdir('/home/agentopia/app')
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
assert state['runtime'] == 'native'
db = urlparse(state['env']['DB_URL'])
binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on', PGTZ='UTC', PGAPPNAME='agentopia_ordinary_upgrade_comparison')

def sql(statement):
    result = subprocess.run([str(binary / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres'], input=statement + '\n', env=env, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Read-only upgrade comparison failed')
    return result.stdout

def tables(archive, schema):
    output = subprocess.check_output([str(binary / 'pg_restore'), '--data-only', '--schema', schema, '--file=-', str(backup / 'current-database-backup' / archive)], text=True)
    result = {}
    for match in re.finditer(r'^COPY ' + re.escape(schema) + r'\.([a-z0-9_]+) \(([^\n]+)\) FROM stdin;\n(.*?)^\\\.\n', output, re.M | re.S):
        name, fields, body = match.groups()
        columns = [field.strip().strip('"') for field in fields.split(',')]
        assert all(re.fullmatch(r'[a-z0-9_]+', column) for column in columns)
        result[name] = (columns, body[:-1].split('\n') if body else [])
    return result

public = tables('application.dump', 'public')
users = tables('auth.dump', 'auth')
vault = tables('vault.dump', 'vault')
assert 'users' in users and 'secrets' in vault and len(public) > 50
current_public = json.loads(sql("SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public'"))
assert set(public) == set(current_public), 'The recovery/current public table inventory differs'
selected = [('public', name, columns, rows) for name, (columns, rows) in sorted(public.items())]
selected += [('auth', 'users', *users['users']), ('vault', 'secrets', *vault['secrets'])]
compared = {}
for schema, name, columns, before in selected:
    quoted = ','.join('"' + column + '"' for column in columns)
    after_text = sql('COPY (SELECT ' + quoted + ' FROM "' + schema + '"."' + name + '") TO STDOUT')
    after = after_text[:-1].split('\n') if after_text else []
    if schema == 'auth':
        keep = [index for index, column in enumerate(columns) if column not in ('updated_at', 'last_sign_in_at')]
        normalize = lambda values: collections.Counter(tuple(row.split('\t')[index] for index in keep) for row in values)
    else:
        normalize = collections.Counter
    assert normalize(before) == normalize(after), 'Saved rows differ from the checked recovery: ' + schema + '.' + name
    compared[schema + '.' + name] = len(before)

versions = json.loads(sql('SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations'))
migrations = sorted((installed / 'resources/database').glob('*.sql'))
assert len(versions) == len(migrations) == 69
assert all(versions[file.name] == sha(file) for file in migrations)
readable = int(sql('SELECT count(decrypted_secret) FROM vault.decrypted_secrets'))
assert readable == compared['vault.secrets']
roots = list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'))
assert len(roots) == 1 and roots[0].read_text().strip() == (backup / 'current-database-backup/pgsodium_root.key').read_text().strip()
active = json.loads(sql("SELECT json_build_object('requests',(SELECT count(*) FROM public.desktop_requests WHERE status='running'),'goals',(SELECT count(*) FROM public.desktop_goals WHERE status='running'))"))
assert active == {'requests': 0, 'goals': 0}, 'Ordinary work is active; preserve its outcome before maintenance'
assert compared['auth.users'] == 2 and compared['public.conversation_sessions'] == 108 and compared['public.chat_messages_v2'] == 366 and compared['public.desktop_requests'] == 183
result = {'success': True, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'mode': mode, 'version': expected_version, 'schema': 69, 'installedImageSha256': expected_image, 'runningOrdinaryVersion': running, 'recovery': str(backup), 'backupEvidenceSha256': sha(backup / 'evidence.json'), 'tablesCompared': len(compared), 'rowsCompared': sum(compared.values()), 'savedRowsMatched': compared, 'passwordsAndRolesPreserved': True, 'requestsUnchanged': True, 'activeWork': active, 'readableVaultRecords': readable, 'encryptionRootPreserved': True, 'resourceFilesCompared': resources_checked, 'databaseReadOnly': True, 'providerRequests': 0, 'limits': ['All public table rows, auth.users except two sign-in timestamps, and stored vault rows are compared to the recovery.', 'Authentication audit logs, sessions and rotating refresh-token rows are excluded from literal comparison.', 'Provider credentials and UI connection status still require their separate profile/native-interface checks.']}
output = CANDIDATE / 'ordinary-upgrade-audit'
output.mkdir(exist_ok=True)
with (output / (mode + '-' + expected_version + '.json')).open('x') as stream:
    json.dump(result, stream, indent=2)
print(json.dumps({key: result[key] for key in ('success', 'mode', 'version', 'tablesCompared', 'rowsCompared', 'passwordsAndRolesPreserved', 'requestsUnchanged', 'activeWork', 'readableVaultRecords', 'resourceFilesCompared', 'providerRequests')}))
