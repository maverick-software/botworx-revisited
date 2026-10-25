"""Compare every application table plus account and vault rows without loading dumps."""
import datetime
import glob
import hashlib
import json
import os
import re
import subprocess
import tomllib
import uuid
from pathlib import Path
from urllib.parse import unquote, urlparse
from logical_row_fingerprints71 import Fingerprints, lines, IDENTIFIER


def audit(archive, out, instance, expected_port, additional_empty_tables=(), expected_composio_plugin=None):
    archive, out = Path(archive), Path(out)
    assert len(set(additional_empty_tables)) == len(additional_empty_tables)
    assert all(IDENTIFIER.fullmatch(name) for name in additional_empty_tables)
    assert out.is_dir() and archive.is_dir()
    assert str(uuid.UUID(instance)) == instance
    assert Path('/opt/agentopia/runtime-instance').read_text().strip() == instance
    manifest = json.loads((archive / 'manifest.json').read_text())
    assert manifest['format'] == 1 and len(manifest['files']) == 5
    required = {'auth.dump', 'application.dump', 'vault.dump', 'database.dump', 'pgsodium_root.key'}
    assert {row['name'] for row in manifest['files']} == required
    for row in manifest['files']:
        with (archive / row['name']).open('rb') as stream:
            assert hashlib.file_digest(stream, 'sha256').hexdigest() == row['sha256']
    os.chdir('/home/agentopia/app')
    state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
    db = urlparse(state['env']['DB_URL'])
    assert db.port == expected_port == tomllib.loads(Path('supabase/config.toml').read_text())['db']['port']
    binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
    store = Fingerprints(out / 'row-fingerprints.sqlite')
    env = dict(os.environ, PGPASSWORD=unquote(db.password or ''), PGOPTIONS='-c default_transaction_read_only=on',
               PGTZ='UTC', PGAPPNAME='agentopia_complete_logical71_readonly')
    try:
        for schema, name in [('public', 'application.dump'), ('auth', 'auth.dump'), ('vault', 'vault.dump')]:
            with (out / ('private-restore-' + schema + '.log')).open('wb') as errors:
                process = subprocess.Popen([str(binary / 'pg_restore'), '--data-only', '--file=-', str(archive / name)], stdout=subprocess.PIPE, stderr=errors)
                try:
                    store.archive(process.stdout, schema)
                finally:
                    process.stdout.close()
                    code = process.wait(timeout=120)
                assert code == 0, 'Archive decoding failed; inspect private diagnostics.'
        expected = store.result('archive')
        assert {'auth.users', 'vault.secrets', 'public.desktop_media_files'} <= set(expected)
        assert sorted(store.accounts['archive']) == sorted(manifest['accountIds'])
        assert len(set(manifest['accountIds'])) == manifest['accounts'] == len(manifest['accountIds'])
        nonce = uuid.uuid4().hex
        begin, end = '__AUDIT_BEGIN_' + nonce + '__', '__AUDIT_END_' + nonce + '__'
        commands = ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;',
            "SELECT jsonb_build_object('publicTables',(SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'readableVault',(SELECT count(decrypted_secret) FROM vault.decrypted_secrets));"]
        if additional_empty_tables:
            counts = ','.join("'" + name + "',(SELECT count(*) FROM public.\"" + name + '\")' for name in additional_empty_tables)
            commands[1] = commands[1].replace("'migrations',", "'additionalEmptyTables',jsonb_build_object(" + counts + "),'migrations',")
        approved_composio = None
        if expected_composio_plugin is not None:
            assert set(expected_composio_plugin) == {'package', 'digest'}
            package, digest = expected_composio_plugin['package'], expected_composio_plugin['digest']
            assert package['manifest']['name'] == 'composio-connect'
            assert package['mcp']['mcpServers']['composio']['url'] == 'https://connect.composio.dev/mcp'
            assert hashlib.sha256(json.dumps(package, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() == digest
            literal = lambda value: "'" + value.replace("'", "''") + "'"
            owners = ','.join(literal(str(uuid.UUID(owner))) for owner in manifest['accountIds'])
            approved_composio = ("name='composio-connect' AND source='bundled' AND enabled=true AND digest=" + literal(digest)
                + ' AND package=' + literal(json.dumps(package)) + '::jsonb AND user_id IN (' + owners + ')')
            commands[1] = commands[1].replace("'readableVault',", "'additionalComposioRows',(SELECT count(*) FROM public.desktop_plugins WHERE " + approved_composio + "),'readableVault',")
        for name, record in expected.items():
            schema, table = name.split('.')
            assert all(IDENTIFIER.fullmatch(part) for part in [schema, table, *record['columns']])
            columns = ','.join('"' + part + '"' for part in record['columns'])
            condition = ' WHERE NOT (' + approved_composio + ')' if name == 'public.desktop_plugins' and approved_composio else ''
            commands += ['\\echo ' + begin + name, 'COPY (SELECT ' + columns + ' FROM ' + schema + '."' + table + '"' + condition + ') TO STDOUT;', '\\echo ' + end]
        commands += ['COMMIT;']
        sql = out / 'read-only-audit.sql'
        sql.write_text('\n'.join(commands) + '\n')
        with sql.open('rb') as input_file, (out / 'private-live-query.log').open('wb') as errors:
            process = subprocess.Popen([str(binary / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1',
                '-p', str(db.port), '-U', 'supabase_admin', '-d', 'postgres'], stdin=input_file, stdout=subprocess.PIPE, stderr=errors, env=env)
            active, metadata = None, None
            try:
                for line in lines(process.stdout):
                    if active is not None:
                        if line == (end + '\n').encode():
                            active = None
                        else:
                            store.row('live', active, line)
                    elif metadata is None:
                        metadata = json.loads(line)
                    else:
                        assert line.startswith(begin.encode()), 'Unexpected audit framing.'
                        active = line.decode('ascii').strip()[len(begin):]
                        assert active in expected
                        store.begin('live', active, expected[active]['columns'])
            finally:
                process.stdout.close()
                code = process.wait(timeout=120)
            assert code == 0 and active is None and metadata, 'Live audit failed; inspect private diagnostics.'
        actual = store.result('live')
        assert sorted('public.' + name for name in metadata['publicTables']) == sorted([name for name in expected if name.startswith('public.')] + ['public.' + name for name in additional_empty_tables]), 'The archive must cover every original application table; only explicitly named empty new tables are allowed.'
        assert all(count == 0 for count in metadata.get('additionalEmptyTables', {}).values()), 'A newly added table has unexpected data.'
        assert metadata['migrations'] >= 71
        differences = sorted(name for name in expected.keys() | actual.keys() if expected.get(name) != actual.get(name))
        assert not differences, 'Saved rows differ: ' + ', '.join(differences)
        assert 0 <= metadata.get('additionalComposioRows', 0) <= manifest['accounts']
        assert metadata['readableVault'] == expected['vault.secrets']['rows']
        root_key = (archive / 'pgsodium_root.key').read_text().strip()
        roots = list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'))
        states = list(Path('/home/agentopia/.supabase/stacks').glob('*/state.json'))
        assert len(roots) == len(states) == 1
        assert roots[0].read_text().strip() == root_key == json.loads(states[0].read_text())['credentials']['postgresRootKey']
        assert json.loads(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').read_text())['root_key'] == root_key
        assert tomllib.loads(Path('supabase/config.toml').read_text())['db']['root_key'] == root_key
        report = {'success': True, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'tablesCompared': len(expected),
            'allApplicationTablesCovered': True, 'schemaMigrations': metadata['migrations'], 'savedRowsCompared': sum(row['rows'] for row in expected.values()),
            'originalDocumentRowsCompared': expected['public.desktop_media_files']['rows'], 'accounts': expected['auth.users']['rows'],
            'chats': expected['public.conversation_sessions']['rows'], 'messages': expected['public.chat_messages_v2']['rows'],
            'readableVaultRecords': metadata['readableVault'], 'encryptionRootBindingsVerified': 4,
            'accountPasswordAndRoleRowsPreserved': True, 'mismatches': [], 'databaseReadOnly': True, 'servicesRestarted': 0,
            'providerRequests': 0, 'completeDecodedDumpBuffered': False, 'maximumCopyRowBytes': store.maximum_row_bytes,
            'copyRowLimitBytes': 64 * 1024 * 1024, 'fingerprintAlgorithm': 'sorted row SHA-256 with duplicate multiplicity',
            'additionalEmptyTablesVerified': len(additional_empty_tables), 'additionalComposioCatalogRowsVerified': metadata.get('additionalComposioRows', 0),
            'allOriginalRowsComparedWithoutExclusions': True}
        (out / 'archive-table-fingerprints.json').write_text(json.dumps(expected, indent=2))
        return report
    finally:
        store.close()
