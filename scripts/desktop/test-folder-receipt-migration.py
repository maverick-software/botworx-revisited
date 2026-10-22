"""Qualify the exact folder uniqueness migration in an owned disposable database.

Run inside the already-running managed WSL runtime as its service account. This
does not change production schema, start services, or use any provider.
"""
import glob, hashlib, json, os, re, subprocess, sys, time, uuid
from pathlib import Path
from urllib.parse import urlparse

root = Path('/mnt/d/Users/charl/software/Agentopia')
out = Path(sys.argv[1]).resolve()
assert out.parent == root / '.supabase/desktop-plugin-import'
assert out.name.startswith('folder-migration-')
out.mkdir(exist_ok=False)
os.chdir('/home/agentopia/app')
state = json.loads(subprocess.check_output(['supabase', 'stack', 'status', '--output-format', 'json'], text=True))
assert state['runtime'] == 'native'
url = urlparse(state['env']['DB_URL'])
binary = glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
environment = dict(os.environ)
if url.password:
    environment['PGPASSWORD'] = url.password
base = [binary, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', str(url.port), '-U', 'supabase_admin']
database = 'agentopia_folder_' + uuid.uuid4().hex[:12]
assert re.fullmatch(r'agentopia_folder_[a-f0-9]{12}', database)
evidence = {'database': database, 'applicationDatabase': 'postgres', 'productionMigrations': 0, 'serviceStarts': 0, 'liveInferenceRequests': 0, 'checks': []}
(out / 'intent.json').write_text(json.dumps(evidence, indent=2))

def sql(statement, target=database):
    result = subprocess.run([*base, '-d', target, '-c', statement], env=environment, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[:2000])
    return result.stdout.strip()

def inventory():
    return json.loads(sql("SELECT json_build_object('users',(SELECT count(*) FROM auth.users),'conversations',(SELECT count(*) FROM public.conversation_sessions),'messages',(SELECT count(*) FROM public.chat_messages_v2),'migrations',(SELECT count(*) FROM agentopia_desktop.migrations))", 'postgres'))

def check(name):
    evidence['checks'].append(name)
    (out / 'checkpoint.json').write_text(json.dumps(evidence, indent=2))

created = False
first = None
try:
    evidence['before'] = inventory()
    assert not sql("SELECT 1 FROM pg_database WHERE datname='" + database + "'", 'postgres')
    sql('CREATE DATABASE ' + database + ' TEMPLATE template0', 'postgres')
    created = True
    sql('CREATE TABLE public.desktop_tool_calls(id uuid PRIMARY KEY,request_id uuid NOT NULL,native_thread_id text,name text NOT NULL,arguments jsonb NOT NULL)')
    migration = root / 'desktop/database/0055-browser-folder-receipts.sql'
    evidence['migrationSha256'] = hashlib.sha256(migration.read_bytes()).hexdigest()
    sql(migration.read_text())
    check('the unchanged additive migration applies in an isolated database')
    request, child = str(uuid.uuid4()), str(uuid.uuid4())

    def insert(thread, call='same-call', name='browser_upload_folder'):
        native = 'NULL' if thread is None else "'" + thread + "'"
        return "INSERT INTO public.desktop_tool_calls VALUES ('" + str(uuid.uuid4()) + "','" + request + "'," + native + ",'" + name + "','" + json.dumps({'provider_call_id': call}) + "')"

    sql(insert(None))
    denied = subprocess.run([*base, '-d', database, '-c', insert(None)], env=environment, capture_output=True, text=True)
    assert denied.returncode and 'desktop_browser_folder_call_once' in denied.stderr
    check('a repeated parent call is rejected by PostgreSQL before dispatch')
    sql(insert(child))
    sql(insert(str(uuid.uuid4())))
    sql(insert(None, 'another-call'))
    assert sql('SELECT count(*) FROM public.desktop_tool_calls') == '4'
    check('child threads and new call identifiers retain independent receipts')
    sql(insert(None, 'different-tool', 'browser_upload'))
    sql(insert(None, 'different-tool', 'browser_upload'))
    check('the new constraint leaves existing tool names outside its scope')
    first = subprocess.Popen([*base, '-d', database, '-c', 'BEGIN; ' + insert(None, 'racing') + '; SELECT pg_sleep(1); COMMIT'], env=environment, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    # Wait for the first uncommitted insert to hold its transaction, then send
    # the competing insert through a separate actual PostgreSQL connection.
    deadline = time.monotonic() + 5
    while sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND query LIKE 'BEGIN; %racing%' AND wait_event='PgSleep'") != '1':
        assert first.poll() is None and time.monotonic() < deadline
        time.sleep(.025)
    second = subprocess.run([*base, '-d', database, '-c', insert(None, 'racing')], env=environment, capture_output=True, text=True, timeout=10)
    _, error = first.communicate(timeout=10)
    assert first.returncode == 0, error
    assert second.returncode and 'desktop_browser_folder_call_once' in second.stderr
    assert sql("SELECT count(*) FROM public.desktop_tool_calls WHERE arguments->>'provider_call_id'='racing'") == '1'
    check('simultaneous connections commit one folder receipt and reject the duplicate')
    evidence['checksPassed'] = True
except Exception as error:
    evidence['error'] = str(error)
finally:
    if first and first.poll() is None:
        first.communicate(timeout=10)
    if created:
        # The generated name was checked before creation and never accepted as
        # input. Only this newly created database can reach the removal step.
        sql('DROP DATABASE ' + database, 'postgres')
        evidence['disposableDatabaseRemoved'] = True
    evidence['after'] = inventory()
    evidence['productionUnchanged'] = evidence['after'] == evidence.get('before')
    evidence['success'] = bool(evidence.get('checksPassed') and evidence.get('disposableDatabaseRemoved') and evidence['productionUnchanged'])
    (out / 'evidence.json').write_text(json.dumps(evidence, indent=2))
print(json.dumps(evidence))
sys.exit(0 if evidence['success'] else 1)
