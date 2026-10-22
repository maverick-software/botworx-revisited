"""Exercise the delivered backup and provision scripts against an owned copy.

The real application database is read-only except for CREATE/DROP DATABASE of
one generated name. Provision's psql connections and resource root are routed
to that copy in-process; its delivered script and SQL files stay unchanged.
No authentication service, provider connection, or inference is involved.
"""
import glob
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from urllib.parse import urlparse, unquote

os.umask(0o077)
root = Path('/mnt/d/Users/charl/software/Agentopia')
out = Path(sys.argv[1]).resolve()
assert out.parent == root / '.supabase/desktop-upgrade-rehearsal'
assert re.fullmatch(r'[0-9]{13}', out.name)
assert (out / 'intent.json').exists() and not (out / 'evidence.json').exists()
intent = json.loads((out / 'intent.json').read_text())
assert intent['version'] == '0.44.6'
candidate = root / '.supabase/desktop-native-goals/candidate-0446'
resources = candidate / 'staging/out/Agentopia-win32-x64/resources/resources'
manage = resources / 'runtime/manage.py'
assert manage.read_bytes() == (candidate / 'resources/runtime/manage.py').read_bytes()
migrations = sorted((resources / 'database').glob('*.sql'))
assert len(migrations) == 56
for migration in migrations:
    assert migration.read_bytes() == (candidate / 'resources/database' / migration.name).read_bytes()

os.chdir('/home/agentopia/app')
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
assert state['runtime'] == 'native'
url = urlparse(state['env']['DB_URL'])
binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
os.environ['PGPASSWORD'] = unquote(url.password or '')
os.environ['PGAPPNAME'] = 'agentopia_isolated_upgrade_rehearsal'
base = ['-h', '127.0.0.1', '-p', str(url.port), '-U', 'supabase_admin']
database = 'agentopia_upgrade_' + uuid.uuid4().hex[:16]
assert re.fullmatch(r'agentopia_upgrade_[0-9a-f]{16}', database)
backup = Path('/home/agentopia/backups') / ('upgrade-rehearsal-' + database.removeprefix('agentopia_upgrade_'))
assert not backup.exists()
created = False
real_run, real_output = subprocess.run, subprocess.check_output
evidence = {'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'version': '0.44.6',
 'imageSha256': intent['imageSha256'], 'fixtureSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'database': database, 'backupDirectory': str(backup), 'checks': [], 'productionMigrations': 0,
 'serviceStarts': 0, 'providerRequests': 0, 'unmodifiedDeliveredManager': True,
 'managerRouting': 'Only the resource root and psql destination are redirected for provision.'}

def check(message):
    evidence['checks'].append(message)
    print('PASS: ' + message, flush=True)

def sql(statement, target=database, readonly=False):
    assert target == database or target == 'postgres'
    if target == 'postgres' and not readonly:
        assert statement in ('CREATE DATABASE ' + database + ' TEMPLATE template0', 'DROP DATABASE ' + database)
    env = dict(os.environ)
    if readonly:
        env['PGOPTIONS'] = '-c default_transaction_read_only=on'
    result = real_run([str(binary / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', *base,
        '-d', target], input=statement + '\n', env=env, text=True, capture_output=True)
    if result.returncode:
        # Database errors can contain row values. Keep them in private storage.
        backup.mkdir(mode=0o700, parents=True, exist_ok=True)
        (backup / 'private-sql-error.log').write_text(result.stderr)
        raise RuntimeError('Database step failed; see the private SQL error log in the backup directory.')
    return result.stdout.strip()

def inventory():
    return json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),"
        "'conversations',(SELECT count(*) FROM public.conversation_sessions),"
        "'messages',(SELECT count(*) FROM public.chat_messages_v2),"
        "'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))", 'postgres', True))

def quote(value):
    return '"' + value.replace('"', '""') + '"'

def snapshot_sql(statement, snapshot=None, target='postgres'):
    begin = 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '
    if snapshot:
        assert re.fullmatch(r'[0-9A-F-]+', snapshot)
        begin += "SET TRANSACTION SNAPSHOT '" + snapshot + "'; "
    return sql(begin + statement + '; COMMIT', target, True)

def tables(snapshot):
    return json.loads(snapshot_sql("SELECT json_agg(json_build_object('schema',n.nspname,'table',c.relname,"
        "'columns',(SELECT json_agg(a.attname ORDER BY a.attnum) FROM pg_attribute a "
        "WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)) ORDER BY n.nspname,c.relname) "
        "FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
        "WHERE c.relkind='r' AND n.nspname IN ('public','auth','vault','pgsodium')", snapshot))

