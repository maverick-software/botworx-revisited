"""Validate the new account query on the existing database, read-only."""
from pathlib import Path
import datetime,glob,hashlib,json,os,subprocess,uuid
from urllib.parse import urlparse,unquote
root=Path('/mnt/d/Users/charl/software/Agentopia');pointer=json.loads((root/'.supabase/desktop-portable-backup/current.json').read_text());value=pointer['work'];out=Path('/mnt/'+value[0].lower()+value[2:].replace('\\','/'))
os.chdir('/home/agentopia/app');stack=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));db=urlparse(stack['env']['DB_URL']);binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0];env=dict(os.environ,PGPASSWORD=unquote(db.password or ''),PGOPTIONS='-c default_transaction_read_only=on')
query="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();\nSELECT coalesce(json_agg(id ORDER BY id),'[]'::json) FROM auth.users;\nROLLBACK;\n"
result=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(db.port),'-U','supabase_admin','-d','postgres'],input=query,text=True,env=env,capture_output=True,check=True);lines=result.stdout.splitlines();assert len(lines)==2
owners=json.loads(lines[1]);assert isinstance(owners,list) and len(owners)==len(set(owners)) and all(str(uuid.UUID(owner))==owner for owner in owners)
evidence={'success':True,'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'readOnly':True,'snapshotExported':bool(lines[0]),'accounts':len(owners),'accountSetSha256':hashlib.sha256(json.dumps(owners).encode()).hexdigest(),'actualPostgresQueryPassed':True,'archiveDumpExecuted':False,'providerRequests':0,'databaseServicesStarted':0}
with (out/'actual-account-query.json').open('x') as stream:json.dump(evidence,stream,indent=2)
print(json.dumps(evidence))
