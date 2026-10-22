#!/usr/bin/env python3
"""Private runtime maintenance. Output may contain local service credentials."""
import glob
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import hashlib
from database_state import retire_stopped_pidfile,shared_memory_attached,DatabaseStillStopping

os.umask(0o077)
os.chdir('/home/agentopia/app')
ROOT = Path('/opt/agentopia')
state = json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
assert state['runtime'] == 'native'
from urllib.parse import urlparse
db = urlparse(state['env']['DB_URL'])
binary = Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]).parent
connection = ['-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres']
def sql(text):
    return subprocess.check_output([str(binary/'psql'),'-X','-v','ON_ERROR_STOP=1','-At',*connection,'-c',text],text=True).strip()
def sql_file(path):
    subprocess.run([str(binary/'psql'),'-X','-v','ON_ERROR_STOP=1','--single-transaction',*connection,'-f',str(path)],check=True,stdout=subprocess.DEVNULL)

def wait_database_shutdown(directory, timeout=120, shared_record=None):
    """The native supervisor can return while PostgreSQL finishes its checkpoint."""
    import time
    directory=Path(directory)
    if directory.is_symlink() or not directory.is_dir():
        raise RuntimeError('Could not verify the database data directory')
    directory=directory.resolve()
    pidfile=directory/'postmaster.pid'
    lines=shared_record.splitlines() if shared_record else pidfile.read_text().splitlines() if pidfile.exists() else []
    if lines:
        if len(lines)<2 or Path(lines[1]).resolve()!=directory:
            raise RuntimeError('The PostgreSQL data directory does not match its shutdown record')
    deadline=time.monotonic()+timeout
    while True:
        result=subprocess.run([str(binary/'pg_ctl'),'-D',str(directory),'status'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if result.returncode==3:
            try:
                if shared_memory_attached(lines,Path('/proc')):raise DatabaseStillStopping('Database workers are still attached to shared memory')
                retire_stopped_pidfile(directory,binary/'pg_ctl')
            except DatabaseStillStopping:
                if time.monotonic()>=deadline:raise TimeoutError('The database workers are still stopping; the encryption root was left unchanged')
                time.sleep(0.2);continue
            return
        if result.returncode!=0:
            raise RuntimeError('Could not verify database shutdown; the encryption root was left unchanged')
        if time.monotonic()>=deadline:
            raise TimeoutError('The database is still stopping; the encryption root was left unchanged')
        time.sleep(0.2)
def backup(destination):
    target=Path(destination)
    target.mkdir(parents=True,exist_ok=True)
    # All logical archives use one database snapshot, including concurrent chats.
    keeper=subprocess.Popen([str(binary/'psql'),'-X','-qAt','-v','ON_ERROR_STOP=1',*connection],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        keeper.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT pg_export_snapshot();\n');keeper.stdin.flush()
        snapshot=keeper.stdout.readline().strip()
        assert snapshot and all(c in '0123456789ABCDEF-' for c in snapshot),'Could not export a database backup snapshot'
        keeper.stdin.write("SELECT coalesce(json_agg(id ORDER BY id),'[]'::json) FROM auth.users;\n");keeper.stdin.flush()
        account_ids=json.loads(keeper.stdout.readline())
        import uuid
        assert isinstance(account_ids,list) and len(account_ids)==len(set(account_ids)) and all(str(uuid.UUID(value))==value for value in account_ids),'Invalid snapshot account identities'
        exports=[('database.dump',[]),('auth.dump',['--data-only','-n','auth','--exclude-table=auth.schema_migrations']),('application.dump',['-n','public','-n','agentopia_local_setup','-n','agentopia_desktop']),('vault.dump',['--data-only','-n','pgsodium','-n','vault'])]
        for name,arguments in exports:
            subprocess.run([str(binary/'pg_dump'),*connection,'-Fc','--snapshot',snapshot,*arguments,'-f',str(target/name)],check=True)
    finally:
        if keeper.poll() is None:
            keeper.stdin.write('ROLLBACK;\n\\q\n');keeper.stdin.flush();keeper.stdin.close()
            keeper.wait(timeout=15)
    root=glob.glob('/home/agentopia/.supabase/stacks/*/data/*/pgsodium_root.key')
    assert len(root)==1
    import shutil
    shutil.copyfile(root[0],target/'pgsodium_root.key')
    files=[]
    for file in sorted(target.iterdir()):
        if file.name=='manifest.json': continue
        with file.open('rb') as stream: checksum=hashlib.file_digest(stream,'sha256').hexdigest()
        files.append({'name':file.name,'sha256':checksum})
    (target/'manifest.json').write_text(json.dumps({'format':1,'postgres':17,'supabase':'2.121.0','accounts':len(account_ids),'accountIds':account_ids,'scope':'database and encryption root; provider connections stay protected by Windows','files':files}))
def append_restore(archive,destination):
    toc=subprocess.check_output([str(binary/'pg_restore'),'--list',str(archive)],text=True)
    toc='\n'.join(line for line in toc.splitlines() if ' SCHEMA - public ' not in line and not (' DEFAULT ACL ' in line and line.endswith(' supabase_admin')))
    with tempfile.NamedTemporaryFile(mode='w+') as listing:
        listing.write(toc+'\n'); listing.flush()
        destination.flush()
        subprocess.run([str(binary/'pg_restore'),'--no-owner','--use-list',listing.name,'--file=-',str(archive)],stdout=destination,check=True)

command=sys.argv[1]
if command=='provision':
    sql('CREATE SCHEMA IF NOT EXISTS agentopia_desktop; REVOKE ALL ON SCHEMA agentopia_desktop FROM PUBLIC; CREATE TABLE IF NOT EXISTS agentopia_desktop.migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz DEFAULT now())')
    import hashlib
    files=sorted((ROOT/'database').glob('*.sql'))
    for file in files:
        version=file.name; checksum=hashlib.sha256(file.read_bytes()).hexdigest()
        applied=sql("SELECT checksum FROM agentopia_desktop.migrations WHERE version='"+version+"'")
        if applied:
            assert applied==checksum, 'An applied database migration was modified: '+version
            continue
        if version=='0001-baseline.sql':
            sql('CREATE EXTENSION IF NOT EXISTS pgsodium; CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public; CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;')
        # Record the version inside the same transaction as its schema changes.
        with tempfile.NamedTemporaryFile(mode='w+',suffix='.sql') as migration:
            migration.write(file.read_text()+"\nINSERT INTO agentopia_desktop.migrations(version,checksum) VALUES('"+version+"','"+checksum+"');\n")
            migration.flush(); sql_file(migration.name)
    # An unexpected process exit may leave saved partial responses marked running.
    # Auth is bootstrapped by Supabase, while these cross-schema application
    # triggers must also be recreated after a logical recovery backup restore.
    sql("""DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='on_auth_user_created') THEN
       CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='assign_local_user_role_after_signup') THEN
       CREATE TRIGGER assign_local_user_role_after_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_local_user_role();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='desktop_keep_admin_account') THEN
       CREATE TRIGGER desktop_keep_admin_account BEFORE DELETE OR UPDATE OF banned_until ON auth.users FOR EACH ROW EXECUTE FUNCTION public.desktop_guard_admin();
      END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='desktop_first_administrator') THEN
       CREATE TRIGGER desktop_first_administrator AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.desktop_assign_first_administrator();
      END IF;
    END $$""")
    sql("UPDATE public.chat_messages_v2 m SET metadata=metadata||'{\"status\":\"interrupted\"}'::jsonb FROM public.desktop_requests r WHERE r.assistant_message_id=m.id AND r.status='running'; UPDATE public.desktop_requests SET status='interrupted',updated_at=now() WHERE status='running'")
    print(json.dumps({'accounts':int(sql('SELECT count(*) FROM auth.users'))}))
elif command=='backup':
    backup(sys.argv[2]); print(json.dumps({'ok':True}))
elif command=='import':
    # First-run-only import precedes application baseline installation.
    source=Path(sys.argv[2])
    manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8-sig'))
    assert manifest['format']==1 and manifest.get('postgres',17)==17,'Unsupported recovery database version'
    for item in manifest['files']:
        name=item['name']
        assert Path(name).name==name,'Invalid migration resource name'
        with (source/name).open('rb') as stream: checksum=hashlib.file_digest(stream,'sha256').hexdigest()
        assert checksum==item['sha256'],'Migration backup checksum failed: '+name
    fingerprint=hashlib.sha256((source/'manifest.json').read_bytes()).hexdigest()
    schema_exists=sql("SELECT to_regclass('agentopia_desktop.imports') IS NOT NULL")=='t'
    imported=schema_exists and sql("SELECT count(*) FROM agentopia_desktop.imports WHERE source_digest='"+fingerprint+"'")=='1'
    if not imported:
        assert sql("SELECT count(*) FROM auth.users")=='0','The target already has accounts'
        assert sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")=='0','The target already has application tables'
        sql('CREATE EXTENSION IF NOT EXISTS pgsodium; CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public; CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;')
        checksum=hashlib.sha256((ROOT/'database'/'0001-baseline.sql').read_bytes()).hexdigest()
        with tempfile.NamedTemporaryFile(mode='w+b',suffix='.sql') as combined:
            for name in ['auth.dump','application.dump','vault.dump']: append_restore(source/name,combined)
            combined.write(("\nCREATE SCHEMA IF NOT EXISTS agentopia_desktop; REVOKE ALL ON SCHEMA agentopia_desktop FROM PUBLIC; CREATE TABLE IF NOT EXISTS agentopia_desktop.migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now()); INSERT INTO agentopia_desktop.migrations VALUES('0001-baseline.sql','"+checksum+"',now()) ON CONFLICT DO NOTHING; CREATE TABLE IF NOT EXISTS agentopia_desktop.imports(source_digest text PRIMARY KEY,completed_at timestamptz DEFAULT now()); INSERT INTO agentopia_desktop.imports(source_digest) VALUES('"+fingerprint+"');\n").encode())
            combined.flush();sql_file(combined.name)
    # Restored catalogs need fresh planner statistics before the API builds its
    # schema cache. Also run this when resuming an already committed import.
    sql('ANALYZE')
    import shutil
    root=glob.glob('/home/agentopia/.supabase/stacks/*/data/*/pgsodium_root.key')
    assert len(root)==1
    data_directory=Path(root[0]).parent/'data'
    pidfile=data_directory/'postmaster.pid'
    shared_record=pidfile.read_text() if pidfile.exists() else None
    subprocess.run(['supabase','stop'],check=True,stdout=subprocess.DEVNULL)
    wait_database_shutdown(data_directory,shared_record=shared_record)
    shutil.copyfile(source/'pgsodium_root.key',root[0]); os.chmod(root[0],0o600)
    secrets_file=Path('/home/agentopia/.config/agentopia/runtime-secrets.json')
    if secrets_file.exists():
        # Future starts must continue using the restored encryption root.
        values=json.loads(secrets_file.read_text())
        values['root_key']=(source/'pgsodium_root.key').read_text().strip()
        import re
        assert re.fullmatch('[0-9a-fA-F]{64}',values['root_key']),'Invalid restored encryption root'
        temporary=secrets_file.with_suffix('.tmp');temporary.write_text(json.dumps(values));temporary.replace(secrets_file)
        configuration=Path('supabase/config.toml')
        configuration.write_text(re.sub(r'^root_key = .*$', 'root_key = '+json.dumps(values['root_key']),configuration.read_text(),flags=re.M))
        # CLI 2.121.0 keeps a second root binding in its saved stack state.
        # Update only that binding while its owner and services are stopped.
        states=list(Path('/home/agentopia/.supabase/stacks').glob('*/state.json'))
        assert len(states)==1,'Ambiguous stopped runtime state'
        saved=json.loads(states[0].read_text())
        saved['credentials']['postgresRootKey']=values['root_key']
        temporary=states[0].with_suffix('.tmp');temporary.write_text(json.dumps(saved));temporary.replace(states[0])
    subprocess.run(['supabase','start','--runtime','native','--eager','--exclude','analytics,pooler,studio'],check=True,stdout=subprocess.DEVNULL)
    print(json.dumps({'accounts':int(sql('SELECT count(*) FROM auth.users'))}))
else:
    raise SystemExit('Unknown maintenance operation')
