import os,json,glob,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote
os.chdir('/home/sylvana/app')
s=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(s['env']['DB_URL']);binary=glob.glob('/home/sylvana/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''))
source=Path('/mnt/f/Sylvana/desktop/desktop/database/0093-firm-ai-connections.sql').read_text(encoding='utf-8')
source=source.replace('BEGIN;','',1).rsplit('COMMIT;',1)[0]
checks="""DO $$ BEGIN
 IF position('openai-api' in pg_get_functiondef('public.desktop_save_agent(uuid,uuid,text,text,text,text,text)'::regprocedure))=0 THEN RAISE EXCEPTION 'Agent provider update missing';END IF;
 IF exists(select 1 from pg_constraint where conname in ('desktop_codex_threads_provider_check','desktop_preview_codex_threads_provider_check') and (position('openai-api' in pg_get_constraintdef(oid))=0 or position('sylvana' in pg_get_constraintdef(oid))=0)) THEN RAISE EXCEPTION 'Native scope provider update missing';END IF;
END $$;"""
# The real schema is exercised, and every change is rolled back after checks.
r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='begin;'+source+checks+'rollback;',env=env,text=True,capture_output=True)
if r.returncode:raise RuntimeError('Schema verification failed: '+r.stderr[-1200:])
print(json.dumps({'success':True,'transactionRolledBack':True,'accountsChanged':False,'providerConstraintsChecked':True}))
