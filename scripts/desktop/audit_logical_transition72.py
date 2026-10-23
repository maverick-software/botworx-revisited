"""Compare every prior schema71 row and the explicitly authorized empty schema72 table."""
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

REVISION_COLUMNS = ['media_id:uuid', 'version:integer', 'user_id:uuid', 'document:jsonb', 'bytes:bytea', 'sha256:text', 'created_at:timestamp with time zone']


def validate_transition(expected, metadata):
    assert len(expected) == 127 and 'public.desktop_media_revisions' not in expected
    wanted = {name for name in expected if name.startswith('public.')} | {'public.desktop_media_revisions'}
    assert {'public.' + name for name in metadata['publicTables']} == wanted, 'Unexpected schema-transition table coverage.'
    assert len(metadata['publicTables']) == len(wanted), 'Duplicate live table names.'
    assert metadata['migrations'] == 72, 'This comparator only qualifies schema71 to schema72.'
    new = metadata['newTable']
    assert new['rows'] == 0, 'The newly added revisions table must be empty during upgrade acceptance.'
    assert new['columns'] == REVISION_COLUMNS, 'Unexpected revision columns.'
    for name in ['rls', 'anonDenied', 'authenticatedDenied', 'serviceReadWrite', 'primaryKey', 'brokerOnlyFunctions', 'privateFallbackDenied']:
        assert new[name] is True, 'Revision access or structure check failed: ' + name


def audit(archive, out, instance, expected_port):
    archive, out = Path(archive), Path(out)
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
               PGTZ='UTC', PGAPPNAME='agentopia_transition72_readonly')
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
        assert len(expected) == 127 and 'public.desktop_media_revisions' not in expected
        assert sorted(store.accounts['archive']) == sorted(manifest['accountIds'])
        assert len(set(manifest['accountIds'])) == manifest['accounts'] == len(manifest['accountIds'])
        nonce = uuid.uuid4().hex
        begin, end = '__AUDIT_BEGIN_' + nonce + '__', '__AUDIT_END_' + nonce + '__'
        commands = ['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;',
            "SELECT jsonb_build_object('publicTables',(SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations),'readableVault',(SELECT count(decrypted_secret) FROM vault.decrypted_secrets),'newTable',jsonb_build_object('rows',(SELECT count(*) FROM public.desktop_media_revisions),'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='public.desktop_media_revisions'::regclass),'anonDenied',NOT has_table_privilege('anon','public.desktop_media_revisions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'authenticatedDenied',NOT has_table_privilege('authenticated','public.desktop_media_revisions','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'serviceReadWrite',has_table_privilege('service_role','public.desktop_media_revisions','SELECT') AND has_table_privilege('service_role','public.desktop_media_revisions','INSERT') AND has_table_privilege('service_role','public.desktop_media_revisions','UPDATE') AND has_table_privilege('service_role','public.desktop_media_revisions','DELETE'),'columns',(SELECT jsonb_agg(column_name||':'||data_type ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='desktop_media_revisions'),'primaryKey',(SELECT pg_get_constraintdef(oid)='PRIMARY KEY (media_id, version)' FROM pg_constraint WHERE conrelid='public.desktop_media_revisions'::regclass AND contype='p'),'brokerOnlyFunctions',(SELECT bool_and(NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND has_function_privilege('service_role',p.oid,'EXECUTE')) AND count(*)=3 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('desktop_update_library_document','desktop_library_document_versions','desktop_save_agent_document_assignments')),'privateFallbackDenied',NOT has_function_privilege('service_role','public.desktop_save_agent_settings_v71(uuid,uuid,text,jsonb)','EXECUTE')));"]
        for name, record in expected.items():
            schema, table = name.split('.')
            assert all(IDENTIFIER.fullmatch(part) for part in [schema, table, *record['columns']])
            columns = ','.join('"' + part + '"' for part in record['columns'])
            commands += ['\\echo ' + begin + name, 'COPY (SELECT ' + columns + ' FROM ' + schema + '."' + table + '") TO STDOUT;', '\\echo ' + end]
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
        validate_transition(expected, metadata)
        differences = sorted(name for name in expected.keys() | actual.keys() if expected.get(name) != actual.get(name))
        assert not differences, 'Saved rows differ: ' + ', '.join(differences)
        assert metadata['readableVault'] == expected['vault.secrets']['rows']
        root_key = (archive / 'pgsodium_root.key').read_text().strip()
        roots = list(Path('/home/agentopia/.supabase/stacks').glob('*/data/*/pgsodium_root.key'))
        states = list(Path('/home/agentopia/.supabase/stacks').glob('*/state.json'))
        assert len(roots) == len(states) == 1
        assert roots[0].read_text().strip() == root_key == json.loads(states[0].read_text())['credentials']['postgresRootKey']
        assert json.loads(Path('/home/agentopia/.config/agentopia/runtime-secrets.json').read_text())['root_key'] == root_key
        assert tomllib.loads(Path('supabase/config.toml').read_text())['db']['root_key'] == root_key
        report = {'success': True, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'tablesCompared': len(expected),
            'allApplicationTablesCovered': True, 'newEmptyTablesVerified': 1, 'totalTablesCovered': 128, 'newTableBrokerOnly': True, 'schemaMigrations': metadata['migrations'], 'savedRowsCompared': sum(row['rows'] for row in expected.values()),
            'originalDocumentRowsCompared': expected['public.desktop_media_files']['rows'], 'accounts': expected['auth.users']['rows'],
            'chats': expected['public.conversation_sessions']['rows'], 'messages': expected['public.chat_messages_v2']['rows'],
            'readableVaultRecords': metadata['readableVault'], 'encryptionRootBindingsVerified': 4,
            'accountPasswordAndRoleRowsPreserved': True, 'mismatches': [], 'databaseReadOnly': True, 'servicesRestarted': 0,
            'providerRequests': 0, 'completeDecodedDumpBuffered': False, 'maximumCopyRowBytes': store.maximum_row_bytes,
            'copyRowLimitBytes': 64 * 1024 * 1024, 'fingerprintAlgorithm': 'sorted row SHA-256 with duplicate multiplicity'}
        (out / 'archive-table-fingerprints.json').write_text(json.dumps(expected, indent=2))
        return report
    finally:
        store.close()
