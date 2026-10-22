"""Exercise actual PostgREST transactions in the owned private qualification copy."""
import glob,hashlib,json,os,re,subprocess,sys,time,urllib.request,urllib.error
from pathlib import Path
from urllib.parse import urlparse,unquote,urlencode
os.umask(0o077)
out=Path(sys.argv[1]).resolve()
assert out==Path('/mnt/d/Users/charl/software/Agentopia/.supabase/desktop-packaged-coordination/1792360611512')
config=json.loads((out/'intent.json').read_text());assert config['productionMigrated'] is False
assert Path('/opt/agentopia/runtime-instance').read_text().strip()==config['instanceId']
mode=sys.argv[2];assert mode in ('before','apply-and-check')
os.chdir('/home/agentopia/app');state=json.loads(subprocess.check_output(['supabase','stack','status','--output-format','json'],text=True))
url=urlparse(state['env']['DB_URL']);assert url.port==config['ports']['database']
binary=glob.glob('/home/agentopia/.supabase/cache/stack/slim-services/postgres/*/linux-amd64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=unquote(url.password or ''))
def sql(q):
 p=subprocess.run([binary,'-XqAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',str(url.port),'-U','supabase_admin','-d','postgres'],input=q,text=True,env=env,capture_output=True,timeout=30)
 if p.returncode:(out/'private-rpc-modes-sql.log').write_text(p.stderr)
 assert p.returncode==0,'Inspect private-rpc-modes-sql.log'
 return p.stdout.strip()
def http(name,args,key='SERVICE_ROLE_KEY',method='POST'):
 token=state['env'][key];endpoint=state['env']['API_URL']+'/rest/v1/rpc/'+name
 if method=='GET':endpoint+='?'+urlencode({k:'' if v is None else str(v).lower() if isinstance(v,bool) else str(v) for k,v in args.items() if v is not None})
 request=urllib.request.Request(endpoint,data=json.dumps(args).encode() if method=='POST' else None,headers={'apikey':token,'Authorization':'Bearer '+token,'Content-Type':'application/json'},method=method)
 try:
  with urllib.request.urlopen(request,timeout=20) as r:return r.status,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
evidence=json.loads((out/'evidence.json').read_text());owner=evidence['fixtureUser'];source=evidence['sourceRequest']
assert re.fullmatch(r'[a-f0-9-]{36}',owner) and re.fullmatch(r'[a-f0-9-]{36}',source)
delivery=json.loads(sql("SELECT row_to_json(d) FROM desktop_chat_deliveries d WHERE user_id='"+owner+"' AND source_request='"+source+"'"))
calls=[('desktop_chat_delivery_snapshot',{'p_user':owner,'p_request':source,'p_project':None,'p_thread':None,'p_target':delivery['target_chat'],'p_active':False}),('desktop_validate_chat_delivery',{'p_user':owner,'p_id':delivery['id']}),('desktop_validate_chat_delivery_request',{'p_user':owner,'p_request':delivery['target_request']})]
report={'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'mode':mode,'productionChanged':False,'providerRequests':0,'checks':[]}
if mode=='before':
 for name,args in calls:
  status,body=http(name,args);assert status==405 and 'read-only transaction' in body,(name,status)
  report['checks'].append(name+': HTTP reproduces read-only transaction failure')
else:
 migration=Path('/mnt/d/Users/charl/software/Agentopia/desktop/database/0067-chat-delivery-rpc-transactions.sql');digest=hashlib.sha256(migration.read_bytes()).hexdigest()
 before=sql("SELECT md5(string_agg(to_jsonb(p)::text,E'\\n' ORDER BY oid)) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname NOT IN('desktop_chat_delivery_snapshot','desktop_validate_chat_delivery','desktop_validate_chat_delivery_request')")
 privileges=sql("SELECT json_agg(json_build_array(oid,prosecdef,proacl,prosrc) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('desktop_chat_delivery_snapshot','desktop_validate_chat_delivery','desktop_validate_chat_delivery_request')")
 sql('BEGIN; '+migration.read_text()+" INSERT INTO agentopia_desktop.migrations(version,checksum) VALUES('"+migration.name+"','"+digest+"'); COMMIT;")
 assert privileges==sql("SELECT json_agg(json_build_array(oid,prosecdef,proacl,prosrc) ORDER BY oid) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('desktop_chat_delivery_snapshot','desktop_validate_chat_delivery','desktop_validate_chat_delivery_request')")
 assert before==sql("SELECT md5(string_agg(to_jsonb(p)::text,E'\\n' ORDER BY oid)) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname NOT IN('desktop_chat_delivery_snapshot','desktop_validate_chat_delivery','desktop_validate_chat_delivery_request')")
 report['checks'].append('Only three volatility declarations changed; function bodies, security mode, grants and every other public function are unchanged')
 for name,args in calls:
  deadline=time.monotonic()+12
  while True:
   status,body=http(name,args)
   if status<300 or time.monotonic()>=deadline:break
   time.sleep(.25)
  if status>=300:(out/('private-rpc-'+name+'.json')).write_text(body)
  assert status<300,(name,status)
  report['checks'].append(name+': actual HTTP POST succeeds after migration')
  anonymous,_=http(name,args,key='ANON_KEY');assert anonymous>=400
  report['checks'].append(name+': anonymous execution remains denied')
 # The same original receiving request is validated; no replay was necessary.
 assert sql("SELECT status FROM desktop_requests WHERE id='"+delivery['target_request']+"'")=='cancelled'
 report['checks'].append('Original cancelled request stays cancelled; no inference or request replay was used to verify the fix')
report['success']=True;(out/('rpc-modes-'+mode+'.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
