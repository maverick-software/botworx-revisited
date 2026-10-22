"""Read only role/function metadata in the explicitly owned QA runtime."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import glob,json,os,subprocess,sys

assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='c0e548ce-f913-4746-9e2e-9a466362c900'
out=Path(sys.argv[1]);assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-chrome-context60') and out.name=='qa-privileges.json'
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(state['env']['DB_URL']);assert db.hostname=='127.0.0.1' and 50000<db.port<60000 and db.port!=57322
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
query="""
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_object('function',p.proname,'owner',r.rolname,'definer',p.prosecdef)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname='public' AND p.proname IN ('desktop_guard_admin','desktop_assign_first_administrator','user_has_role','desktop_save_agent','handle_agent_deletion_cascade')),
 'roles',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls,'authUsersSelect',has_table_privilege(oid,'auth.users','SELECT'),'authUsersIdSelect',has_column_privilege(oid,'auth.users','id','SELECT'))) FROM pg_roles WHERE rolname IN ('postgres','supabase_admin','service_role','supabase_auth_admin')),
 'authUsersOwner',(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='auth.users'::regclass));
"""
env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_qa_privileges60_readonly')
r=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input='BEGIN READ ONLY;\n'+query+'\nCOMMIT;\n',env=env,text=True,capture_output=True)
if r.returncode:raise RuntimeError('Read-only QA privilege audit failed; no database changes were attempted')
data={'success':True,'readOnly':True,'qaInstance':'c0e548ce-f913-4746-9e2e-9a466362c900','productionAccess':False,'metadata':json.loads(r.stdout)}
out.write_text(json.dumps(data,indent=2));print(json.dumps(data))
