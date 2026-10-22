"""Diagnose RPC access modes in the owned stopped-test database; no inference."""
import glob,json,os,re,subprocess,sys,urllib.request,urllib.error
from pathlib import Path
from urllib.parse import urlparse,unquote
os.umask(0o077)
out=Path(sys.argv[1]).resolve();assert out==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-packaged-coordination/1792360611512')
config=json.loads((out/'intent.json').read_text());assert Path('/opt/agentopia/runtime-instance').read_text().strip()==config['instanceId']
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True));url=urlparse(state['env']['DB_URL']);assert url.port==config['ports']['database']
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''))
def sql(q,fail=False):
 p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=q,text=True,env=env,capture_output=True,timeout=30)
 if not fail:assert p.returncode==0,p.stderr
 return p
functions=json.loads(sql("SELECT json_agg(json_build_object('name',proname,'signature',oid::regprocedure::text,'volatility',provolatile,'source',prosrc)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'desktop_%'").stdout)
names={f['name'] for f in functions};volatile={f['name'] for f in functions if f['volatility']=='v'};affected=[]
for f in functions:f['calls']=sorted(set(re.findall(r'\b(desktop_\w+)\s*\(',f['source']))&names)
changed=True
while changed:
 changed=False
 for f in functions:
  if f['name'] not in volatile and set(f['calls'])&volatile:volatile.add(f['name']);changed=True
for f in functions:
 if f['volatility']!='v' and f['name'] in volatile:affected.append({k:f[k] for k in ['name','signature','volatility','calls']})
owner=json.loads((out/'evidence.json').read_text())['fixtureUser'];source=json.loads((out/'evidence.json').read_text())['sourceRequest']
target=sql("SELECT target_request FROM desktop_chat_deliveries WHERE user_id='"+owner+"' AND source_request='"+source+"'").stdout.strip();assert re.fullmatch(r'[a-f0-9-]{36}',target)
args={'p_user':owner,'p_request':target}
request=urllib.request.Request(state['env']['API_URL']+'/rest/v1/rpc/desktop_validate_chat_delivery_request',data=json.dumps(args).encode(),headers={'apikey':state['env']['SERVICE_ROLE_KEY'],'Authorization':'Bearer '+state['env']['SERVICE_ROLE_KEY'],'Content-Type':'application/json'},method='POST')
try:
 with urllib.request.urlopen(request,timeout=20) as response:status=response.status;body=response.read().decode()
except urllib.error.HTTPError as e:status=e.code;body=e.read().decode()
(out/'private-volatility-http.json').write_text(body)
direct=sql("SELECT desktop_validate_chat_delivery_request('"+owner+"','"+target+"');",True)
assert status>=400 and 'read-only transaction' in body
assert direct.returncode==0,direct.stderr
report={'success':True,'schema':66,'receiverRequest':target,'httpStatus':status,'httpReadOnlyFailure':True,'directWritableSQLSucceeds':True,'affectedFunctions':affected,'providerRequests':0,'productionChanged':False}
(out/'rpc-volatility-diagnosis.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