def fingerprints(definitions, snapshot=None, target='postgres'):
    queries = []
    for item in definitions:
        name = quote(item['schema']) + '.' + quote(item['table'])
        columns = ','.join(map(quote, item['columns']))
        label = item['schema'] + '.' + item['table']
        assert re.fullmatch(r'[A-Za-z0-9_.-]+', label)
        queries.append("SELECT json_build_object('table','" + label + "','rows',count(*),"
            "'digest',md5(coalesce(string_agg(to_jsonb(q)::text,E'\\n' ORDER BY to_jsonb(q)::text),'')))::text "
            'FROM (SELECT ' + columns + ' FROM ' + name + ') q')
    rows = snapshot_sql('; '.join(queries), snapshot, target).splitlines()
    return [json.loads(row) for row in rows if row]

snapshot_ids, definitions, original = set(), None, None

def backup_run(args, *positional, **kwargs):
    global definitions, original
    if isinstance(args, list) and Path(args[0]).name == 'pg_dump':
        snapshot = args[args.index('--snapshot') + 1]
        snapshot_ids.add(snapshot)
        assert len(snapshot_ids) == 1
        if original is None:
            definitions = tables(snapshot)
            original = fingerprints(definitions, snapshot)
        assert args[args.index('-d') + 1] == 'postgres'
        # Suppress maintenance output; backup logs remain private.
        kwargs.update(stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return real_run(args, *positional, **kwargs)

def manager(command, resource_root=resources):
    saved_argv, saved_trace = sys.argv, sys.gettrace()
    saved_run, saved_output = subprocess.run, subprocess.check_output
    routes = {'root': False, 'connections': 0}

    def routed(args):
        if isinstance(args, list) and Path(args[0]).name == 'psql':
            args = list(args)
            position = args.index('-d') + 1
            assert args[position] == 'postgres'
            args[position] = database
            routes['connections'] += 1
        else:
            assert args == ['supabase', 'stack', 'status', '--output-format', 'json']
        return args

    def routed_run(args, *a, **kw):
        args = routed(args)
        kw.update(stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        return real_run(args, *a, **kw)

    def routed_output(args, *a, **kw):
        # check_output internally calls subprocess.run; call the saved run
        # directly so the destination is routed exactly once.
        kw.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return real_run(routed(args), *a, **kw).stdout

    def redirect(frame, event, arg):
        if frame.f_code.co_filename == str(manage) and event == 'line':
            if frame.f_globals.get('ROOT') == Path('/opt/agentopia'):
                frame.f_globals['ROOT'] = resource_root
                routes['root'] = True
        return redirect

    try:
        sys.argv = [str(manage), command] + ([str(backup)] if command == 'backup' else [])
        if command == 'backup':
            os.environ['PGOPTIONS'] = '-c default_transaction_read_only=on'
            subprocess.run = backup_run
        else:
            assert command == 'provision' and created
            subprocess.run, subprocess.check_output = routed_run, routed_output
            sys.settrace(redirect)
        runpy.run_path(str(manage), run_name='__main__')
        if command == 'provision':
            assert routes['root'] and routes['connections'] >= 59
        return routes
    finally:
        sys.argv = saved_argv
        sys.settrace(saved_trace)
        subprocess.run, subprocess.check_output = saved_run, saved_output
        os.environ.pop('PGOPTIONS', None)

try:
    evidence['before'] = inventory()
    assert evidence['before']['migrations'] == 45
    assert not sql("SELECT 1 FROM pg_database WHERE datname='" + database + "'", 'postgres', True)
    manager('backup')
    assert len(snapshot_ids) == 1 and original and definitions
    manifest = json.loads((backup / 'manifest.json').read_text())
    assert manifest['format'] == 1 and manifest['postgres'] == 17
    assert {item['name'] for item in manifest['files']} == {'database.dump', 'auth.dump', 'application.dump', 'vault.dump', 'pgsodium_root.key'}
    for item in manifest['files']:
        assert hashlib.sha256((backup / item['name']).read_bytes()).hexdigest() == item['sha256']
    evidence['backupFiles'] = [{'name': item['name'], 'sha256': item['sha256'],
        'bytes': (backup / item['name']).stat().st_size} for item in manifest['files']]
    (backup / 'private-snapshot-fingerprints.json').write_text(json.dumps({'tables': definitions, 'fingerprints': original}))
    check('The delivered backup script creates four archives from one exported snapshot and verifies the recovery key and manifest.')

    sql('CREATE DATABASE ' + database + ' TEMPLATE template0', 'postgres')
    created = True
    (out / 'owned-database.json').write_text(json.dumps({'database': database, 'createdByThisRun': True}))
    toc = real_output([str(binary / 'pg_restore'), '--list', str(backup / 'database.dump')], text=True)
    omitted, retained = [], []
    for line in toc.splitlines():
        # pg_cron belongs to the live cluster's configured database. It is not
        # registered or executed in this secondary database; all app data stays.
        if re.search(r' (?:EXTENSION - pg_cron|COMMENT - EXTENSION pg_cron|ACL - SCHEMA cron |(?:ACL|DEFAULT ACL|TABLE DATA|SEQUENCE SET) cron )', line):
            omitted.append(line)
        elif ' SCHEMA - public ' in line:
            omitted.append(line)
        else:
            retained.append(line)
    assert any('EXTENSION - pg_cron' in line for line in omitted)
    listing = backup / 'isolated-restore.list'
    listing.write_text('\n'.join(retained) + '\n')
    result = real_run([str(binary / 'pg_restore'), '--exit-on-error', '--single-transaction', '--no-owner',
        '--use-list', str(listing), *base, '-d', database, str(backup / 'database.dump')],
        text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    (backup / 'private-restore.log').write_text(result.stdout + '\n' + result.stderr)
    assert result.returncode == 0, 'Restore failed; inspect the private restore log before repeating.'
    evidence['restoreOmissions'] = ['already-existing public schema', 'cluster-bound pg_cron extension and scheduler data']
    assert fingerprints(definitions, target=database) == original, 'Restored existing records differ from their source snapshot.'
    evidence['existingTablesCompared'] = len(definitions)
    evidence['existingRowsCompared'] = sum(item['rows'] for item in original)
    check('The restored copy exactly retains every existing public, auth, vault and pgsodium table row in the snapshot, including account password hashes, roles and history.')

    applied_before = dict(json.loads(sql("SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations")))
    assert len(applied_before) == 45
    evidence['firstProvisionRouting'] = manager('provision')
    applied_after = json.loads(sql("SELECT json_object_agg(version,checksum) FROM agentopia_desktop.migrations"))
    assert len(applied_after) == 56
    assert all(applied_after[name] == value for name, value in applied_before.items())
    assert all(applied_after[file.name] == hashlib.sha256(file.read_bytes()).hexdigest() for file in migrations)
    assert fingerprints(definitions, target=database) == original, 'Provision changed an existing record; inspect its intended recovery effect.'
    evidence['applied'] = [file.name for file in migrations if file.name not in applied_before]
    check('The unmodified delivered provision script applies migrations 46–56 transactionally to the restored copy and preserves all existing record values.')
    first_versions = sql("SELECT json_agg(to_jsonb(m) ORDER BY version) FROM agentopia_desktop.migrations m")
    evidence['secondProvisionRouting'] = manager('provision')
    assert first_versions == sql("SELECT json_agg(to_jsonb(m) ORDER BY version) FROM agentopia_desktop.migrations m")
    assert fingerprints(definitions, target=database) == original
    check('A second provision run validates the same 56 checksums and leaves the migration records and existing data unchanged.')
    with tempfile.TemporaryDirectory(prefix='failure-resources-', dir=backup) as temporary:
        failure_resources = Path(temporary)
        shutil.copytree(resources / 'database', failure_resources / 'database')
        (failure_resources / 'database/0057-controlled-rollback-probe.sql').write_text(
            'CREATE TABLE public.desktop_upgrade_failure_probe(id integer); SELECT 1/0;\n')
        try:
            manager('provision', failure_resources)
            raise AssertionError('The deliberately failing migration unexpectedly completed.')
        except subprocess.CalledProcessError as error:
            details = error.stderr.decode('utf8', errors='replace') if isinstance(error.stderr, bytes) else error.stderr
            assert error.returncode != 0 and 'division by zero' in details
        assert sql("SELECT to_regclass('public.desktop_upgrade_failure_probe') IS NULL") == 't'
        assert first_versions == sql("SELECT json_agg(to_jsonb(m) ORDER BY version) FROM agentopia_desktop.migrations m")
        assert fingerprints(definitions, target=database) == original
    check('An intentionally failing extra migration rolls back its new table and version record together, preserving the upgraded copy and all existing data.')
    assert sql("SELECT to_regclass('public.desktop_browser_folder_call_once') IS NOT NULL AND "
        "to_regprocedure('public.desktop_recover_goal_turns()') IS NOT NULL") == 't'
    check('The copied database contains the folder-call uniqueness index and the native-goal recovery function required by this installer.')
    evidence['managerSha256'] = hashlib.sha256(manage.read_bytes()).hexdigest()
    evidence['checksPassed'] = True
except Exception as error:
    evidence['error'] = str(error) if not isinstance(error, subprocess.CalledProcessError) else 'A maintenance subprocess failed; private diagnostics are retained.'
finally:
    if created:
        assert json.loads((out / 'owned-database.json').read_text()) == {'database': database, 'createdByThisRun': True}
        sql('DROP DATABASE ' + database, 'postgres')
        evidence['disposableDatabaseRemoved'] = not bool(sql("SELECT 1 FROM pg_database WHERE datname='" + database + "'", 'postgres', True))
    evidence['after'] = inventory()
    evidence['productionUnchanged'] = evidence['after'] == evidence.get('before')
    evidence['success'] = bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionUnchanged'])
    evidence['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (out / 'evidence.json').write_text(json.dumps(evidence, indent=2))
print(json.dumps(evidence, indent=2))
sys.exit(0 if evidence['success'] else 1)
