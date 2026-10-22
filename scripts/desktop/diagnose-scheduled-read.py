"""Read-only preservation audit, including original rows after test fixtures are added."""
import glob,hashlib,json,os,re,subprocess,sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse,unquote
out=Path(sys.argv[1]).resolve();assert out.parent==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-packaged-coordination') and re.fullmatch(r'\d{13}',out.name)
config=json.loads((out/'intent.json').read_text());assert config['schema']==67
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==config['instanceId']
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));assert state['runtime']=='native'
url=urlparse(state['env']['DB_URL']);assert url.port==config['ports']['database'];binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''),PGOPTIONS='-c default_transaction_read_only=on',PGAPPNAME='agentopia_coordination_preservation_audit')
def sql(statement):
    result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=statement+'\n',env=env,text=True,capture_output=True)
    if result.returncode:(out/'private-preservation-error.log').write_text(result.stderr);raise RuntimeError('Preservation audit failed; inspect private-preservation-error.log')
    return result.stdout.strip()
def quote(value):return '"'+value.replace('"','""')+'"'

rows=json.loads(sql("SELECT coalesce(json_agg(t),'[]') FROM (SELECT id,task_id,status,unread,request_id FROM public.desktop_scheduled_runs WHERE task_id='7480da40-ec1d-43cc-bd44-407fc95e7ee1') t"))
(out/'scheduled-read-diagnosis.json').write_text(json.dumps({'runs':rows,'readOnly':True},indent=2));print(json.dumps(rows))

