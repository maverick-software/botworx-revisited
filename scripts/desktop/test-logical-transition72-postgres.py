"""Rehearse the71-to72 comparison in the owned70 QA copy and restore it exactly."""
import glob
import hashlib
import json
import os
import subprocess
import sys
import traceback
from pathlib import Path
from urllib.parse import unquote, urlparse
from audit_logical_snapshot71 import audit as strict_audit
from audit_logical_transition72 import audit

os.umask(0o077)
root = Path('/mnt/f/Agentopia')
out, intent = map(Path, sys.argv[1:3])
cfg = json.loads(intent.read_text())
assert out.parent == root / '.supabase/desktop-logical-transition72'
assert cfg['instance'] == '7d87fd24-b2da-41ea-81a9-e9a764327845' and cfg['role'] == 'restored'
assert Path('/opt/agentopia/runtime-instance').read_text().strip() == cfg['instance']
os.chdir('/home/agentopia/app')
e = {'success': False, 'productionAccess': False, 'providerRequests': 0, 'checks': []}
binary = None
applied = False
agent = None

def sql(query):
    r = subprocess.run([str(binary / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(url.port), '-U', 'supabase_admin', '-d', 'postgres'], input=query + '\n', env=env, capture_output=True, text=True)
    if r.returncode:
        (out / 'private-query-error.log').write_text(r.stderr)
        raise RuntimeError('Inspect the private query diagnostic.')
    return r.stdout.strip()

def compare(label, expected_error=None):
    folder = out / label
    folder.mkdir()
    try:
        result = audit(out / 'before-database', folder, cfg['instance'], cfg['portBase'] + 2)
    except AssertionError as error:
        assert expected_error and expected_error in str(error), str(error)
        return {'rejected': True, 'reason': str(error)}
    assert expected_error is None, 'Unsafe state was accepted.'
    return result

try:
    r = subprocess.run(['supabase', 'start', '--runtime', 'native', '--eager', '--exclude', 'analytics,pooler,studio'], capture_output=True, text=True, timeout=300)
    (out / 'private-start.log').write_text(r.stdout + '\n' + r.stderr)
    assert r.returncode == 0
    state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
    url = urlparse(state['env']['DB_URL'])
    assert url.port == cfg['portBase'] + 2 and url.port != 57322
    binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
    env = dict(os.environ, PGPASSWORD=unquote(url.password or ''), PGAPPNAME='agentopia_transition72_generated_qa')
    assert sql('SELECT count(*) FROM agentopia_desktop.migrations') == '71'
    assert sql("SELECT to_regclass('public.desktop_media_revisions') IS NULL") == 't'
    original_import = sql("SELECT pg_get_functiondef('public.desktop_import_agent_document(uuid,uuid,uuid,jsonb)'::regprocedure)")
    backup = subprocess.run(['python3', '/opt/agentopia/manage.py', 'backup', str(out / 'before-database')], capture_output=True, text=True, timeout=180)
    (out / 'private-backup.log').write_text(backup.stdout + '\n' + backup.stderr)
    assert backup.returncode == 0
    migration = (root / 'desktop/database/0072-agent-document-library.sql').read_text()
    checksum = hashlib.sha256((root / 'desktop/database/0072-agent-document-library.sql').read_bytes()).hexdigest()
    sql("BEGIN;\n" + migration + "\nINSERT INTO agentopia_desktop.migrations(version,checksum) VALUES('0072-agent-document-library.sql','" + checksum + "'); COMMIT;")
    applied = True
    e['transition'] = compare('accepted-transition')
    e['checks'].append('Every prior127-table snapshot row matches schema72, and the sole new empty table has the expected structure and broker-only access.')
    agent = sql('SELECT id FROM agents ORDER BY id LIMIT 1')
    description = sql("SELECT quote_nullable(description) FROM agents WHERE id='" + agent + "'")
    sql('ALTER TABLE agents DISABLE TRIGGER USER')
    sql("UPDATE agents SET description='Generated transition corruption probe' WHERE id='" + agent + "'")
    compare('rejected-old-row-change', 'Saved rows differ: public.agents')
    sql("UPDATE agents SET description=" + description + " WHERE id='" + agent + "'")
    sql('ALTER TABLE agents ENABLE TRIGGER USER')
    agent = None
    e['checks'].append('A changed pre-existing agent row is rejected.')
    sql('INSERT INTO desktop_media_revisions(media_id,version,user_id,document,bytes) SELECT f.media_id,999,f.user_id,to_jsonb(m),f.bytes FROM desktop_media_files f JOIN media_library m ON m.id=f.media_id LIMIT 1')
    compare('rejected-new-row', 'newly added revisions table must be empty')
    sql('DELETE FROM desktop_media_revisions WHERE version=999')
    e['checks'].append('A populated newly added table is rejected.')
    sql('GRANT SELECT ON desktop_media_revisions TO authenticated')
    compare('rejected-client-grant', 'authenticatedDenied')
    sql('REVOKE SELECT ON desktop_media_revisions FROM authenticated')
    e['checks'].append('A client-role grant on retained history is rejected.')
    e['repairedTransition'] = compare('accepted-after-repair')
    e['tested'] = True
except Exception as error:
    e['error'] = str(error)
    (out / 'private-traceback.log').write_text(traceback.format_exc())
finally:
    try:
        if binary:
            if agent:
                sql("UPDATE agents SET description=" + description + " WHERE id='" + agent + "'")
            if agent:
                sql('ALTER TABLE agents ENABLE TRIGGER USER')
            if applied:
                sql("BEGIN; DROP TRIGGER desktop_validate_document_assignment ON agent_media_assignments; DROP FUNCTION desktop_validate_document_assignment(); DROP FUNCTION desktop_save_agent_settings(uuid,uuid,text,jsonb); ALTER FUNCTION desktop_save_agent_settings_v71(uuid,uuid,text,jsonb) RENAME TO desktop_save_agent_settings; GRANT EXECUTE ON FUNCTION desktop_save_agent_settings(uuid,uuid,text,jsonb) TO service_role; DROP FUNCTION desktop_update_library_document(uuid,uuid,uuid,integer,timestamptz,text,jsonb),desktop_library_document_versions(uuid,uuid,uuid),desktop_save_agent_document_assignments(uuid,uuid,jsonb); " + original_import + "; DROP FUNCTION desktop_document_payload_bytes(jsonb),desktop_document_storage_limit(uuid,bigint); DROP TABLE desktop_media_revisions; DELETE FROM agentopia_desktop.migrations WHERE version='0072-agent-document-library.sql'; COMMIT;")
            folder = out / 'strict-restored-comparison'
            folder.mkdir()
            restored = strict_audit(out / 'before-database', folder, cfg['instance'], cfg['portBase'] + 2)
            e['previousRowsAndSchemaRestored'] = restored['success'] and restored['tablesCompared'] == 127 and sql('SELECT count(*) FROM agentopia_desktop.migrations') == '71'
            e['checks'].append('All prior rows and schema71 are restored after the rehearsal.')
    except Exception as error:
        e['cleanupError'] = str(error)
    stopped = subprocess.run(['supabase', 'stop'], capture_output=True, text=True, timeout=120)
    e['qaServicesStopped'] = stopped.returncode == 0
    e['success'] = bool(e.get('tested') and e.get('previousRowsAndSchemaRestored') and e['qaServicesStopped'])
    (out / 'evidence.json').write_text(json.dumps(e, indent=2))
print(json.dumps({'success': e['success'], 'checks': len(e['checks']), 'error': e.get('error'), 'cleanupError': e.get('cleanupError')}))
sys.exit(0 if e['success'] else 1)
