"""Read status counts from the bound existing database; never expose row content."""
from pathlib import Path
import datetime
import glob
import json
import os
import re
import subprocess
import sys
from urllib.parse import urlparse,unquote

out=Path(sys.argv[1])
assert out.parent==Path('/mnt/f/Agentopia/.supabase/desktop-production-logical') and re.fullmatch(r'\d{13}',out.name)
assert Path('/opt/agentopia/runtime-identity').read_text().strip()=='local.agentopia.desktop-runtime.v1'
assert Path('/opt/agentopia/runtime-instance').read_text().strip()=='a91a4800-e08f-4440-a4ec-588762d01bfd'
os.chdir('/home/agentopia/app')
state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
db=urlparse(state['env']['DB_URL']);assert db.port==57322
binary=Path(glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0])
environment=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
query="""BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
 'requests',(SELECT json_object_agg(status,n) FROM (SELECT status,count(*) n FROM public.desktop_requests GROUP BY status) s),
 'agentInstances',(SELECT json_object_agg(status,n) FROM (SELECT status,count(*) n FROM public.desktop_agent_instances GROUP BY status) s));
COMMIT;"""
result=subprocess.run([str(binary),'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query,text=True,env=environment,capture_output=True,check=True)
counts=json.loads(result.stdout)
terminal={'completed','failed','cancelled','interrupted'}
active=sum(number for status,number in (counts['requests'] or {}).items() if status not in terminal)
report={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'databaseReadOnly':True,'providerRequests':0,
        'statusCounts':counts,'unfinishedRequests':active,'applicationClosureStillRequired':True,'mustRecheckBeforeReset':True}
(out/'runtime-maintenance-readiness.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
